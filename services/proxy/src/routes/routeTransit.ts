/**
 * B2 — 대중교통 경로 핸들러 (F1 501 stub 덮어쓰기).
 *
 * 흐름 (routeDirect 패턴 계승 — A3 validateRouteBody 재사용):
 *   1. body 파싱·검증 (A3) — 실패 400.
 *   2. 지역 판정 — shared routeRegion(stops) (F1.8).
 *   3. 데모 모드(키 없음) → F2 mockRouteProvider (실 fetch 없음). 키 0개 게이트는 이 경로.
 *   4. 실 모드 → 지역·시내/시외별 공급자 fetch + 정규화 + 합성. 실패 격리(silent 금지) → 502.
 *      - kr 시내   : 인접 구간별 ODsay 탐색 → chainTransitLegs(B2)로 leg-chaining.
 *      - kr 시외   : ODsay 도시간 탐색 → 도시간 leg 승격 → stitchIntercity(B3).
 *      - global   : Google Routes(TRANSIT) 탐색 → normalizeGoogleTransit → buildTransitRoute.
 *
 * 실 ODsay/Google 키는 wrangler secret 전용(앱·저장소 미포함). 키 0개 게이트에서는
 * isRouteDemoMode(env, region, 'transit')가 항상 데모로 떨어져 동작에 영향 없음.
 *
 * modeHandlers.ts·index.ts는 fan-out 후 불가침 (critic C2).
 */
import type { Context } from 'hono';
import type { Route, RouteRequest, LatLng } from '@wayfinder/shared';
import { routeRegion } from '@wayfinder/shared/region';
import { mockRouteProvider } from '@wayfinder/shared/mocks';
import type { Env } from '../config.js';
import { modeUnavailableBody, routeGate, UPSTREAM_TIMEOUT_MS } from '../config.js';
import { validateRouteBody, runProviderOrError } from './routeValidate.js';
import {
  normalizeGoogleTransit,
  type GoogleRoutesResponse,
} from '../normalize/googleTransit.js';
import { buildTransitRoute, koreaTransitRoute } from '@wayfinder/shared/transit';
import type { RouteHandler } from './modeHandlers.js';

const GOOGLE_ROUTES_URL = 'https://routes.googleapis.com/directions/v2:computeRoutes';

/** stops → Google computeRoutes(TRANSIT) body. 경유지는 intermediates. */
function googleTransitBody(req: RouteRequest): unknown {
  const { stops } = req;
  const toLoc = (s: LatLng) => ({
    location: { latLng: { latitude: s.lat, longitude: s.lng } },
  });
  return {
    origin: toLoc(stops[0]!),
    destination: toLoc(stops[stops.length - 1]!),
    intermediates: stops.slice(1, -1).map(toLoc),
    travelMode: 'TRANSIT',
    polylineEncoding: 'ENCODED_POLYLINE',
  };
}

/** 글로벌 대중교통 — Google Routes(TRANSIT) 탐색 → 정규화 → 합성. */
async function fetchGlobalTransit(req: RouteRequest, env: Env): Promise<Route> {
  const res = await fetch(GOOGLE_ROUTES_URL, {
    signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS),
    method: 'POST',
    headers: {
      'X-Goog-Api-Key': env.GOOGLE_ROUTES_KEY,
      'X-Goog-FieldMask':
        'routes.legs.steps.travelMode,routes.legs.steps.distanceMeters,routes.legs.steps.duration,routes.legs.steps.staticDuration,routes.legs.steps.polyline,routes.legs.steps.transitDetails',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(googleTransitBody(req)),
  });
  if (!res.ok) throw new Error(`googleTransit ${res.status}`);
  const legs = normalizeGoogleTransit((await res.json()) as GoogleRoutesResponse);
  return buildTransitRoute(legs);
}

export const routeTransit: RouteHandler = async (
  c: Context<{ Bindings: Env }>,
): Promise<Response> => {
  let body: unknown;
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: 'invalid JSON body' }, 400);
  }

  const result = validateRouteBody(body);
  if (!result.ok) {
    return c.json({ error: result.error }, 400);
  }
  if (result.request.mode !== 'transit') {
    return c.json(
      { error: `mode mismatch: handler=transit body=${result.request.mode}` },
      400,
    );
  }

  const region = routeRegion(result.request.stops);

  const gate = routeGate(c.env, region, 'transit');
  if (gate === 'unavailable') return c.json(modeUnavailableBody(region, 'transit'), 501);

  // 데모 모드 — 실 fetch 없이 mock provider (leg-chaining·시외 픽스처 선택은 provider가 담당).
  if (gate === 'demo') {
    const route: Route = await mockRouteProvider.getRoute(result.request);
    return c.json(route);
  }

  // 실 모드 — 지역별 공급자. 실패 격리(silent 금지) → 502.
  const route = await runProviderOrError<Route>(
    () =>
      region === 'kr'
        ? koreaTransitRoute(result.request, c.env.ODSAY_API_KEY)
        : fetchGlobalTransit(result.request, c.env),
    `${region}-transit`,
  );
  if (route === null) {
    return c.json({ error: `route provider failed (${region}/transit)` }, 502);
  }
  return c.json(route);
};
