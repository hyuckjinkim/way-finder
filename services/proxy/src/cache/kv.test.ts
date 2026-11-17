/**
 * A3 — KV 캐싱 단위 테스트.
 * 캐시 히트/미스, TTL 강제, getOrSet 동작 검증.
 */
import { describe, it, expect, vi } from 'vitest';
import { cacheGet, cachePut, cacheGetOrSet } from './kv.js';
import type { KVStore } from './kv.js';
import { TTL } from '../config.js';

function makeKV(): KVStore & { _store: Map<string, { value: string; ttl?: number }> } {
  const _store = new Map<string, { value: string; ttl?: number }>();
  return {
    _store,
    async get(key: string) {
      return _store.get(key)?.value ?? null;
    },
    async put(key: string, value: string, options?: { expirationTtl?: number }) {
      _store.set(key, { value, ttl: options?.expirationTtl });
    },
  };
}

describe('cacheGet / cachePut', () => {
  it('캐시 미스 → null 반환', async () => {
    const kv = makeKV();
    const result = await cacheGet<{ x: number }>(kv, 'place', 'nonexistent');
    expect(result).toBeNull();
  });

  it('put 후 get → 동일 값 반환', async () => {
    const kv = makeKV();
    const val = { id: 'kakao:123', name: '테스트' };
    await cachePut(kv, 'place', 'test-key', val);
    const result = await cacheGet<typeof val>(kv, 'place', 'test-key');
    expect(result).toEqual(val);
  });

  it('place prefix는 24h TTL 적용', async () => {
    const kv = makeKV();
    await cachePut(kv, 'place', 'k', { x: 1 });
    const entry = kv._store.get('place:k');
    expect(entry?.ttl).toBe(TTL.PLACE);
  });

  it('blog prefix는 6h TTL 적용', async () => {
    const kv = makeKV();
    await cachePut(kv, 'blog', 'k', { x: 1 });
    const entry = kv._store.get('blog:k');
    expect(entry?.ttl).toBe(TTL.BLOG);
  });

  it('google prefix는 30일 TTL 적용', async () => {
    const kv = makeKV();
    await cachePut(kv, 'google', 'k', { x: 1 });
    const entry = kv._store.get('google:k');
    expect(entry?.ttl).toBe(TTL.GOOGLE);
  });

  it('google prefix에 더 긴 TTL을 넘겨도 30일로 cap된다', async () => {
    const kv = makeKV();
    const longerTtl = TTL.GOOGLE * 2; // 60일
    await cachePut(kv, 'google', 'k', { x: 1 }, longerTtl);
    const entry = kv._store.get('google:k');
    expect(entry?.ttl).toBe(TTL.GOOGLE); // cap
  });

  it('cacheKey 형식은 "{prefix}:{key}"', async () => {
    const kv = makeKV();
    await cachePut(kv, 'blog', 'myKey', 42);
    expect(kv._store.has('blog:myKey')).toBe(true);
  });
});

describe('cacheGetOrSet', () => {
  it('캐시 미스 → fetcher 호출 후 저장', async () => {
    const kv = makeKV();
    const fetcher = vi.fn().mockResolvedValue({ name: 'test' });
    const result = await cacheGetOrSet(kv, 'place', 'k', fetcher);
    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(result).toEqual({ name: 'test' });
    // 저장 확인
    expect(kv._store.has('place:k')).toBe(true);
  });

  it('캐시 히트 → fetcher 미호출', async () => {
    const kv = makeKV();
    await cachePut(kv, 'place', 'k', { name: 'cached' });
    const fetcher = vi.fn();
    const result = await cacheGetOrSet(kv, 'place', 'k', fetcher);
    expect(fetcher).not.toHaveBeenCalled();
    expect(result).toEqual({ name: 'cached' });
  });

  it('빈 배열(공급자 실패 폴백)은 캐시하지 않는다 — 장애가 TTL 동안 고착되지 않게', async () => {
    const kv = makeKV();
    await cacheGetOrSet(kv, 'place', 'k', vi.fn().mockResolvedValue([]));
    expect(kv._store.has('place:k')).toBe(false);
    const recovered = await cacheGetOrSet(kv, 'place', 'k', vi.fn().mockResolvedValue([{ id: 1 }]));
    expect(recovered).toEqual([{ id: 1 }]);
  });
});
