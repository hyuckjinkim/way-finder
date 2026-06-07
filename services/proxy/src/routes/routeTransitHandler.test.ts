/**
 * B2 — transit 핸들러 통합 테스트 (POST /v1/routes, mode='transit').
 * 데모 모드(키 없음)에서 mockRouteProvider 응답을 검증한다 — 실 fetch 미발생.
 */
import { describe, it, expect } from 'vitest';
import { routesPath } from '@wayfinder/shared/api';
import { ROUTE_FIXTURE_COORDS } from '@wayfinder/shared/mocks';
import type { Route } from '@wayfinder/shared';
import app from '../index.js';

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
    MAPBOX_TOKEN: '',
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
