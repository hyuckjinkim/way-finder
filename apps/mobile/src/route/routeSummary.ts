/**
 * D3 — Route 요약 계산.
 *
 * Route에서 UI 표시용 요약 정보를 추출한다:
 * - 총 소요 시간(초) — Route.totalDurationSec 그대로
 * - 총 거리(미터) — Route.totalDistanceM 그대로
 * - 환승 수 — transit leg 수 - 1, 0 미만 클램프 (도보/차/자전거는 0)
 * - leg별 대중교통 노선명 목록 (transit leg만, 도착 순서)
 *
 * C3(P4): Route.customMeta를 그대로 전달 — 선택 프로필·예산 플래그.
 * 기존 P2 경로(fastest)는 customMeta 미존재 → 미표시(하위호환).
 */
import type { Route, RouteCustomMeta } from '@wayfinder/shared';

/** Route 요약 — UI 패널 표시용. */
export interface RouteSummary {
  /** 총 소요 시간(초). */
  totalDurationSec: number;
  /** 총 거리(미터). */
  totalDistanceM: number;
  /**
   * 환승 수 (transit leg 수 - 1, 최소 0).
   * 도보/차/자전거 경로는 0.
   */
  transfers: number;
  /**
   * 대중교통 노선명 목록 (transit leg 순서).
   * 예: ['4호선', '402번'], 도보/차/자전거는 빈 배열.
   */
  lineNames: string[];
  /**
   * 커스텀 경로 메타 (P4, 선택). Route.customMeta 그대로.
   * 기존 P2 경로(fastest)는 undefined — 미표시(하위호환).
   * RouteResultScreen이 이 필드로 프로필·예산 플래그를 표시한다.
   */
  customMeta?: RouteCustomMeta;
}

/**
 * Route → RouteSummary.
 *
 * 환승 수 규약: transit leg 수 - 1 (최소 0).
 * 도보 환승 leg는 transit이 아니므로 카운팅 대상 외.
 * C3(P4): Route.customMeta를 그대로 전달한다(하위호환 — 미존재 시 undefined).
 */
export function routeSummary(route: Route): RouteSummary {
  const transitLegs = route.legs.filter((leg) => leg.mode === 'transit');
  const transfers = Math.max(0, transitLegs.length - 1);
  const lineNames = transitLegs
    .map((leg) => leg.transit?.lineName)
    .filter((name): name is string => name !== undefined);

  return {
    totalDurationSec: route.totalDurationSec,
    totalDistanceM: route.totalDistanceM,
    transfers,
    lineNames,
    customMeta: route.customMeta,
  };
}
