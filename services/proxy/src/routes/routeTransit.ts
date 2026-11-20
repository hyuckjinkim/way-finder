/**
 * B2 — 대중교통 경로 핸들러 (F1 501 stub 덮어쓰기).
 *
 * 흐름 (routeDirect 패턴 계승 — A3 validateRouteBody 재사용):
 *   1. body 파싱·검증 (A3) — 실패 400.
 *   2. 지역 판정 — shared routeRegion(stops) (F1.8).
 *   3. 데모 모드(키 없음) → F2 mockRouteProvider (실 fetch 없음). 키 0개 게이트는 이 경로.
 *   4. 실 모드 → 지역·시내/시외별 공급자 fetch + 정규화 + 합성. 실패 격리(silent 금지) → 502.
 *      - kr       : 카카오 대중교통 (krTransit). ODsay는 프록시에서 안 씀 — Server 키가 IP 제한이라
 *                   Workers(고정 IP 없음)에서 인증 실패(라이브 502 확인, 설계 문서 §키 위치 예외).
 *      - global   : Google Routes(TRANSIT) 탐색 → normalizeGoogleTransit → buildTransitRoute.
 *
 * 실패 계약: `{ error, code }` — quota 429 · no_route 422 · too_close 422 · upstream 502.
 * (전역 레이트리밋 429에는 code가 없다 → 클라이언트는 status가 아니라 code로 분기.)
 *
 * modeHandlers.ts·index.ts는 fan-out 후 불가침 (critic C2).
 */
import type { Context } from 'hono';
import type { Route, RouteRequest, LatLng } from '@wayfinder/shared';
import { haversineDistanceM, TRANSFER_BUFFER_SEC } from '@wayfinder/shared';
import { routeRegion } from '@wayfinder/shared/region';
import { mockRouteProvider } from '@wayfinder/shared/mocks';
import type { Env } from '../config.js';
import { modeUnavailableBody, routeGate, UPSTREAM_TIMEOUT_MS } from '../config.js';
import { validateRouteBody, runProviderOrError } from './routeValidate.js';
import {
  normalizeGoogleTransit,
  type GoogleRoutesResponse,
} from '../normalize/googleTransit.js';
import {
  buildTransitRoute,
  isIntercity,
  TransitError,
  type TransitErrorCode,
} from '@wayfinder/shared/transit';
import {
  kakaoRouteToRoute,
  normalizeKakaoTransit,
  type KakaoTransitResponse,
} from '../normalize/kakaoTransit.js';
import { reserveKakaoTransit } from '../quota/transitQuota.js';
import { getCachedRoute, putCachedRoute } from '../cache/routeCache.js';
import { deferFrom } from '../cache/kv.js';
import type { RouteHandler } from './modeHandlers.js';

const GOOGLE_ROUTES_URL = 'https://routes.googleapis.com/directions/v2:computeRoutes';
const KAKAO_TRANSIT_URL = 'https://dapi.kakao.com/v2/routing/publictraffic';
/** 이보다 가까운 구간은 대중교통 대신 도보 권유 (ODsay -98 기준과 동일). 카카오는 NO_RESULTS만 줘서 여기서 판정. */
const TOO_CLOSE_M = 700;
/**
 * kr 대중교통 요청 전체 마감 — 캐시·예약 DO 왕복을 포함해 이 시각에 카카오 호출을 모두 끊는다.
 * 클라이언트 apiClient 타임아웃(10s)보다 짧아야 클라이언트가 먼저 포기·재시도해 이중 예약하지 않는다.
 */
const KR_TRANSIT_DEADLINE_MS = 8000;

const STATUS: Record<TransitErrorCode, 429 | 422 | 502> = {
  quota: 429,
  no_route: 422,
  too_close: 422,
  auth: 502,
  upstream: 502,
};

/** 카카오 대중교통 1구간. 쿼터 초과(429·code -10)·경로 없음·그 외 실패를 타입 에러로. */
async function fetchKakaoSegment(
  from: LatLng,
  to: LatLng,
  key: string,
  signal: AbortSignal,
): Promise<KakaoTransitResponse> {
  const url = new URL(KAKAO_TRANSIT_URL);
  url.searchParams.set('start_x', String(from.lng));
  url.searchParams.set('start_y', String(from.lat));
  url.searchParams.set('end_x', String(to.lng));
  url.searchParams.set('end_y', String(to.lat));
  const res = await fetch(url.toString(), {
    signal,
    headers: { Authorization: `KakaoAK ${key}` },
  });
  const body = (await res.json().catch(() => ({}))) as KakaoTransitResponse & {
    code?: number;
    errorType?: string;
    msg?: string;
    message?: string;
  };
  // 쿼터 초과 응답 형태는 미관측 — 429·code -10(카카오 로컬 규약)·한도 문구를 모두 quota로.
  const errText = `${body.errorType ?? ''} ${body.msg ?? ''} ${body.message ?? ''}`;
  if (res.status === 429 || body.code === -10 || /limit|throttl|quota/i.test(errText)) {
    throw new TransitError('quota', 'kakao transit quota exceeded');
  }
  if (!res.ok) throw new TransitError('upstream', `kakao transit ${res.status}`);
  if (body.status === 'NO_RESULTS') throw new TransitError('no_route', 'no transit route');
  if (body.status !== 'OK') throw new TransitError('upstream', `kakao transit status ${body.status}`);
  return body;
}

/**
 * 국내 대중교통 — 카카오. 순서: 시외/근거리 판정 → 캐시 → 쿼터 예약 → 호출 → 캐시 저장.
 * 판정·캐시 히트는 카카오 카운터를 소비하지 않는다.
 * 2지점: 주 경로 + 대안. 경유지: 구간을 병렬 호출(전부-또는-0 예약 뒤)해 주 경로를 잇고 구간 사이에만 환승 버퍼.
 */
async function krTransit(c: Context<{ Bindings: Env }>, req: RouteRequest): Promise<Route> {
  const deadline = AbortSignal.timeout(KR_TRANSIT_DEADLINE_MS);
  const { stops } = req;
  // ponytail: 카카오는 시내 대중교통만(서울→부산 실측 NO_RESULTS) — 호출 전에 걸러 쿼터 절약.
  if (isIntercity(stops)) throw new TransitError('no_route', 'intercity transit not supported');
  for (let i = 0; i < stops.length - 1; i++) {
    if (haversineDistanceM(stops[i]!, stops[i + 1]!) < TOO_CLOSE_M) {
      throw new TransitError('too_close', 'too close for transit — walk instead');
    }
  }

  const cached = await getCachedRoute(c.env.KAKAO_TRANSIT_QUOTA, req);
  if (cached) return cached;

  const segments = stops.length - 1;
  if (!(await reserveKakaoTransit(c.env.KAKAO_TRANSIT_QUOTA, segments))) {
    throw new TransitError('quota', 'daily transit quota reached');
  }

  const raws = await Promise.all(
    stops.slice(1).map((to, i) => fetchKakaoSegment(stops[i]!, to, c.env.KAKAO_REST_KEY, deadline)),
  );
  let route: Route;
  if (segments === 1) {
    const r = normalizeKakaoTransit(raws[0]!, stops[0]!, stops[1]!);
    if (!r) throw new TransitError('no_route', 'no transit route');
    route = r;
  } else {
    const parts = raws.map((raw, i) => {
      const first = raw.routes?.[0];
      if (!first) throw new TransitError('no_route', 'no transit route');
      return kakaoRouteToRoute(first, stops[i]!, stops[i + 1]!);
    });
    const fares = parts.map((p) => p.fare);
    route = {
      legs: parts.flatMap((p) => p.legs),
      totalDurationSec:
        parts.reduce((a, p) => a + p.totalDurationSec, 0) + TRANSFER_BUFFER_SEC * (segments - 1),
      totalDistanceM: parts.reduce((a, p) => a + p.totalDistanceM, 0),
      ...(fares.every((f) => f !== undefined) ? { fare: fares.reduce((a, f) => a + f!, 0) } : {}),
    };
  }
  await putCachedRoute(c.env.KAKAO_TRANSIT_QUOTA, req, route, deferFrom(c));
  return route;
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

  if (region === 'kr') {
    try {
      return c.json(await krTransit(c, result.request));
    } catch (err) {
      const typed = err instanceof TransitError ? err : new TransitError('upstream', 'route provider failed (kr/transit)');
      if (typed.code === 'upstream' || typed.code === 'quota') console.error('[route] kr-transit failed:', err);
      return c.json({ error: typed.message, code: typed.code }, STATUS[typed.code]);
    }
  }

  // 글로벌 — 실패 격리(silent 금지) → 502.
  const route = await runProviderOrError<Route>(
    () => fetchGlobalTransit(result.request, c.env),
    `${region}-transit`,
  );
  if (route === null) {
    return c.json({ error: `route provider failed (${region}/transit)`, code: 'upstream' }, 502);
  }
  return c.json(route);
};
