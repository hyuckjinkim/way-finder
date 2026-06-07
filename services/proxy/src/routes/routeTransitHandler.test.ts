/**
 * B2 — transit 핸들러 통합 테스트 (POST /v1/routes, mode='transit').
 * 데모 모드(키 없음)에서 mockRouteProvider 응답을 검증하고,
 * 실 모드(키 세팅 + fetch 모킹)에서 ODsay/Google raw 픽스처로 실 코드 경로를 검증한다.
 *
 * **이 실-모드 그룹이 이번 결함의 회귀 가드다:** 기존 transit 테스트가 데모 경로만
 * 밟았기 때문에 실-모드 미배선(502)이 387 테스트를 통과했다. 실-모드 fetch가 실제로
 * 호출됨을 양성 단언(toHaveBeenCalled)해 데모로의 침묵 fallback을 막는다.
 */
import { describe, it, expect, vi, afterEach } from 'vitest';
import { routesPath } from '@wayfinder/shared/api';
import { ROUTE_FIXTURE_COORDS } from '@wayfinder/shared/mocks';
import type { Route } from '@wayfinder/shared';
import app from '../index.js';
import { ODSAY_CITY_RAW, ODSAY_INTERCITY_RAW } from '../fixtures/odsayTransit.js';
import { GOOGLE_TRANSIT_RAW } from '../fixtures/googleTransit.js';

function makeKV(): KVNamespace {
  const store = new Map<string, string>();
  return {
    async get(key: string) {
      return store.get(key) ?? null;
    },
    async put(key: string, value: string) {
      store.set(key, value);
    },
  } as unknown as KVNamespace;
}

function demoEnv(): Record<string, unknown> {
  return {
    DEMO_MODE: 'auto',
    KAKAO_REST_KEY: '',
    GOOGLE_PLACES_KEY: '',
    NAVER_CLIENT_ID: '',
    NAVER_CLIENT_SECRET: '',
    KAKAO_MOBILITY_KEY: '',
    TMAP_APP_KEY: '',
    GOOGLE_ROUTES_KEY: '',
    ODSAY_API_KEY: '',
    MAPBOX_TOKEN: '',
    CACHE: makeKV(),
  };
}

/** 실 모드 env — transit 게이트는 kr=ODSAY_API_KEY, global=GOOGLE_ROUTES_KEY. */
function realEnv(): Record<string, unknown> {
  return {
    DEMO_MODE: 'false',
    KAKAO_REST_KEY: 'k',
    GOOGLE_PLACES_KEY: 'g',
    NAVER_CLIENT_ID: 'n',
    NAVER_CLIENT_SECRET: 's',
    KAKAO_MOBILITY_KEY: 'km',
    TMAP_APP_KEY: 'tm',
    GOOGLE_ROUTES_KEY: 'gr',
    ODSAY_API_KEY: 'od',
    MAPBOX_TOKEN: 'mb',
    CACHE: makeKV(),
  };
}

async function postRoutes(
  body: unknown,
  env: Record<string, unknown>,
): Promise<Response> {
  const req = new Request(`http://localhost${routesPath}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
  return app.fetch(req, env, {} as ExecutionContext);
}

const { SEOUL_A, SEOUL_B, SEOUL_C, BUSAN_DEST } = ROUTE_FIXTURE_COORDS;

describe('POST /v1/routes mode=transit — 데모 모드 leg-chaining', () => {
  it('시내 경유지(A→B→C) → leg-chaining Route(환승 포함)', async () => {
    const res = await postRoutes(
      { stops: [SEOUL_A, SEOUL_B, SEOUL_C], mode: 'transit' },
      demoEnv(),
    );
    expect(res.status).toBe(200);
    const route = (await res.json()) as Route;
    expect(route.legs.length).toBeGreaterThan(1);
    // 총 소요 = Σleg + 버퍼 (버퍼 포함이므로 leg 합보다 큼).
    const legSum = route.legs.reduce((a, l) => a + l.durationSec, 0);
    expect(route.totalDurationSec).toBeGreaterThan(legSum);
    // transit 메타가 채워진 leg가 존재.
    expect(route.legs.some((l) => l.transit?.lineName)).toBe(true);
  });

  it('시외(서울→부산) → 3단 스티칭 Route (train leg 포함)', async () => {
    const res = await postRoutes(
      { stops: [SEOUL_A, BUSAN_DEST], mode: 'transit' },
      demoEnv(),
    );
    expect(res.status).toBe(200);
    const route = (await res.json()) as Route;
    expect(route.legs.length).toBe(3);
    expect(route.legs.some((l) => l.transit?.lineType === 'train')).toBe(true);
  });

  it('잘못된 stops 길이 → 400', async () => {
    const res = await postRoutes({ stops: [SEOUL_A], mode: 'transit' }, demoEnv());
    expect(res.status).toBe(400);
  });
});

// 글로벌 좌표(뉴욕) — routeRegion='global' → Google transit 경로.
const NYC_A = { lat: 40.7128, lng: -74.006 };
const NYC_B = { lat: 40.73, lng: -73.99 };

describe('POST /v1/routes mode=transit — 실 모드 (fetch 모킹)', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('kr 시내(A→B→C) → ODsay 구간별 탐색 + leg-chaining (실 fetch 호출됨)', async () => {
    const fetchSpy = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ODSAY_CITY_RAW,
    });
    vi.stubGlobal('fetch', fetchSpy);

    const res = await postRoutes(
      { stops: [SEOUL_A, SEOUL_B, SEOUL_C], mode: 'transit' },
      realEnv(),
    );
    expect(res.status).toBe(200);
    // 양성 단언: 실 ODsay fetch가 실제로 호출됨 (데모로 침묵 fallback 아님).
    expect(fetchSpy).toHaveBeenCalled();
    // 인접 구간 2개(A→B, B→C) → 구간당 1회 호출.
    expect(fetchSpy.mock.calls.length).toBe(2);
    // ODsay 엔드포인트 + apiKey가 요청에 붙어야 함 (키 누락 시 데모로 침묵 fallback 방지).
    expect(String(fetchSpy.mock.calls[0]![0])).toContain('odsay.com');
    expect(String(fetchSpy.mock.calls[0]![0])).toContain('apiKey=od');

    const route = (await res.json()) as Route;
    // 두 구간(각 3 subPath) 합성 → 6 leg, transit 메타 존재.
    expect(route.legs.length).toBe(6);
    expect(route.legs.some((l) => l.transit?.lineName)).toBe(true);
    // 버퍼 포함이므로 leg 합보다 큼.
    const legSum = route.legs.reduce((a, l) => a + l.durationSec, 0);
    expect(route.totalDurationSec).toBeGreaterThan(legSum);
  });

  it('kr 시외(서울→부산) → ODsay 도시간 탐색 + train 승격 스티칭 (실 fetch 호출됨)', async () => {
    const fetchSpy = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ODSAY_INTERCITY_RAW,
    });
    vi.stubGlobal('fetch', fetchSpy);

    const res = await postRoutes(
      { stops: [SEOUL_A, BUSAN_DEST], mode: 'transit' },
      realEnv(),
    );
    expect(res.status).toBe(200);
    expect(fetchSpy).toHaveBeenCalled();

    const route = (await res.json()) as Route;
    // 도시간 단일 구간 → train으로 승격됨.
    expect(route.legs.some((l) => l.transit?.lineType === 'train')).toBe(true);
  });

  it('global(뉴욕) → Google Routes(TRANSIT) 탐색 + 정규화 (실 fetch 호출됨)', async () => {
    const fetchSpy = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => GOOGLE_TRANSIT_RAW,
    });
    vi.stubGlobal('fetch', fetchSpy);

    const res = await postRoutes(
      { stops: [NYC_A, NYC_B], mode: 'transit' },
      realEnv(),
    );
    expect(res.status).toBe(200);
    expect(fetchSpy).toHaveBeenCalled();
    expect(String(fetchSpy.mock.calls[0]![0])).toContain('routes.googleapis.com');

    const route = (await res.json()) as Route;
    // WALK→SUBWAY→BUS 3 step → 3 leg.
    expect(route.legs.length).toBe(3);
    expect(route.legs.some((l) => l.transit?.lineType === 'subway')).toBe(true);
  });

  it('실 모드 공급자 fetch 실패 → 502 (silent 아님, 에러 로깅)', async () => {
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('odsay down')));

    const res = await postRoutes(
      { stops: [SEOUL_A, SEOUL_C], mode: 'transit' },
      realEnv(),
    );
    expect(res.status).toBe(502);
    expect(errSpy).toHaveBeenCalled();
    errSpy.mockRestore();
  });

  it('실 모드 공급자 non-2xx → 502', async () => {
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 500, json: async () => ({}) }));

    const res = await postRoutes(
      { stops: [NYC_A, NYC_B], mode: 'transit' },
      realEnv(),
    );
    expect(res.status).toBe(502);
    errSpy.mockRestore();
  });
});
