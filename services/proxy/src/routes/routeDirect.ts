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
import type {
  Route,
  RouteRequest,
  TravelMode,
  PedestrianCostingOptions,
} from '@wayfinder/shared';
import { routeRegion } from '@wayfinder/shared/region';
import { mockRouteProvider } from '@wayfinder/shared/mocks';
import type { Env } from '../config.js';
import { isRouteDemoMode, isValhallaCustomRoute } from '../config.js';
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

/**
 * Valhalla 커스텀 경로 공급자 인터페이스 (P4 §3 F1.5 — F1 단일 진실 소스).
 *
 * OW1(valhallaProvider.ts)이 구현하고, OO1(extraMinutesFilter)은 이 인터페이스를
 * mock 주입해 A lane 구현 대기 없이 병렬 작성한다. F1은 인터페이스 + 배선 슬롯만
 * 정의하며, 실 구현은 스트림 A/O가 채운다(Foundation 단계에선 미배선 stub).
 */
export interface ValhallaProvider {
  /**
   * stops + costing 옵션 → 정규화된 Route.
   * @param req     RouteRequest (preference·maxExtraMinutes 포함)
   * @param costing 프로필별 pedestrian costing 옵션 (PROFILE_COSTING 매핑값)
   */
  route(req: RouteRequest, costing: PedestrianCostingOptions): Promise<Route>;
}

/**
 * Valhalla 커스텀 경로 배선 슬롯 (P4 §3 F1.5 — F1 stub).
 *
 * Foundation 단계에선 **미배선** — OW1이 `valhallaProvider.ts`(전용 소유)에서
 * 실 공급자 + extraMinutesFilter(OO1)를 결합해 이 슬롯을 채운다(routeDirect.ts 불가침).
 * 슬롯이 설치되기 전(현재)에는 null을 반환해 호출자가 기존 TMAP 경로로 폴백하게 한다.
 *
 * 주: `validateRouteBody`가 현재 `{stops,mode}`만 통과시키므로 preference는 런타임에
 * 항상 undefined → `isValhallaCustomRoute`가 false → 이 슬롯은 dormant(OW2가
 * routeValidate를 확장하고 OW1이 본 슬롯을 배선하면 활성). 기존 4모드 동작 불변.
 */
async function tryValhallaCustomRoute(
  _req: RouteRequest,
  _env: Env,
): Promise<Route | null> {
  // F1 stub — OW1이 valhallaProvider + extraMinutesFilter 배선으로 대체.
  return null;
}

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

  // P4 커스텀 경로 슬롯 (F1 — kr+walk+preference). 현재 dormant:
  // validateRouteBody가 preference를 통과시키지 않아 항상 미진입. OW2가 검증을,
  // OW1이 tryValhallaCustomRoute를 배선하면 활성. 기존 4모드 경로 불가침.
  if (
    isValhallaCustomRoute(region, mode, result.request.preference)
  ) {
    const custom = await tryValhallaCustomRoute(result.request, c.env);
    if (custom !== null) return c.json(custom);
    // 슬롯 미배선/실패 → 기존 TMAP 도보로 폴백(F1 폴백 규약, silent 금지 아님).
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
