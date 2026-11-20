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
import {
  KAKAO_TRANSIT_RAW,
  KAKAO_TRANSIT_NO_RESULTS,
  fakeQuotaNamespace,
} from '../fixtures/kakaoTransit.js';
import { KAKAO_TRANSIT_DAILY_CAP, kstDate } from '../quota/transitQuota.js';
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

/** 실 모드 env — transit 게이트는 kr=KAKAO_REST_KEY(카카오 대중교통), global=GOOGLE_ROUTES_KEY. */
function realEnv(quota = new Map<string, unknown>()): Record<string, unknown> {
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
    KAKAO_TRANSIT_QUOTA: fakeQuotaNamespace(quota),
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

const kakaoOk = () => vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => KAKAO_TRANSIT_RAW });
const usage = (m: Map<string, unknown>) => (m.get('usage') as { count: number } | undefined)?.count ?? 0;

describe('POST /v1/routes mode=transit — kr 카카오 대중교통', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('2지점 → 카카오 1회(REST 키 헤더) + 주 경로·대안, 카운터 1 소비', async () => {
    const fetchSpy = kakaoOk();
    vi.stubGlobal('fetch', fetchSpy);
    const quota = new Map<string, unknown>();
    const res = await postRoutes({ stops: [SEOUL_A, SEOUL_C], mode: 'transit' }, realEnv(quota));
    expect(res.status).toBe(200);
    expect(fetchSpy).toHaveBeenCalledTimes(1);
    const [url, init] = fetchSpy.mock.calls[0]!;
    expect(String(url)).toContain('dapi.kakao.com/v2/routing/publictraffic');
    expect((init as RequestInit).headers).toMatchObject({ Authorization: 'KakaoAK k' });
    const route = (await res.json()) as Route;
    expect(route.totalDurationSec).toBe(2083);
    expect(route.alternatives?.length).toBe(3);
    expect(usage(quota)).toBe(1);
  });

  it('경유지(A→B→C) → 구간당 1회, 총 = Σ구간 totalTime + 구간 사이 버퍼, 카운터 2', async () => {
    const fetchSpy = kakaoOk();
    vi.stubGlobal('fetch', fetchSpy);
    const quota = new Map<string, unknown>();
    const res = await postRoutes({ stops: [SEOUL_A, SEOUL_B, SEOUL_C], mode: 'transit' }, realEnv(quota));
    expect(res.status).toBe(200);
    expect(fetchSpy).toHaveBeenCalledTimes(2);
    const route = (await res.json()) as Route;
    expect(route.totalDurationSec).toBe(2083 * 2 + 300);
    expect(route.fare).toBe(3300);
    expect(usage(quota)).toBe(2);
  });

  it('캐시 히트는 카카오·카운터를 소비하지 않는다', async () => {
    const fetchSpy = kakaoOk();
    vi.stubGlobal('fetch', fetchSpy);
    const quota = new Map<string, unknown>();
    const env = realEnv(quota);
    await postRoutes({ stops: [SEOUL_A, SEOUL_C], mode: 'transit' }, env);
    const res = await postRoutes({ stops: [SEOUL_A, SEOUL_C], mode: 'transit' }, env);
    expect(res.status).toBe(200);
    expect(fetchSpy).toHaveBeenCalledTimes(1);
    expect(usage(quota)).toBe(1);
  });

  it('일일 상한 도달 → 429 quota, 카카오 미호출', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const fetchSpy = kakaoOk();
    vi.stubGlobal('fetch', fetchSpy);
    const quota = new Map<string, unknown>([['usage', { date: kstDate(Date.now()), count: KAKAO_TRANSIT_DAILY_CAP }]]);
    const res = await postRoutes({ stops: [SEOUL_A, SEOUL_C], mode: 'transit' }, realEnv(quota));
    expect(res.status).toBe(429);
    expect(await res.json()).toMatchObject({ code: 'quota' });
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('카운터 바인딩 없음 → fail-closed 429 quota', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const fetchSpy = kakaoOk();
    vi.stubGlobal('fetch', fetchSpy);
    const env = { ...realEnv(), KAKAO_TRANSIT_QUOTA: undefined };
    const res = await postRoutes({ stops: [SEOUL_A, SEOUL_C], mode: 'transit' }, env);
    expect(res.status).toBe(429);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('카카오 429 → 429 quota (시도도 카운트)', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 429, json: async () => ({ code: -10 }) }));
    const quota = new Map<string, unknown>();
    const res = await postRoutes({ stops: [SEOUL_A, SEOUL_C], mode: 'transit' }, realEnv(quota));
    expect(res.status).toBe(429);
    expect(await res.json()).toMatchObject({ code: 'quota' });
    expect(usage(quota)).toBe(1);
  });

  it('NO_RESULTS → 422 no_route', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => KAKAO_TRANSIT_NO_RESULTS }));
    const res = await postRoutes({ stops: [SEOUL_A, SEOUL_C], mode: 'transit' }, realEnv());
    expect(res.status).toBe(422);
    expect(await res.json()).toMatchObject({ code: 'no_route' });
  });

  it('700m 미만 → 422 too_close, 카카오·카운터 미사용', async () => {
    const fetchSpy = kakaoOk();
    vi.stubGlobal('fetch', fetchSpy);
    const quota = new Map<string, unknown>();
    const near = { lat: SEOUL_A.lat + 0.003, lng: SEOUL_A.lng };
    const res = await postRoutes({ stops: [SEOUL_A, near], mode: 'transit' }, realEnv(quota));
    expect(res.status).toBe(422);
    expect(await res.json()).toMatchObject({ code: 'too_close' });
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(usage(quota)).toBe(0);
  });

  it('시외(서울→부산) → 422 no_route, 카카오 미호출 (카카오는 시내만)', async () => {
    const fetchSpy = kakaoOk();
    vi.stubGlobal('fetch', fetchSpy);
    const res = await postRoutes({ stops: [SEOUL_A, BUSAN_DEST], mode: 'transit' }, realEnv());
    expect(res.status).toBe(422);
    expect(await res.json()).toMatchObject({ code: 'no_route' });
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('fetch 실패 → 502 upstream (에러 로깅)', async () => {
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('kakao down')));
    const res = await postRoutes({ stops: [SEOUL_A, SEOUL_C], mode: 'transit' }, realEnv());
    expect(res.status).toBe(502);
    expect(await res.json()).toMatchObject({ code: 'upstream' });
    expect(errSpy).toHaveBeenCalled();
  });
});
