/**
 * A2 다이렉트 라우팅 통합 테스트 — POST /v1/routes (차·도보·자전거).
 *
 * index.test.ts 패턴: app.fetch(req, env, ctx) + vi.stubGlobal('fetch').
 * 데모 모드(키 없음)와 실 모드(fetch 모킹) × 지역(kr/global) × 모드 커버.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import app from '../index.js';
import { routesPath } from '@wayfinder/shared/api';
import type { Route } from '@wayfinder/shared';

import { KAKAO_MOBILITY_WAYPOINT_RAW } from '../../test/fixtures/kakaoMobility.js';
import { TMAP_PEDESTRIAN_RAW } from '../../test/fixtures/tmapPedestrian.js';
import { TMAP_BIKE_RAW } from '../../test/fixtures/tmapBike.js';
import { GOOGLE_ROUTES_SIMPLE_RAW } from '../../test/fixtures/googleRoutes.js';

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

/** 데모 모드 env (라우팅 키 없음). */
function demoEnv(): Record<string, unknown> {
  return {
    DEMO_MODE: 'auto',
    KAKAO_REST_KEY: '', GOOGLE_PLACES_KEY: '', NAVER_CLIENT_ID: '', NAVER_CLIENT_SECRET: '',
    KAKAO_MOBILITY_KEY: '', TMAP_APP_KEY: '', GOOGLE_ROUTES_KEY: '', MAPBOX_TOKEN: '',
    CACHE: makeKV(),
  };
}

/** 실 모드 env (라우팅 키 세팅, fetch 모킹). */
function realEnv(): Record<string, unknown> {
  return {
    DEMO_MODE: 'false',
    KAKAO_REST_KEY: 'k', GOOGLE_PLACES_KEY: 'g', NAVER_CLIENT_ID: 'n', NAVER_CLIENT_SECRET: 's',
    KAKAO_MOBILITY_KEY: 'km', TMAP_APP_KEY: 'tm', GOOGLE_ROUTES_KEY: 'gr', MAPBOX_TOKEN: 'mb',
    CACHE: makeKV(),
  };
}

// 좌표: 한국(서울) / 글로벌(뉴욕)
const KR = [{ lat: 37.5563, lng: 126.9723 }, { lat: 37.5665, lng: 126.978 }];
const KR_WAYPOINT = [
  { lat: 37.5563, lng: 126.9723 },
  { lat: 37.5512, lng: 126.9882 },
  { lat: 37.5665, lng: 126.978 },
];
const GLOBAL = [{ lat: 40.7128, lng: -74.006 }, { lat: 40.73, lng: -73.99 }];

async function postRoute(stops: unknown, mode: string, env: Record<string, unknown>): Promise<Response> {
  const req = new Request(`http://localhost${routesPath}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ stops, mode }),
  });
  return app.fetch(req, env, {} as ExecutionContext);
}

// ── 데모 모드 (키 없음 — mock provider) ─────────────────────────────────────
describe('POST /v1/routes — 데모 모드', () => {
  it('car: 200 + Route', async () => {
    const res = await postRoute(KR_WAYPOINT, 'car', demoEnv());
    expect(res.status).toBe(200);
    const route = (await res.json()) as Route;
    expect(Array.isArray(route.legs)).toBe(true);
    expect(route.legs.length).toBeGreaterThan(0);
  });

  it('walk: 200 + Route', async () => {
    const res = await postRoute(KR, 'walk', demoEnv());
    expect(res.status).toBe(200);
    const route = (await res.json()) as Route;
    expect(route.legs[0]!.mode).toBe('walk');
  });

  it('bike: 200 + Route', async () => {
    const res = await postRoute(KR, 'bike', demoEnv());
    expect(res.status).toBe(200);
    const route = (await res.json()) as Route;
    expect(route.legs[0]!.mode).toBe('bike');
  });

  it('데모 모드는 실 fetch를 호출하지 않는다', async () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal('fetch', fetchSpy);
    await postRoute(KR, 'car', demoEnv());
    expect(fetchSpy).not.toHaveBeenCalled();
    vi.unstubAllGlobals();
  });
});

// ── 실 모드 한국 (카카오모빌리티 / TMAP) ────────────────────────────────────
describe('POST /v1/routes — 실 모드 한국', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('car kr → 카카오모빌리티 정규화 (2 leg)', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true, json: async () => KAKAO_MOBILITY_WAYPOINT_RAW,
    }));
    const res = await postRoute(KR_WAYPOINT, 'car', realEnv());
    expect(res.status).toBe(200);
    const route = (await res.json()) as Route;
    expect(route.legs).toHaveLength(2);
    expect(route.legs.every((l) => l.mode === 'car')).toBe(true);
  });

  it('walk kr → TMAP 보행자 정규화', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true, json: async () => TMAP_PEDESTRIAN_RAW,
    }));
    const res = await postRoute(KR, 'walk', realEnv());
    expect(res.status).toBe(200);
    const route = (await res.json()) as Route;
    expect(route.legs[0]!.mode).toBe('walk');
  });

  it('bike kr → TMAP 자전거 정규화', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true, json: async () => TMAP_BIKE_RAW,
    }));
    const res = await postRoute(KR, 'bike', realEnv());
    expect(res.status).toBe(200);
    const route = (await res.json()) as Route;
    expect(route.legs[0]!.mode).toBe('bike');
  });
});

// ── 실 모드 글로벌 (Google Routes) ──────────────────────────────────────────
describe('POST /v1/routes — 실 모드 글로벌', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('car global → Google Routes 정규화 + 디코드', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true, json: async () => GOOGLE_ROUTES_SIMPLE_RAW,
    }));
    const res = await postRoute(GLOBAL, 'car', realEnv());
    expect(res.status).toBe(200);
    const route = (await res.json()) as Route;
    expect(route.legs[0]!.mode).toBe('car');
    expect(route.legs[0]!.coords.length).toBeGreaterThan(1);
  });

  it('walk global → Google Routes (WALK)', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true, json: async () => GOOGLE_ROUTES_SIMPLE_RAW,
    }));
    const res = await postRoute(GLOBAL, 'walk', realEnv());
    expect(res.status).toBe(200);
    const route = (await res.json()) as Route;
    expect(route.legs[0]!.mode).toBe('walk');
  });
});

// ── 입력 검증 (A3) ──────────────────────────────────────────────────────────
describe('POST /v1/routes — 입력 검증', () => {
  it('stops 1개 → 400', async () => {
    const res = await postRoute([KR[0]], 'car', demoEnv());
    expect(res.status).toBe(400);
  });

  it('stops 7개 → 400 (경유지 ≤5)', async () => {
    const seven = Array.from({ length: 7 }, () => ({ lat: 37.5, lng: 127.0 }));
    const res = await postRoute(seven, 'car', demoEnv());
    expect(res.status).toBe(400);
  });

  it('알 수 없는 mode → 400', async () => {
    const res = await postRoute(KR, 'rocket', demoEnv());
    expect(res.status).toBe(400);
  });

  it('잘못된 좌표 → 400', async () => {
    const res = await postRoute([{ lat: 999, lng: 0 }, KR[1]], 'car', demoEnv());
    expect(res.status).toBe(400);
  });

  it('JSON 깨짐 → 400', async () => {
    const req = new Request(`http://localhost${routesPath}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: '{not json',
    });
    const res = await app.fetch(req, demoEnv(), {} as ExecutionContext);
    expect(res.status).toBe(400);
  });
});

// ── 장애 격리 (공급자 실패 → 명시적 502, silent 금지) ──────────────────────
describe('POST /v1/routes — 장애 격리', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('공급자 fetch 실패 → 502 (silent 아님)', async () => {
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('network down')));
    const res = await postRoute(KR, 'car', realEnv());
    expect(res.status).toBe(502);
    const body = (await res.json()) as { error: string };
    expect(body.error).toContain('failed');
    expect(errSpy).toHaveBeenCalled(); // 에러 로깅됨
    errSpy.mockRestore();
  });

  it('공급자 non-2xx → 502', async () => {
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 500, json: async () => ({}) }));
    const res = await postRoute(GLOBAL, 'car', realEnv());
    expect(res.status).toBe(502);
    errSpy.mockRestore();
  });
});
