/**
 * RouteProvider 계약 + fixture 기반 구현 (설계 문서 §8).
 *
 * PlaceProvider 패턴 그대로 — 앱 데모 모드와 프록시 테스트 양쪽의 공통 입력.
 * 실 모드에서는 프록시 호출 구현이, 데모 모드에서는 아래 fixture 구현이 동일 계약을 만족한다.
 */
import type {
  Route,
  RouteRequest,
  RouteCustomMeta,
  RoutePreference,
} from '../types/route.js';
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

/** 프로필별 합성 추가 소요(분) — 데모 결정론(F2). 실 모드는 OO1이 실 산출. */
const SYNTHETIC_EXTRA_MIN: Partial<Record<RoutePreference, number>> = {
  walkable: 3,
  safe: 8,
  quiet: 5,
  scenic: 20, // costing 미지원 — 큰 합성값으로 거의 항상 예산 초과(❌ 가시화).
};

/**
 * 데모 모드 customMeta 합성 (P4 §3 F2.5).
 *
 * 2-call T-vs-P 비교는 실 모드(OO1)에만 존재 — 데모는 단일 Route만 반환하므로
 * preference·maxExtraMinutes로 **결정론적 합성 플래그**를 채운다. 이로써 데모 웹
 * 게이트(D2)가 "예산 내/초과" 표시를 실제로 행사한다(합성이라 실 컨테이너 불요).
 *
 * - `fastest`/미지정 → 메타 없음(undefined, 기존 P2 경로 — 하위호환).
 * - 그 외 프로필 → baseline = 픽스처 소요, profile = baseline + 합성 추가.
 *   `withinBudget` = (합성 추가분 ≤ maxExtraMinutes). N 미지정(무제한)이면 항상 true.
 */
function synthCustomMeta(
  base: Route,
  preference: RoutePreference | undefined,
  maxExtraMinutes: number | undefined,
): RouteCustomMeta | undefined {
  if (!preference || preference === 'fastest') return undefined;
  const extraMin = SYNTHETIC_EXTRA_MIN[preference] ?? 0;
  const budget = maxExtraMinutes ?? Number.POSITIVE_INFINITY;
  return {
    preference,
    withinBudget: extraMin <= budget,
    baselineDurationSec: base.totalDurationSec,
  };
}

/**
 * fixture 기반 mock route provider. mode + stops 수/거리로 적절한 픽스처를 선택.
 * 결정론적·동기 데이터를 Promise로 감싸 실 구현과 동일한 비동기 계약을 유지한다.
 *
 * P4: preference·maxExtraMinutes가 있으면 `customMeta`를 합성해 부착(데모 표면).
 * 실 모드(OO1)는 동일 `customMeta`를 실 산출값으로 채운다(데모/실 동일 표면).
 */
export const mockRouteProvider: RouteProvider = {
  async getRoute(req: RouteRequest): Promise<Route> {
    const { mode, stops, preference, maxExtraMinutes } = req;

    let base: Route;
    switch (mode) {
      case 'walk':
        base = WALK_SIMPLE;
        break;
      case 'bike':
        base = BIKE_SIMPLE;
        break;
      case 'car':
        // 경유지 있으면 다구간, 없으면 단순(목은 다구간 픽스처를 재사용).
        base = CAR_WAYPOINT;
        break;
      case 'transit':
        // 시외면 3단 스티칭, 그 외(경유지 포함)는 leg-chaining.
        base = isIntercity(stops) ? INTERCITY_STITCH : TRANSIT_CHAIN;
        break;
      default:
        // mode는 TravelMode 유니온이라 도달 불가 — 방어적 처리.
        base = WALK_SIMPLE;
    }

    const customMeta = synthCustomMeta(base, preference, maxExtraMinutes);
    // 메타 없으면 픽스처를 그대로 반환(하위호환 — 기존 P2 경로 식별성 유지).
    return customMeta ? { ...base, customMeta } : base;
  },
};
