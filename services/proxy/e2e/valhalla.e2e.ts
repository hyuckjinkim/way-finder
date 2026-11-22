/**
 * D3 — 라이브 Valhalla 컨테이너 e2e (게이트 B, P4 §4 D3).
 *
 * **게이트 A(fetch-모킹)와 상호 대체 불가** — 이건 mock이 아닌 **진짜 e2e**:
 * 실행 중인 Valhalla 컨테이너에 프록시 실 모드 `POST /v1/routes`를 보내 실 `/route`
 * 응답이 정규화(precision 6)·2-call +N 필터를 거쳐 `customMeta` 포함 Route로 반환됨을
 * 검증한다. P4를 P3보다 선행한 이유가 바로 이 라이브 게이트.
 *
 * **env-gated:** `VALHALLA_URL` 미설정 시 describe.skip — CI 기본 스킵. 로컬 실행:
 *
 *   VALHALLA_URL=http://localhost:8002 \
 *     pnpm --filter @wayfinder/proxy exec vitest run --config vitest.e2e.config.ts
 *
 * fetch 모킹 없음 — 핸들러의 실 fetch가 라이브 컨테이너로 직행한다.
 */
import { describe, it, expect } from 'vitest';
import app from '../src/index.js';
import { routesPath } from '@wayfinder/shared/api';
import type { Route, RouteCustomMeta } from '@wayfinder/shared';

const VALHALLA_URL = process.env.VALHALLA_URL;
const gated = VALHALLA_URL ? describe : describe.skip;

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

/** 실 모드 + 라이브 Valhalla env (DEMO_MODE='false', 키 채워 데모 판정 회피). */
function liveEnv(): Record<string, unknown> {
  return {
    DEMO_MODE: 'false',
    KAKAO_REST_KEY: 'k', GOOGLE_PLACES_KEY: 'g', NAVER_CLIENT_ID: 'n', NAVER_CLIENT_SECRET: 's',
    KAKAO_MOBILITY_KEY: 'km', TMAP_APP_KEY: 'tm', GOOGLE_ROUTES_KEY: 'gr', MAPBOX_TOKEN: 'mb',
    VALHALLA_URL,
    CACHE: makeKV(),
  };
}

// 서울 시내 좌표 (수도권 타일 bbox 내 — 광화문↔경복궁 인근).
const SEOUL = [
  { lat: 37.5663, lng: 126.9779 },
  { lat: 37.5704, lng: 126.9921 },
];

async function postRoute(body: Record<string, unknown>): Promise<Response> {
  const req = new Request(`http://localhost${routesPath}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
  return app.fetch(req, liveEnv(), {} as ExecutionContext);
}

gated('D3 라이브 Valhalla e2e — 프록시 실 모드 → 실 /route → 정규화+필터', () => {
  it('preference=safe·N=10 → 실 컨테이너 응답이 customMeta 포함 Route로 반환된다', async () => {
    const res = await postRoute({
      stops: SEOUL,
      mode: 'walk',
      preference: 'safe',
      maxExtraMinutes: 10,
    });

    expect(res.status).toBe(200);
    const route = (await res.json()) as Route & { customMeta?: RouteCustomMeta };

    // 정규화: 실 폴리라인(precision 6)이 한국 bbox 내 좌표로 디코드됨.
    expect(route.legs.length).toBeGreaterThan(0);
    expect(route.legs[0]!.mode).toBe('walk');
    expect(route.legs[0]!.coords.length).toBeGreaterThan(1);
    const c = route.legs[0]!.coords[0]!;
    expect(c.lat).toBeGreaterThan(37);
    expect(c.lat).toBeLessThan(38);
    expect(c.lng).toBeGreaterThan(126);
    expect(c.lng).toBeLessThan(128);

    // 실 소요·거리.
    expect(route.totalDurationSec).toBeGreaterThan(0);
    expect(route.totalDistanceM).toBeGreaterThan(0);

    // 2-call +N 필터: customMeta(profile·withinBudget·baseline)가 실 산출됨.
    expect(route.customMeta).toBeDefined();
    expect(route.customMeta!.preference).toBe('safe');
    expect(typeof route.customMeta!.withinBudget).toBe('boolean');
    expect(route.customMeta!.baselineDurationSec).toBeGreaterThan(0);

    // 라이브 증거 로깅(실행 기록용).
     
    console.log(
      `[D3 live] safe N=10 → ${route.totalDurationSec.toFixed(0)}s / ${route.totalDistanceM.toFixed(0)}m, ` +
        `baseline=${route.customMeta!.baselineDurationSec?.toFixed(0)}s, withinBudget=${route.customMeta!.withinBudget}`,
    );
  });

  it('preference=walkable도 실 컨테이너에서 정규화·필터를 거친다', async () => {
    const res = await postRoute({
      stops: SEOUL,
      mode: 'walk',
      preference: 'walkable',
      maxExtraMinutes: 15,
    });
    expect(res.status).toBe(200);
    const route = (await res.json()) as Route & { customMeta?: RouteCustomMeta };
    expect(route.customMeta!.preference).toBe('walkable');
    expect(route.legs[0]!.mode).toBe('walk');
    expect(route.totalDistanceM).toBeGreaterThan(0);
  });

  // 분기 단언 (advisor): 골든 픽스처는 라이브 출력에서 캡처돼 "프로필이 실제로
  // 서로 다른 경로를 내는가"를 증명하지 못한다(costing 역전 버그가 통과한 빈틈).
  // costing 옵션이 실제로 라우팅에 영향을 줌을 더 긴 OD에서 직접 검증한다.
  it('서로 다른 프로필은 실 컨테이너에서 서로 다른 경로를 산출한다 (costing이 라우팅에 영향)', async () => {
    // 광화문↔서울역 — 도심 격자라 footway-선호(walkable)와 가로등-선호(safe)가 갈릴 여지.
    const longOD = [
      { lat: 37.5759, lng: 126.9768 },
      { lat: 37.5547, lng: 126.9707 },
    ];
    const shape = async (preference: string): Promise<string> => {
      const res = await postRoute({ stops: longOD, mode: 'walk', preference, maxExtraMinutes: 20 });
      expect(res.status).toBe(200);
      const route = (await res.json()) as Route;
      return route.legs.map((l) => `${l.coords.length}:${l.distanceM.toFixed(0)}`).join('|');
    };
    const walkable = await shape('walkable');
    const safe = await shape('safe');
    // 두 프로필이 동일 OD에서 byte-identical 경로면 costing이 무의미 → 회귀 신호.
    expect(walkable).not.toBe(safe);
    console.log(`[D3 divergence] walkable=${walkable} vs safe=${safe}`);
  });
});
