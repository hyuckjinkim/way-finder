/**
 * OW1 — Valhalla 커스텀 경로 **실 배선** 통합 테스트 (게이트 A, P4 §4 OW1).
 *
 * **이 테스트의 존재 이유 (P2 502 미배선 사고 방지):** 핸들러(`POST /v1/routes`)가
 * 실제로 valhallaProvider(A2) + extraMinutesFilter(OO1)를 호출함을 end-to-end로 단언한다.
 * provider 단위 테스트(valhallaProvider.test.ts)·필터 단위 테스트(extraMinutesFilter.test.ts)는
 * *체인 배선*을 증명하지 못한다 — 핸들러가 슬롯을 실제로 통과하는지가 여기서만 증명된다.
 *
 * 데모 모드 불인정: `DEMO_MODE='false'` + `VALHALLA_URL` 설정으로 데모 단락(short-circuit)을
 * 우회해 실 모드 커스텀 경로 분기에 진입한다. fetch는 모킹(실 컨테이너 불요 — 게이트 B가 별도).
 *
 * **2-call 백본 단언:** applyExtraMinutesFilter가 provider.route를 2회(baseline fastest +
 * profile) 호출하므로 fetch도 2회 호출됨을 단언한다 — 필터가 실제로 엔진을 거침의 증거.
 */
import { describe, it, expect, vi, afterEach } from 'vitest';
import app from '../index.js';
import { routesPath } from '@wayfinder/shared/api';
import type { Route, RouteCustomMeta } from '@wayfinder/shared';
import { WALK_SIMPLE_RAW } from '../fixtures/valhalla/index.js';

function makeKV(): KVNamespace {
  const store = new Map<string, string>();
  return {
    async get(k: string) { return store.get(k) ?? null; },
    async put(k: string, v: string) { store.set(k, v); },
    async delete(k: string) { store.delete(k); },
    async list() { return { keys: [], list_complete: true, caret: undefined }; },
    async getWithMetadata(k: string) { return { value: store.get(k) ?? null, metadata: null }; },
  } as unknown as KVNamespace;
}

/**
 * 실 모드 + Valhalla 설정 env. DEMO_MODE='false'로 데모 단락 우회,
 * VALHALLA_URL 설정으로 커스텀 경로 진입. kr+walk 키(TMAP)도 채워 데모 판정 회피.
 */
function valhallaEnv(): Record<string, unknown> {
  return {
    DEMO_MODE: 'false',
    KAKAO_REST_KEY: 'k', GOOGLE_PLACES_KEY: 'g', NAVER_CLIENT_ID: 'n', NAVER_CLIENT_SECRET: 's',
    KAKAO_MOBILITY_KEY: 'km', TMAP_APP_KEY: 'tm', GOOGLE_ROUTES_KEY: 'gr', MAPBOX_TOKEN: 'mb',
    VALHALLA_URL: 'http://localhost:8002',
    CACHE: makeKV(),
  };
}

// 서울 시내 좌표 (kr + walk — 커스텀 경로 진입 조건).
const KR_WALK = [
  { lat: 37.5663, lng: 126.9779 },
  { lat: 37.5704, lng: 126.9921 },
];

async function postCustomRoute(
  body: Record<string, unknown>,
  env: Record<string, unknown>,
): Promise<Response> {
  const req = new Request(`http://localhost${routesPath}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
  return app.fetch(req, env, {} as ExecutionContext);
}

describe('OW1 — Valhalla 커스텀 경로 실 배선 (핸들러→provider→필터)', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('preference=safe → 핸들러가 valhallaProvider+필터를 호출하고 customMeta를 응답에 싣는다', async () => {
    const fetchSpy = vi
      .fn()
      .mockResolvedValue({ ok: true, json: async () => WALK_SIMPLE_RAW });
    vi.stubGlobal('fetch', fetchSpy);

    const res = await postCustomRoute(
      { stops: KR_WALK, mode: 'walk', preference: 'safe', maxExtraMinutes: 10 },
      valhallaEnv(),
    );

    expect(res.status).toBe(200);
    const route = (await res.json()) as Route & { customMeta?: RouteCustomMeta };

    // (1) 핸들러가 실제로 Valhalla provider를 거침 — fetch가 Valhalla /route로 향함.
    expect(fetchSpy).toHaveBeenCalled();
    expect(fetchSpy.mock.calls[0]![0]).toBe('http://localhost:8002/route');

    // (2) 2-call +N 필터가 엔진을 거침 — provider.route 2회(baseline fastest + profile).
    expect(fetchSpy).toHaveBeenCalledTimes(2);

    // (3) customMeta가 응답에 실림(profile·withinBudget) — 필터 산출의 단일 표면.
    expect(route.customMeta).toBeDefined();
    expect(route.customMeta!.preference).toBe('safe');
    expect(typeof route.customMeta!.withinBudget).toBe('boolean');
    expect(route.customMeta!.baselineDurationSec).toBeGreaterThan(0);

    // 응답이 정규화된 Route임 — 도보 leg.
    expect(route.legs[0]!.mode).toBe('walk');
  });

  it('첫 호출(baseline)은 fastest costing, 둘째(profile)는 safe costing body로 전송된다', async () => {
    const fetchSpy = vi
      .fn()
      .mockResolvedValue({ ok: true, json: async () => WALK_SIMPLE_RAW });
    vi.stubGlobal('fetch', fetchSpy);

    await postCustomRoute(
      { stops: KR_WALK, mode: 'walk', preference: 'safe', maxExtraMinutes: 10 },
      valhallaEnv(),
    );

    const baselineBody = JSON.parse(fetchSpy.mock.calls[0]![1].body);
    const profileBody = JSON.parse(fetchSpy.mock.calls[1]![1].body);
    // baseline = 표준 pedestrian (costing_options 미포함).
    expect(baselineBody.costing).toBe('pedestrian');
    expect(baselineBody.costing_options).toBeUndefined();
    // profile = safe costing 옵션 병합.
    expect(profileBody.costing_options.pedestrian).toBeDefined();
  });

  it('preference=fastest는 커스텀 경로 미진입 → 기존 TMAP 도보 경로(customMeta 없음)', async () => {
    // fastest는 isValhallaCustomRoute=false → Valhalla 미호출, 기존 TMAP walk.
    const { TMAP_PEDESTRIAN_RAW } = await import('../../test/fixtures/tmapPedestrian.js');
    const fetchSpy = vi
      .fn()
      .mockResolvedValue({ ok: true, json: async () => TMAP_PEDESTRIAN_RAW });
    vi.stubGlobal('fetch', fetchSpy);

    const res = await postCustomRoute(
      { stops: KR_WALK, mode: 'walk', preference: 'fastest' },
      valhallaEnv(),
    );

    expect(res.status).toBe(200);
    const route = (await res.json()) as Route & { customMeta?: RouteCustomMeta };
    // TMAP 1회 호출(Valhalla 2-call 아님), customMeta 없음(하위호환).
    expect(fetchSpy.mock.calls[0]![0]).toContain('tmap');
    expect(route.customMeta).toBeUndefined();
  });

  it('Valhalla 컨테이너 다운(fetch reject) → null 폴백 → 기존 TMAP 도보로 폴백(silent 아님)', async () => {
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const { TMAP_PEDESTRIAN_RAW } = await import('../../test/fixtures/tmapPedestrian.js');
    // 첫 호출(Valhalla)은 reject, 폴백 TMAP 호출은 성공.
    let call = 0;
    const fetchSpy = vi.fn().mockImplementation(async () => {
      call += 1;
      if (call === 1) throw new Error('ECONNREFUSED');
      return { ok: true, json: async () => TMAP_PEDESTRIAN_RAW };
    });
    vi.stubGlobal('fetch', fetchSpy);

    const res = await postCustomRoute(
      { stops: KR_WALK, mode: 'walk', preference: 'safe', maxExtraMinutes: 10 },
      valhallaEnv(),
    );

    // 컨테이너 다운이 silent 실패가 아님 — 로깅 후 TMAP 폴백으로 200.
    expect(errSpy).toHaveBeenCalled();
    expect(res.status).toBe(200);
    const route = (await res.json()) as Route & { customMeta?: RouteCustomMeta };
    expect(route.legs[0]!.mode).toBe('walk');
    expect(route.customMeta).toBeUndefined(); // 폴백 TMAP 경로는 메타 없음.
    errSpy.mockRestore();
  });
});
