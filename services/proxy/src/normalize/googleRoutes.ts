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
import type { ManeuverKind, TravelMode } from '@wayfinder/shared';
import type { Route, RouteLeg, RouteStep } from '@wayfinder/shared';
import { parseDurationSec } from './_shared/duration.js';
import { decodePolyline } from './_shared/polyline.js';

/**
 * Google `navigationInstruction.maneuver` 문자열 enum → `ManeuverKind` (P5 F2 §1.2).
 *
 * Google car/bike step의 maneuver 문자열을 provider-agnostic enum으로 직접 매핑.
 * 미매핑→`'unknown'`(instruction 폴백). 카카오 numeric·Valhalla numeric과 **동일 enum
 * 수렴**(load-bearing). 필드마스크는 실 호출 시 `routes.legs.steps.navigationInstruction`·
 * `routes.legs.steps.startLocation` 필요(open-questions §P5).
 */
const GOOGLE_MANEUVER_KIND: Readonly<Record<string, ManeuverKind>> = {
  DEPART: 'depart',
  DESTINATION: 'arrive',
  TURN_LEFT: 'turn-left',
  TURN_RIGHT: 'turn-right',
  TURN_SLIGHT_LEFT: 'slight-left',
  TURN_SLIGHT_RIGHT: 'slight-right',
  STRAIGHT: 'straight',
  TURN_U_TURN: 'uturn',
  MERGE: 'merge',
  FORK_LEFT: 'fork',
  FORK_RIGHT: 'fork',
  ROUNDABOUT_LEFT: 'roundabout',
  ROUNDABOUT_RIGHT: 'roundabout',
};

/** Google maneuver 문자열 → `ManeuverKind`. 미매핑·undefined → `'unknown'`. */
function googleManeuverKind(maneuver: string | undefined): ManeuverKind {
  return (maneuver !== undefined && GOOGLE_MANEUVER_KIND[maneuver]) || 'unknown';
}

interface GoogleNavInstruction {
  maneuver?: string;
  instructions?: string;
}
interface GoogleStep {
  distanceMeters?: number;
  startLocation?: { latLng?: { latitude?: number; longitude?: number } };
  navigationInstruction?: GoogleNavInstruction;
}
interface GoogleLeg {
  distanceMeters?: number;
  duration?: string;
  polyline?: { encodedPolyline?: string };
  steps?: GoogleStep[];
}

/**
 * Google `legs[].steps[]` → RouteStep[] (P5 F2). navigationInstruction 보유 step만 추출
 * (부재 step·빈 배열이면 빈 배열 — 호출자가 미부착, 하위호환 폴리라인 동작).
 * startLocation → location, maneuver(문자열)→maneuver(enum), instructions→instruction,
 * distanceMeters→distanceM. Google은 numeric 코드 없어 `type` 부재.
 */
function extractGoogleSteps(leg: GoogleLeg): RouteStep[] {
  const steps = leg.steps ?? [];
  return steps
    .filter((s) => s.navigationInstruction !== undefined)
    .map((s) => {
      const ll = s.startLocation?.latLng;
      const step: RouteStep = {
        location: { lat: ll?.latitude ?? 0, lng: ll?.longitude ?? 0 },
        instruction: s.navigationInstruction?.instructions ?? '',
        maneuver: googleManeuverKind(s.navigationInstruction?.maneuver),
        distanceM: s.distanceMeters ?? 0,
      };
      return step;
    });
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
    const routeLeg: RouteLeg = {
      start,
      end,
      mode,
      durationSec: parseDurationSec(leg.duration),
      distanceM: leg.distanceMeters ?? 0,
      coords,
    };
    // 하위호환: navigationInstruction 보유 step만 부착 (미부착=기존 폴리라인 동작).
    const steps = extractGoogleSteps(leg);
    if (steps.length > 0) routeLeg.steps = steps;
    return routeLeg;
  });

  return {
    legs,
    totalDurationSec:
      parseDurationSec(route.duration) || legs.reduce((a, l) => a + l.durationSec, 0),
    totalDistanceM:
      route.distanceMeters ?? legs.reduce((a, l) => a + l.distanceM, 0),
  };
}
