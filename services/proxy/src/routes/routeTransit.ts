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
import type { Route, RouteLeg, RouteRequest, LatLng } from '@wayfinder/shared';
import { routeRegion } from '@wayfinder/shared/region';
import { mockRouteProvider } from '@wayfinder/shared/mocks';
import type { Env } from '../config.js';
import { modeUnavailableBody, routeGate } from '../config.js';
import { validateRouteBody, runProviderOrError } from './routeValidate.js';
import {
  normalizeOdsayTransit,
  type OdsayTransitResponse,
} from '../normalize/odsayTransit.js';
import {
  normalizeGoogleTransit,
  type GoogleRoutesResponse,
} from '../normalize/googleTransit.js';
import { chainTransitLegs, buildTransitRoute } from './routeTransitChain.js';
import {
  isIntercity,
  promoteIntercityLeg,
  stitchIntercity,
} from './routeIntercityStitch.js';
import type { RouteHandler } from './modeHandlers.js';

const ODSAY_URL = 'https://api.odsay.com/v1/api/searchPubTransPathT';
const GOOGLE_ROUTES_URL = 'https://routes.googleapis.com/directions/v2:computeRoutes';

/** 한 구간(출발→도착)을 ODsay로 탐색해 정규화 leg 배열을 반환한다. */
async function fetchOdsaySegment(
  from: LatLng,
  to: LatLng,
  env: Env,
): Promise<RouteLeg[]> {
  const params = new URLSearchParams({
    apiKey: env.ODSAY_API_KEY,
    SX: String(from.lng),
    SY: String(from.lat),
    EX: String(to.lng),
    EY: String(to.lat),
    output: 'json',
  });
  const res = await fetch(`${ODSAY_URL}?${params.toString()}`);
  if (!res.ok) throw new Error(`odsay ${res.status}`);
  const body = (await res.json()) as OdsayTransitResponse & { error?: unknown };
  const legs = normalizeOdsayTransit(body, from, to);
  // ODsay는 인증 실패(IP 미등록 등)도 HTTP 200 + error 본문 → 빈 경로 200으로 새던 결함. 502로 드러낸다.
  if (legs.length === 0) throw new Error(`odsay: no path — ${JSON.stringify(body.error ?? 'empty result')}`);
  return legs;
}

/**
 * kr 대중교통 합성. 시외(위도 차 휴리스틱)면 도시간 스티칭(B3), 아니면 인접 구간
 * leg-chaining(B2). 둘 다 buildTransitRoute의 동일 버퍼 규약을 공유한다.
 */
async function fetchKoreaTransit(req: RouteRequest, env: Env): Promise<Route> {
  const { stops } = req;

  if (isIntercity(stops)) {
    // 시외: 출발→도착 도시간 ODsay 탐색 → 도시간 leg(train 기본)로 승격 → 스티칭(B3).
    // 실 형식의 access/intercity/egress 3분할은 §5 스모크로 연기(open-question) —
    // 단일 도시간 구간을 intercity 그룹으로 넣어 동일 산술을 보장한다.
    const intercityLegs = await fetchOdsaySegment(
      stops[0]!,
      stops[stops.length - 1]!,
      env,
    );
    const promoted = intercityLegs.map((leg) => promoteIntercityLeg(leg, 'train'));
    return stitchIntercity([], promoted, []);
  }

  // 시내: 인접 구간(A→B, B→C …)을 각각 탐색해 순서대로 leg-chaining(B2).
  const segmentLegs: RouteLeg[][] = [];
  for (let i = 0; i < stops.length - 1; i++) {
    segmentLegs.push(await fetchOdsaySegment(stops[i]!, stops[i + 1]!, env));
  }
  return chainTransitLegs(segmentLegs);
}

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
        ? fetchKoreaTransit(result.request, c.env)
        : fetchGlobalTransit(result.request, c.env),
    `${region}-transit`,
  );
  if (route === null) {
    return c.json({ error: `route provider failed (${region}/transit)` }, 502);
  }
  return c.json(route);
};
