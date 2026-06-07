/**
 * D1 — RouteService.
 *
 * `RouteProvider` 계약(`getRoute`)을 구현한다.
 * - 데모 모드: @wayfinder/shared/mocks 의 mockRouteProvider 위임 (fetch 없음).
 * - 실 모드: apiPost(routesPath, req) → 프록시 POST /v1/routes 호출.
 *
 * 두 모드 모두 동일한 인터페이스를 노출하므로 호출자(routeQueries.ts)는 모드를 신경 쓰지 않는다.
 *
 * 와이어 계약(§8 D1 critic C3): apiPost의 첫 인자는 반드시 shared/api 에서 import한
 * `routesPath` 상수여야 한다 — 리터럴 하드코딩 금지. RouteService.test.ts가 이를 단언한다.
 */
import type { Route, RouteRequest } from '@wayfinder/shared';
import { routesPath } from '@wayfinder/shared/api';
import { mockRouteProvider } from '@wayfinder/shared/mocks';
import { apiPost, isDemoMode } from './apiClient.js';

/**
 * 경로를 탐색하고 단일 `Route`를 반환한다.
 *
 * P4 패스스루(§3 F1.6): `req`의 `preference`·`maxExtraMinutes`(선택)는 그대로
 * apiPost body(`routesPath`)에 포함돼 프록시로 전달된다 — 앱은 리터럴 0(`req` 전체 전달).
 * 미지정 시 기존 P2 동작과 동일(하위호환). RouteService.test.ts(C1)가 전달을 단언한다.
 *
 * @param req  RouteRequest `{ stops, mode, preference?, maxExtraMinutes? }`
 * @returns    탐색된 Route (P4: `customMeta` 선택 포함)
 * @throws     실 모드에서 네트워크/HTTP 오류 시 Error
 */
export async function getRoute(req: RouteRequest): Promise<Route> {
  if (isDemoMode) {
    return mockRouteProvider.getRoute(req);
  }
  const data = await apiPost(routesPath, req);
  return data as Route;
}
