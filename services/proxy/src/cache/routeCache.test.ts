/**
 * B4 — 대중교통 경로 KV 캐싱 단위 테스트.
 * 키 결정론·캐시 히트 시 fetcher 미실행(쿼터 방어)·TTL 검증.
 */
import { describe, it, expect, vi } from 'vitest';
import type { RouteRequest, Route } from '@wayfinder/shared';
import type { KVStore } from './kv.js';
import {
  routeCacheKey,
  getCachedRoute,
  putCachedRoute,
  getOrFetchRoute,
  ROUTE_CACHE_TTL,
} from './routeCache.js';

/** 인메모리 KVStore 목 (TTL 기록). */
function makeKV(): KVStore & { ttls: Map<string, number | undefined> } {
  const store = new Map<string, string>();
  const ttls = new Map<string, number | undefined>();
  return {
    ttls,
    async get(key: string) {
      return store.get(key) ?? null;
    },
    async put(key: string, value: string, options?: { expirationTtl?: number }) {
      store.set(key, value);
      ttls.set(key, options?.expirationTtl);
    },
  };
}

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

describe('get/put 라운드트립', () => {
  it('put 후 get이 동일 Route를 반환', async () => {
    const kv = makeKV();
    expect(await getCachedRoute(kv, REQ)).toBeNull();
    await putCachedRoute(kv, REQ, ROUTE);
    expect(await getCachedRoute(kv, REQ)).toEqual(ROUTE);
  });

  it('put은 ROUTE_CACHE_TTL을 적용한다', async () => {
    const kv = makeKV();
    await putCachedRoute(kv, REQ, ROUTE);
    expect(kv.ttls.get(routeCacheKey(REQ))).toBe(ROUTE_CACHE_TTL);
  });
});

describe('getOrFetchRoute — ODsay 쿼터 방어', () => {
  it('캐시 미스면 fetcher 실행 + 저장', async () => {
    const kv = makeKV();
    const fetcher = vi.fn(async () => ROUTE);
    const out = await getOrFetchRoute(kv, REQ, fetcher);
    expect(out).toEqual(ROUTE);
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it('캐시 히트면 fetcher 미실행 (실 ODsay 호출 0)', async () => {
    const kv = makeKV();
    await putCachedRoute(kv, REQ, ROUTE);
    const fetcher = vi.fn(async () => ROUTE);
    const out = await getOrFetchRoute(kv, REQ, fetcher);
    expect(out).toEqual(ROUTE);
    expect(fetcher).not.toHaveBeenCalled();
  });
});
