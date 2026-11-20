/**
 * 대중교통 경로 캐시(쿼터 DO 저장) 단위 테스트.
 * 키 결정론·라운드트립·TTL 만료·만료 항목 정리·캐시 경로가 예약을 소비하지 않음을 검증.
 */
import { describe, it, expect } from 'vitest';
import type { RouteRequest, Route } from '@wayfinder/shared';
import { routeCacheKey, getCachedRoute, putCachedRoute } from './routeCache.js';
import { ROUTE_CACHE_TTL_MS } from '../quota/transitQuota.js';
import { fakeQuotaNamespace } from '../fixtures/kakaoTransit.js';

const REQ: RouteRequest = {
  stops: [
    { lat: 37.5563, lng: 126.9723 },
    { lat: 37.5665, lng: 126.978 },
  ],
  mode: 'transit',
};

const ROUTE: Route = {
  legs: [
    {
      start: REQ.stops[0]!,
      end: REQ.stops[1]!,
      mode: 'transit',
      durationSec: 600,
      distanceM: 3000,
      coords: [REQ.stops[0]!, REQ.stops[1]!],
      transit: { lineName: '4호선', lineType: 'subway' },
    },
  ],
  totalDurationSec: 600,
  totalDistanceM: 3000,
};

describe('routeCacheKey — 결정론', () => {
  it('같은 요청은 같은 키', () => {
    expect(routeCacheKey(REQ)).toBe(routeCacheKey({ ...REQ, stops: [...REQ.stops] }));
  });

  it('부동소수 표현차가 있어도 같은 키 (반올림)', () => {
    const a = routeCacheKey(REQ);
    const jittered: RouteRequest = {
      ...REQ,
      stops: [
        { lat: 37.556300001, lng: 126.972300001 },
        { lat: 37.5665, lng: 126.978 },
      ],
    };
    expect(routeCacheKey(jittered)).toBe(a);
  });

  it('mode가 다르면 다른 키', () => {
    expect(routeCacheKey({ ...REQ, mode: 'walk' })).not.toBe(routeCacheKey(REQ));
  });

  it('stops 순서가 다르면 다른 키 (방향 의미 보존)', () => {
    const reversed: RouteRequest = { ...REQ, stops: [...REQ.stops].reverse() };
    expect(routeCacheKey(reversed)).not.toBe(routeCacheKey(REQ));
  });

  it('키에 transit 네임스페이스 프리픽스를 포함한다', () => {
    expect(routeCacheKey(REQ)).toContain('route:transit:transit:');
  });
});

describe('get/put 라운드트립 (DO)', () => {
  it('put 후 get이 동일 Route를 반환, 예약 카운터는 건드리지 않음', async () => {
    const storage = new Map<string, unknown>();
    const ns = fakeQuotaNamespace(storage);
    expect(await getCachedRoute(ns, REQ)).toBeNull();
    await putCachedRoute(ns, REQ, ROUTE);
    expect(await getCachedRoute(ns, REQ)).toEqual(ROUTE);
    expect(storage.has('usage')).toBe(false);
  });

  it('TTL(15분)이 지나면 미스, put 시 만료 항목을 정리', async () => {
    const storage = new Map<string, unknown>();
    let now = 1_000_000;
    const ns = fakeQuotaNamespace(storage, () => now);
    await putCachedRoute(ns, REQ, ROUTE);
    now += ROUTE_CACHE_TTL_MS - 1;
    expect(await getCachedRoute(ns, REQ)).toEqual(ROUTE);
    now += 1;
    expect(await getCachedRoute(ns, REQ)).toBeNull();
    const other: RouteRequest = { ...REQ, stops: [...REQ.stops].reverse() };
    await putCachedRoute(ns, other, ROUTE);
    expect(storage.has(routeCacheKey(REQ))).toBe(false);
    expect(storage.has(routeCacheKey(other))).toBe(true);
  });

  it('바인딩 없음 → 미스, put은 조용히 무시', async () => {
    expect(await getCachedRoute(undefined, REQ)).toBeNull();
    await expect(putCachedRoute(undefined, REQ, ROUTE)).resolves.toBeUndefined();
  });

  it('DO는 알 수 없는 경로·프리픽스 밖 키를 거부한다 (예약 없음)', async () => {
    const storage = new Map<string, unknown>();
    const stub = fakeQuotaNamespace(storage).get({} as DurableObjectId);
    expect((await stub.fetch('https://quota/other', { method: 'POST' })).status).toBe(404);
    expect((await stub.fetch('https://quota/route?key=usage', { method: 'PUT', body: '{}' })).status).toBe(400);
    expect(storage.size).toBe(0);
  });
});
