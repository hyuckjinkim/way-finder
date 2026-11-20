/**
 * kr 대중교통 경로 캐시 (TTL 15분) — 카카오 대중교통 일일 상한(950) 재탐색 방어.
 *
 * 저장소는 KV가 아니라 쿼터 Durable Object(SQLite)다: KV 무료 쓰기 1,000/일은 장소·구글·블로그
 * 캐시 몫으로 남긴다. (caches.default는 workers.dev에서 동작하지 않아 제외.)
 * best-effort: 바인딩 없음·DO 오류는 캐시 미스로, put 실패는 로그만 — 응답을 깨지 않는다.
 *
 * 캐시 키는 (stops, mode)에서 결정론적으로 생성한다 — 좌표를 고정 소수 자리로 반올림해
 * 부동소수 표현 차이로 인한 키 분산을 막고, 같은 요청이 같은 키로 수렴하게 한다.
 */
import type { LatLng, RouteRequest, Route } from '@wayfinder/shared';
import type { Defer } from './kv.js';
import { ROUTE_KEY_PREFIX, transitStub } from '../quota/transitQuota.js';

/** 캐시 키 좌표 반올림 소수 자리 (≈11m 해상도 — 같은 장소 재탐색 수렴). */
const COORD_PRECISION = 4;

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
  return `${ROUTE_KEY_PREFIX}transit:${req.mode}:${stops}`;
}

const routeUrl = (req: RouteRequest) =>
  `https://quota/route?key=${encodeURIComponent(routeCacheKey(req))}`;

/** 캐시에서 경로를 읽는다. 미스·바인딩 없음·DO 오류 시 null. */
export async function getCachedRoute(
  ns: DurableObjectNamespace | undefined,
  req: RouteRequest,
): Promise<Route | null> {
  if (!ns) return null;
  try {
    const res = await transitStub(ns).fetch(routeUrl(req));
    return res.ok ? ((await res.json()) as Route) : null;
  } catch (err) {
    console.error('[cache] route get failed:', err);
    return null;
  }
}

/** 경로를 캐시에 저장한다 (TTL은 DO가 적용). */
export async function putCachedRoute(
  ns: DurableObjectNamespace | undefined,
  req: RouteRequest,
  route: Route,
  defer?: Defer,
): Promise<void> {
  if (!ns) return;
  const write = Promise.resolve()
    .then(() => transitStub(ns).fetch(routeUrl(req), { method: 'PUT', body: JSON.stringify(route) }))
    .then((res) => {
      if (!res.ok) console.error('[cache] route put rejected:', res.status);
    })
    .catch((err) => console.error('[cache] route put failed:', err));
  if (defer) defer(write);
  else await write;
}
