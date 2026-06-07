/**
 * RouteProvider 계약 + fixture 기반 구현 (설계 문서 §8).
 *
 * PlaceProvider 패턴 그대로 — 앱 데모 모드와 프록시 테스트 양쪽의 공통 입력.
 * 실 모드에서는 프록시 호출 구현이, 데모 모드에서는 아래 fixture 구현이 동일 계약을 만족한다.
 */
import type { Route, RouteRequest } from '../types/route.js';
import {
  WALK_SIMPLE,
  BIKE_SIMPLE,
  CAR_WAYPOINT,
  TRANSIT_CHAIN,
  INTERCITY_STITCH,
} from './routeFixtures.js';

/** 경로 공급자 계약. mode + stops로 단일 Route 반환 (§8 — alternatives는 Phase 4). */
export interface RouteProvider {
  getRoute(req: RouteRequest): Promise<Route>;
}

/** stops가 시외(서로 다른 광역권)인지 — 대중교통 3단 스티칭 트리거. */
function isIntercity(stops: RouteRequest['stops']): boolean {
  // 목 휴리스틱: 출발·도착 위도 차가 크면(>1.5°) 도시간으로 간주.
  const first = stops[0];
  const last = stops[stops.length - 1];
  if (!first || !last) return false;
  return Math.abs(first.lat - last.lat) > 1.5;
}

/**
 * fixture 기반 mock route provider. mode + stops 수/거리로 적절한 픽스처를 선택.
 * 결정론적·동기 데이터를 Promise로 감싸 실 구현과 동일한 비동기 계약을 유지한다.
 */
export const mockRouteProvider: RouteProvider = {
  async getRoute(req: RouteRequest): Promise<Route> {
    const { mode, stops } = req;

    switch (mode) {
      case 'walk':
        return WALK_SIMPLE;
      case 'bike':
        return BIKE_SIMPLE;
      case 'car':
        // 경유지 있으면 다구간, 없으면 단순(목은 다구간 픽스처를 재사용).
        return CAR_WAYPOINT;
      case 'transit':
        // 시외면 3단 스티칭, 그 외(경유지 포함)는 leg-chaining.
        return isIntercity(stops) ? INTERCITY_STITCH : TRANSIT_CHAIN;
      default:
        // mode는 TravelMode 유니온이라 도달 불가 — 방어적 처리.
        return WALK_SIMPLE;
    }
  },
};
