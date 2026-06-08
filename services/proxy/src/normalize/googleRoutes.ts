/**
 * Google Routes v2 (computeRoutes) → Route 정규화 (A1, 글로벌 차/도보/자전거).
 *
 * - duration은 `'123s'` 문자열 → 초 파싱.
 * - polyline.encodedPolyline은 Google encoded polyline → 코덱 decode로 LatLng[].
 *   **디코딩은 프록시 정규화 레이어에서 1회만 (앱 코덱 의존 0 — critic C1).**
 * - legs[i] 각각이 RouteLeg. leg별 encodedPolyline이 있으면 그것을, 없으면
 *   route 전체 polyline을 첫 leg에 사용.
 *
 * mode 인자로 leg.mode 결정 (travelMode와 무관하게 요청 모드를 신뢰).
 */
import type { TravelMode } from '@wayfinder/shared';
import type { Route, RouteLeg } from '@wayfinder/shared';
import { parseDurationSec } from './_shared/duration.js';
import { decodePolyline } from './_shared/polyline.js';

interface GoogleLeg {
  distanceMeters?: number;
  duration?: string;
  polyline?: { encodedPolyline?: string };
}
interface GoogleRoute {
  distanceMeters?: number;
  duration?: string;
  polyline?: { encodedPolyline?: string };
  legs?: GoogleLeg[];
}
export interface GoogleRoutesRaw {
  routes?: GoogleRoute[];
}

/**
 * Google Routes 응답 → Route. routes[0]의 legs를 RouteLeg로 매핑.
 * routes 없음 → throw (장애 격리는 핸들러 — A3).
 *
 * duration·polyline 디코드는 `_shared` 통합 유틸 사용 (F2). Google polyline은 precision 5.
 */
export function normalizeGoogleRoutes(raw: GoogleRoutesRaw, mode: TravelMode): Route {
  const route = raw.routes?.[0];
  if (!route) throw new Error('googleRoutes: no route in response');

  const rawLegs = route.legs ?? [];
  if (rawLegs.length === 0) throw new Error('googleRoutes: no legs');

  const legs: RouteLeg[] = rawLegs.map((leg) => {
    const coords = decodePolyline(leg.polyline?.encodedPolyline, 5);
    const start = coords[0] ?? { lat: 0, lng: 0 };
    const end = coords[coords.length - 1] ?? start;
    return {
      start,
      end,
      mode,
      durationSec: parseDurationSec(leg.duration),
      distanceM: leg.distanceMeters ?? 0,
      coords,
    };
  });

  return {
    legs,
    totalDurationSec:
      parseDurationSec(route.duration) || legs.reduce((a, l) => a + l.durationSec, 0),
    totalDistanceM:
      route.distanceMeters ?? legs.reduce((a, l) => a + l.distanceM, 0),
  };
}
