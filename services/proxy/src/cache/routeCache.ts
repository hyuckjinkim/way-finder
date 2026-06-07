/**
 * B4 — 대중교통 경로 KV 캐싱 (§11 ODsay 일 1,000건 쿼터 방어).
 *
 * 자기완결(self-contained): `kv.ts`의 `CachePrefix`는 닫힌 유니온('place'|'google'|'blog')
 * 이고 `config.ts`는 본 스트림 경계 밖이라, 여기서 `KVStore` **타입만** 재사용하고
 * 키 정규화·TTL·get/set을 자체 정의한다 (CachePrefix 확장·config TTL 추가 금지).
 *
 * 캐시 키는 (stops, mode)에서 결정론적으로 생성한다 — 좌표를 고정 소수 자리로 반올림해
 * 부동소수 표현 차이로 인한 키 분산을 막고, 같은 요청이 같은 키로 수렴하게 한다.
 */
import type { LatLng, RouteRequest, Route } from '@wayfinder/shared';
import type { KVStore } from './kv.js';

/** 대중교통 경로 캐시 TTL(초). ODsay 데이터 변동성·쿼터 균형 — 6h. */
export const ROUTE_CACHE_TTL = 6 * 60 * 60;

/** 캐시 키 좌표 반올림 소수 자리 (≈11m 해상도 — 동일 정류장 요청 수렴). */
const COORD_PRECISION = 5;

/** 캐시 키 프리픽스 (kv.ts CachePrefix와 별개 네임스페이스). */
const ROUTE_KEY_PREFIX = 'route:transit';

/** 좌표를 고정 소수 자리 문자열로 — 부동소수 표현차로 인한 키 분산 방지. */
function coordKey(c: LatLng): string {
  return `${c.lat.toFixed(COORD_PRECISION)},${c.lng.toFixed(COORD_PRECISION)}`;
}

/**
 * (stops, mode)에서 결정론적 캐시 키를 만든다.
 * stops 순서는 의미가 있으므로 보존한다 (역순 경로는 다른 키).
 */
export function routeCacheKey(req: RouteRequest): string {
  const stops = req.stops.map(coordKey).join('|');
  return `${ROUTE_KEY_PREFIX}:${req.mode}:${stops}`;
}

/**
 * 캐시에서 경로를 읽는다. 미스 또는 파싱 실패 시 null.
 */
export async function getCachedRoute(
  kv: KVStore,
  req: RouteRequest,
): Promise<Route | null> {
  try {
    const raw = await kv.get(routeCacheKey(req));
    if (raw === null) return null;
    return JSON.parse(raw) as Route;
  } catch {
    return null;
  }
}

/**
 * 경로를 캐시에 저장한다 (TTL=ROUTE_CACHE_TTL).
 */
export async function putCachedRoute(
  kv: KVStore,
  req: RouteRequest,
  route: Route,
): Promise<void> {
  await kv.put(routeCacheKey(req), JSON.stringify(route), {
    expirationTtl: ROUTE_CACHE_TTL,
  });
}

/**
 * 캐시 히트면 캐시값을, 미스면 fetcher 실행 후 캐시에 저장하고 반환한다.
 * ODsay 쿼터 방어 핵심 — 히트 시 fetcher(실 ODsay 호출)가 실행되지 않는다.
 */
export async function getOrFetchRoute(
  kv: KVStore,
  req: RouteRequest,
  fetcher: () => Promise<Route>,
): Promise<Route> {
  const cached = await getCachedRoute(kv, req);
  if (cached !== null) return cached;
  const route = await fetcher();
  await putCachedRoute(kv, req, route);
  return route;
}
