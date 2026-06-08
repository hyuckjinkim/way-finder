/**
 * B1 — Google Routes v2 대중교통(글로벌) 응답 → RouteLeg[] 정규화.
 *
 * §6 부록 형식 기반 (실 fetch 없이 지식 기반 작성, byte-perfect 미보장 — §7).
 *
 * 핵심 변환 규칙:
 * - travelMode='TRANSIT' 응답의 routes[0].legs[].steps[] 각각이 RouteLeg.
 * - WALKING step → mode='walk' (transit 메타 없음, 환승/접근 도보).
 * - TRANSIT step → transitDetails.transitLine.name → transit.lineName,
 *   vehicle.type → lineType (SUBWAY→subway, BUS→bus, RAIL/HEAVY_RAIL→train,
 *   LONG_DISTANCE_TRAIN→express). 'air'는 절대 생성하지 않는다(ODsay 도시간 전용).
 * - duration은 '123s' 문자열 → 초 파싱.
 * - polyline.encodedPolyline → @googlemaps/polyline-codec로 LatLng[] 디코드
 *   (디코드는 프록시 정규화 레이어에서 1회만 — 앱은 coords를 그대로 받음, §8 C1).
 */
import type { LatLng, RouteLeg, TransitMeta } from '@wayfinder/shared';
import { parseDurationSec } from './_shared/duration.js';
import { decodePolyline } from './_shared/polyline.js';

/** Google Routes 폴리라인 컨테이너. */
export interface GooglePolyline {
  encodedPolyline?: string;
}

/** Google transit step의 transitDetails. */
export interface GoogleTransitDetails {
  transitLine?: {
    name?: string;
    nameShort?: string;
    vehicle?: { type?: string };
  };
  headsign?: string;
}

/** Google Routes leg 내 step 한 건. */
export interface GoogleRouteStep {
  travelMode?: string; // 'WALK' | 'TRANSIT'
  distanceMeters?: number;
  staticDuration?: string; // '123s'
  duration?: string; // '123s'
  polyline?: GooglePolyline;
  transitDetails?: GoogleTransitDetails;
}

/** Google Routes leg 한 건. */
export interface GoogleRouteLeg {
  distanceMeters?: number;
  duration?: string;
  polyline?: GooglePolyline;
  steps?: GoogleRouteStep[];
}

/** Google Routes v2 computeRoutes 응답 루트. */
export interface GoogleRoutesResponse {
  routes?: {
    distanceMeters?: number;
    duration?: string;
    polyline?: GooglePolyline;
    legs?: GoogleRouteLeg[];
  }[];
}

/** Google vehicle.type → 시내/도시간 lineType ('air'는 절대 생성 안 함). */
function vehicleType(type: string | undefined): TransitMeta['lineType'] {
  switch (type) {
    case 'SUBWAY':
    case 'METRO_RAIL':
    case 'TRAM':
      return 'subway';
    case 'BUS':
    case 'INTERCITY_BUS':
    case 'TROLLEYBUS':
      return 'bus';
    case 'HEAVY_RAIL':
    case 'RAIL':
    case 'COMMUTER_TRAIN':
      return 'train';
    case 'HIGH_SPEED_TRAIN':
    case 'LONG_DISTANCE_TRAIN':
      return 'express';
    default:
      return 'train';
  }
}

/** step의 시작/끝 좌표를 coords에서 추출. */
function endpoints(coords: LatLng[]): { start: LatLng; end: LatLng } {
  const zero: LatLng = { lat: 0, lng: 0 };
  return {
    start: coords[0] ?? zero,
    end: coords[coords.length - 1] ?? zero,
  };
}

/** step 한 건 → RouteLeg. */
function stepToLeg(step: GoogleRouteStep): RouteLeg {
  // Google polyline은 precision 5 (F2 통합 디코더).
  const coords = decodePolyline(step.polyline?.encodedPolyline, 5);
  const { start, end } = endpoints(coords);
  const durationSec = parseDurationSec(step.duration ?? step.staticDuration);
  const distanceM = step.distanceMeters ?? 0;

  if (step.travelMode === 'TRANSIT' && step.transitDetails) {
    const line = step.transitDetails.transitLine;
    const lineName = line?.name ?? line?.nameShort ?? '';
    const transit: TransitMeta = {
      lineName,
      lineType: vehicleType(line?.vehicle?.type),
      ...(step.transitDetails.headsign
        ? { headsign: step.transitDetails.headsign }
        : {}),
    };
    return { start, end, mode: 'transit', durationSec, distanceM, coords, transit };
  }

  // WALK step (또는 transitDetails 누락) → 도보 leg.
  return { start, end, mode: 'walk', durationSec, distanceM, coords };
}

/**
 * Google Routes(TRANSIT) 응답의 첫 경로 → RouteLeg[].
 * leg마다 steps를 펼쳐 각 step을 RouteLeg로 변환한다.
 * 경로/steps가 없으면 빈 배열 (호출자가 명시적 에러 처리).
 */
export function normalizeGoogleTransit(res: GoogleRoutesResponse): RouteLeg[] {
  const route = res.routes?.[0];
  if (!route || !Array.isArray(route.legs)) return [];
  const legs: RouteLeg[] = [];
  for (const gleg of route.legs) {
    if (!Array.isArray(gleg.steps)) continue;
    for (const step of gleg.steps) {
      legs.push(stepToLeg(step));
    }
  }
  return legs;
}
