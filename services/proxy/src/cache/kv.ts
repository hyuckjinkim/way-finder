/**
 * A3 — Workers KV 캐싱 헬퍼.
 *
 * TTL 정책:
 * - 블로그: 6h
 * - 장소 기본정보: 24h
 * - 구글 Places 데이터: 30일 한도 강제 (약관 §6)
 *
 * 캐시 키 형식: "{prefix}:{stableKey}"
 */
import { TTL } from '../config.js';

/** KV 네임스페이스 인터페이스 (Cloudflare Workers 환경 또는 테스트 mock) */
export interface KVStore {
  get(key: string): Promise<string | null>;
  put(key: string, value: string, options?: { expirationTtl?: number }): Promise<void>;
}

export type CachePrefix = 'place' | 'google' | 'blog';

/** 응답 경로에서 put을 미루는 훅 (예: ctx.waitUntil). 없으면 put을 await한다(테스트·로컬). */
export type Defer = (p: Promise<unknown>) => void;

/** Hono 컨텍스트에서 waitUntil 기반 Defer를 만든다. ExecutionContext가 없으면 undefined. */
export function deferFrom(c: { executionCtx: ExecutionContext }): Defer | undefined {
  try {
    const ctx = c.executionCtx;
    return typeof ctx?.waitUntil === 'function' ? (p) => ctx.waitUntil(p) : undefined;
  } catch {
    return undefined; // Hono: ExecutionContext 없는 환경은 getter가 throw
  }
}

/** 키 정규화 — 공백 trim·연속 공백 축약·소문자 (대소문자·공백 차이로 인한 키 분산 방지). */
export function normalizeKey(key: string): string {
  return key.trim().replace(/\s+/g, ' ').toLowerCase();
}

function cacheKey(prefix: CachePrefix, key: string): string {
  return `${prefix}:${normalizeKey(key)}`;
}

function ttlForPrefix(prefix: CachePrefix): number {
  switch (prefix) {
    case 'place': return TTL.PLACE;
    case 'google': return TTL.GOOGLE;
    case 'blog': return TTL.BLOG;
  }
}

/**
 * 캐시에서 값을 읽어 JSON으로 파싱한다.
 * 캐시 미스 또는 파싱 실패 시 null을 반환한다.
 */
export async function cacheGet<T>(
  kv: KVStore,
  prefix: CachePrefix,
  key: string,
): Promise<T | null> {
  try {
    const raw = await kv.get(cacheKey(prefix, key));
    if (raw === null) return null;
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

/**
 * 값을 JSON으로 직렬화해 캐시에 저장한다.
 * prefix에 따른 TTL을 자동 적용한다.
 *
 * 구글 데이터는 30일 TTL 한도가 강제되어 있어, 호출자가 더 긴 TTL을 지정해도
 * TTL.GOOGLE(30일)로 cap된다.
 */
export async function cachePut<T>(
  kv: KVStore,
  prefix: CachePrefix,
  key: string,
  value: T,
  overrideTtl?: number,
  defer?: Defer,
): Promise<void> {
  const maxTtl = ttlForPrefix(prefix);
  const ttl = overrideTtl !== undefined ? Math.min(overrideTtl, maxTtl) : maxTtl;
  // put 실패(KV 일일 쓰기 쿼터 초과 등)가 응답을 깨뜨리면 안 된다 — 캐시는 best-effort.
  const write = Promise.resolve()
    .then(() => kv.put(cacheKey(prefix, key), JSON.stringify(value), { expirationTtl: ttl }))
    .catch((err) => console.error('[cache] put failed:', err));
  if (defer) defer(write);
  else await write;
}

/**
 * 캐시 히트 시 캐시값을 반환, 미스 시 fetcher를 실행하고 결과를 캐시에 저장한다.
 */
export async function cacheGetOrSet<T>(
  kv: KVStore,
  prefix: CachePrefix,
  key: string,
  fetcher: () => Promise<T>,
  defer?: Defer,
): Promise<T> {
  const cached = await cacheGet<T>(kv, prefix, key);
  if (cached !== null) return cached;
  const value = await fetcher();
  // null/undefined(미존재)는 캐시하지 않는다 — 404가 TTL 동안 고착되는 것 방지.
  if (value == null) return value;
  // 빈 배열은 캐시하지 않는다 — fetchWithFallback이 공급자 실패를 []로 대체하므로, 캐시하면 장애가 TTL(최대 24h) 동안 고착된다.
  // ponytail: 정상 "결과 없음"도 매번 재조회 — 쿼터가 문제 되면 실패/빈결과를 구분하는 sentinel로 교체.
  if (!(Array.isArray(value) && value.length === 0)) await cachePut(kv, prefix, key, value, undefined, defer);
  return value;
}
