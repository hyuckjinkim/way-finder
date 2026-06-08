/**
 * 카카오모빌리티 다중경유지 Directions → Route 정규화 (A1, 한국 차).
 *
 * - vertexes는 [lng,lat,lng,lat,...] 평면 배열 → 2개씩 묶어 {lat,lng}.
 * - section 각각이 RouteLeg (origin→waypoint, waypoint→destination 분할).
 * - leg.mode='car'. 대중교통 메타 없음.
 *
 * 누락 필드에 방어적 — roads/vertexes 비면 빈 coords (§6 부록 한계).
 */
import type { LatLng, ManeuverKind } from '@wayfinder/shared';
import type { Route, RouteLeg, RouteStep } from '@wayfinder/shared';
import { flatPairsToCoords } from './_shared/coords.js';

interface KakaoRoad {
  vertexes?: number[];
}
/**
 * 카카오 turn-by-turn 안내 (`sections[].guides[]`, P5 F2). x/y=턴 좌표(WGS84 가정,
 * open-questions §P5 미검증), type=카카오 numeric 코드, guidance=안내 텍스트, distance=다음까지(m).
 */
interface KakaoGuide {
  x?: number;
  y?: number;
  type?: number;
  guidance?: string;
  distance?: number;
}
interface KakaoSection {
  distance?: number;
  duration?: number;
  roads?: KakaoRoad[];
  guides?: KakaoGuide[];
}

/**
 * 카카오 numeric guide `type` → provider-agnostic `ManeuverKind` (P5 F2 §1.2).
 *
 * ⚠️ 추정 코드표 — 실 코드표는 키 발급 후 검증(open-questions §P5). 미매핑→`'unknown'`
 * (instruction 폴백). Google 문자열·Valhalla numeric과 **동일 enum으로 수렴**(load-bearing).
 */
const KAKAO_MANEUVER_KIND: Readonly<Record<number, ManeuverKind>> = {
  1: 'straight', // 직진
  2: 'turn-left', // 좌회전
  3: 'turn-right', // 우회전
  100: 'depart', // 출발
  101: 'arrive', // 도착
};

/** 카카오 numeric guide `type` → `ManeuverKind`. 미매핑·undefined → `'unknown'`. */
function kakaoManeuverKind(type: number | undefined): ManeuverKind {
  return (type !== undefined && KAKAO_MANEUVER_KIND[type]) || 'unknown';
}

/**
 * `sections[].guides[]` → RouteStep[] (P5 F2). guides 부재·빈 배열이면 빈 배열 반환
 * (호출자가 steps 미부착 — 하위호환 폴리라인 동작). x/y → location, guidance → instruction,
 * type → maneuver(매핑) + raw 보존, distance → distanceM.
 */
function extractKakaoSteps(section: KakaoSection): RouteStep[] {
  const guides = section.guides ?? [];
  return guides.map((g) => {
    const step: RouteStep = {
      location: { lat: g.y ?? 0, lng: g.x ?? 0 },
      instruction: g.guidance ?? '',
      maneuver: kakaoManeuverKind(g.type),
      distanceM: g.distance ?? 0,
    };
    if (g.type !== undefined) step.type = g.type; // raw 보존
    return step;
  });
}
interface KakaoRoute {
  result_code?: number;
  summary?: { distance?: number; duration?: number };
  sections?: KakaoSection[];
}
export interface KakaoMobilityRaw {
  routes?: KakaoRoute[];
}

/** 한 section의 모든 road vertexes를 이어 coords 구성 (F2 통합 평면 매퍼). */
function sectionCoords(section: KakaoSection): LatLng[] {
  return (section.roads ?? []).flatMap((road) =>
    flatPairsToCoords(road.vertexes ?? []),
  );
}

/**
 * 카카오모빌리티 응답 → Route. routes[0]의 sections를 leg로 매핑.
 * result_code != 0 또는 routes 없음 → throw (장애 격리는 핸들러 책임 — A3).
 */
export function normalizeKakaoMobility(raw: KakaoMobilityRaw): Route {
  const route = raw.routes?.[0];
  if (!route) throw new Error('kakaoMobility: no route in response');
  if (route.result_code !== undefined && route.result_code !== 0) {
    throw new Error(`kakaoMobility: result_code ${route.result_code}`);
  }

  const sections = route.sections ?? [];
  if (sections.length === 0) throw new Error('kakaoMobility: no sections');

  const legs: RouteLeg[] = sections.map((section) => {
    const coords = sectionCoords(section);
    const start = coords[0] ?? { lat: 0, lng: 0 };
    const end = coords[coords.length - 1] ?? start;
    const leg: RouteLeg = {
      start,
      end,
      mode: 'car',
      durationSec: section.duration ?? 0,
      distanceM: section.distance ?? 0,
      coords,
    };
    // 하위호환: guides 보유 시에만 steps 부착 (미부착=기존 폴리라인 동작).
    const steps = extractKakaoSteps(section);
    if (steps.length > 0) leg.steps = steps;
    return leg;
  });

  return {
    legs,
    totalDurationSec: route.summary?.duration ?? legs.reduce((a, l) => a + l.durationSec, 0),
    totalDistanceM: route.summary?.distance ?? legs.reduce((a, l) => a + l.distanceM, 0),
  };
}
