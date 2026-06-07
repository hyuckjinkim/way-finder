/**
 * A2 — 다이렉트 모드(차/도보/자전거) 공용 핸들러 로직.
 *
 * routeCar/routeWalk/routeBike가 모드만 바꿔 이 함수를 호출한다 (DRY).
 * modeHandlers.ts·index.ts는 불가침 — 이 파일은 핸들러 stub들이 공유하는 신규 모듈.
 *
 * 흐름:
 *   1. body 파싱·검증 (A3 validateRouteBody) — 실패 400.
 *   2. 지역 판정 — shared routeRegion(stops)만 사용 (F1.8).
 *   3. 데모 모드(키 없음) → F2 mockRouteProvider (실 fetch 없음).
 *   4. 실 모드 → 지역·모드별 공급자 fetch → 정규화. 실패 시 명시적 502 (silent 금지).
 */
import type { Context } from 'hono';
import type { Route, RouteRequest, TravelMode } from '@wayfinder/shared';
import { routeRegion } from '@wayfinder/shared/region';
import { mockRouteProvider } from '@wayfinder/shared/mocks';
import type { Env } from '../config.js';
import { isRouteDemoMode } from '../config.js';
import { validateRouteBody, runProviderOrError } from './routeValidate.js';
import {
  normalizeKakaoMobility,
  type KakaoMobilityRaw,
} from '../normalize/kakaoMobility.js';
import {
  normalizeTmapPedestrian,
  type TmapGeoJsonRaw,
} from '../normalize/tmapPedestrian.js';
import { normalizeTmapBike } from '../normalize/tmapBike.js';
import {
  normalizeGoogleRoutes,
  type GoogleRoutesRaw,
} from '../normalize/googleRoutes.js';

const KAKAO_MOBILITY_URL = 'https://apis-navi.kakaomobility.com/v1/waypoints/directions';
const TMAP_PEDESTRIAN_URL = 'https://apis.openapi.sk.com/tmap/routes/pedestrian?version=1';
const TMAP_BIKE_URL = 'https://apis.openapi.sk.com/tmap/routes/bicycle?version=1';
const GOOGLE_ROUTES_URL = 'https://routes.googleapis.com/directions/v2:computeRoutes';

/** Google travelMode 매핑 (다이렉트 모드 — transit 제외). */
const GOOGLE_TRAVEL_MODE: Record<'walk' | 'car' | 'bike', string> = {
  walk: 'WALK',
  car: 'DRIVE',
  bike: 'BICYCLE',
};

/** stops → 카카오모빌리티 body (x=lng, y=lat). 경유지는 waypoints. */
function kakaoBody(req: RouteRequest): unknown {
  const { stops } = req;
  const origin = stops[0]!;
  const destination = stops[stops.length - 1]!;
  const waypoints = stops.slice(1, -1).map((s) => ({ x: s.lng, y: s.lat }));
  return {
    origin: { x: origin.lng, y: origin.lat },
    destination: { x: destination.lng, y: destination.lat },
    waypoints,
    priority: 'RECOMMEND',
  };
}

/** stops → TMAP body. passList는 "lng,lat_lng,lat" (경유지). */
function tmapBody(req: RouteRequest): Record<string, string> {
  const { stops } = req;
  const start = stops[0]!;
  const end = stops[stops.length - 1]!;
  const mids = stops.slice(1, -1);
  const body: Record<string, string> = {
    startX: String(start.lng),
    startY: String(start.lat),
    endX: String(end.lng),
    endY: String(end.lat),
    startName: 'start',
    endName: 'end',
  };
  if (mids.length > 0) {
    body.passList = mids.map((s) => `${s.lng},${s.lat}`).join('_');
  }
  return body;
}

/** stops → Google computeRoutes body. 경유지는 intermediates. */
function googleBody(req: RouteRequest, mode: 'walk' | 'car' | 'bike'): unknown {
  const { stops } = req;
  const toLoc = (s: { lat: number; lng: number }) => ({
    location: { latLng: { latitude: s.lat, longitude: s.lng } },
  });
  return {
    origin: toLoc(stops[0]!),
    destination: toLoc(stops[stops.length - 1]!),
    intermediates: stops.slice(1, -1).map(toLoc),
    travelMode: GOOGLE_TRAVEL_MODE[mode],
    polylineEncoding: 'ENCODED_POLYLINE',
  };
}

/** 한국 공급자 fetch+정규화 (모드별). */
async function fetchKorea(
  req: RouteRequest,
  mode: 'walk' | 'car' | 'bike',
  env: Env,
): Promise<Route> {
  if (mode === 'car') {
    const res = await fetch(KAKAO_MOBILITY_URL, {
      method: 'POST',
      headers: {
        Authorization: `KakaoAK ${env.KAKAO_MOBILITY_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(kakaoBody(req)),
    });
    if (!res.ok) throw new Error(`kakaoMobility ${res.status}`);
    return normalizeKakaoMobility((await res.json()) as KakaoMobilityRaw);
  }
  // walk / bike → TMAP
  const url = mode === 'bike' ? TMAP_BIKE_URL : TMAP_PEDESTRIAN_URL;
  const res = await fetch(url, {
    method: 'POST',
    headers: { appKey: env.TMAP_APP_KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify(tmapBody(req)),
  });
  if (!res.ok) throw new Error(`tmap ${mode} ${res.status}`);
  const raw = (await res.json()) as TmapGeoJsonRaw;
  return mode === 'bike' ? normalizeTmapBike(raw) : normalizeTmapPedestrian(raw);
}

/** 글로벌 공급자 fetch+정규화 (Google Routes). */
async function fetchGlobal(
  req: RouteRequest,
  mode: 'walk' | 'car' | 'bike',
  env: Env,
): Promise<Route> {
  const res = await fetch(GOOGLE_ROUTES_URL, {
    method: 'POST',
    headers: {
      'X-Goog-Api-Key': env.GOOGLE_ROUTES_KEY,
      'X-Goog-FieldMask':
        'routes.legs.distanceMeters,routes.legs.duration,routes.legs.polyline,routes.duration,routes.distanceMeters,routes.polyline',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(googleBody(req, mode)),
  });
  if (!res.ok) throw new Error(`googleRoutes ${res.status}`);
  return normalizeGoogleRoutes((await res.json()) as GoogleRoutesRaw, mode);
}

/**
 * 다이렉트 모드 핸들러 공통 본체. mode는 transit이 아닌 3종만.
 */
export async function handleDirectRoute(
  c: Context<{ Bindings: Env }>,
  mode: 'walk' | 'car' | 'bike',
): Promise<Response> {
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
  // 디스패치 mode와 body.mode 정합 (방어 — 디스패처가 이미 선택했지만 명시).
  if (result.request.mode !== mode) {
    return c.json(
      { error: `mode mismatch: handler=${mode} body=${result.request.mode}` },
      400,
    );
  }

  const region = routeRegion(result.request.stops);

  // 데모 모드 — 실 fetch 없이 mock provider.
  if (isRouteDemoMode(c.env, region)) {
    const route = await mockRouteProvider.getRoute(result.request);
    return c.json(route);
  }

  // 실 모드 — 지역·모드별 공급자. 실패 격리(silent 금지) → 502.
  const route = await runProviderOrError<Route>(
    () =>
      region === 'kr'
        ? fetchKorea(result.request, mode, c.env)
        : fetchGlobal(result.request, mode, c.env),
    `${region}-${mode}`,
  );
  if (route === null) {
    return c.json({ error: `route provider failed (${region}/${mode})` }, 502);
  }
  return c.json(route);
}

/** 사용되지 않는 TravelMode 가드 (타입 안전 — transit은 다이렉트 아님). */
export type DirectMode = Exclude<TravelMode, 'transit'>;
