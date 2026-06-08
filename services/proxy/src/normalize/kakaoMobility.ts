/**
 * 카카오모빌리티 다중경유지 Directions → Route 정규화 (A1, 한국 차).
 *
 * - vertexes는 [lng,lat,lng,lat,...] 평면 배열 → 2개씩 묶어 {lat,lng}.
 * - section 각각이 RouteLeg (origin→waypoint, waypoint→destination 분할).
 * - leg.mode='car'. 대중교통 메타 없음.
 *
 * 누락 필드에 방어적 — roads/vertexes 비면 빈 coords (§6 부록 한계).
 */
import type { LatLng } from '@wayfinder/shared';
import type { Route, RouteLeg } from '@wayfinder/shared';
import { flatPairsToCoords } from './_shared/coords.js';

interface KakaoRoad {
  vertexes?: number[];
}
interface KakaoSection {
  distance?: number;
  duration?: number;
  roads?: KakaoRoad[];
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
    return {
      start,
      end,
      mode: 'car',
      durationSec: section.duration ?? 0,
      distanceM: section.distance ?? 0,
      coords,
    };
  });

  return {
    legs,
    totalDurationSec: route.summary?.duration ?? legs.reduce((a, l) => a + l.durationSec, 0),
    totalDistanceM: route.summary?.distance ?? legs.reduce((a, l) => a + l.distanceM, 0),
  };
}
