/**
 * D3 — Route 요약 계산.
 *
 * Route에서 UI 표시용 요약 정보를 추출한다:
 * - 총 소요 시간(초) — Route.totalDurationSec 그대로
 * - 총 거리(미터) — Route.totalDistanceM 그대로
 * - 환승 수 — transit leg 수 - 1, 0 미만 클램프 (도보/차/자전거는 0)
 * - leg별 대중교통 노선명 목록 (transit leg만, 도착 순서)
 */
import type { Route } from '@wayfinder/shared';

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
}

/**
 * Route → RouteSummary.
 *
 * 환승 수 규약: transit leg 수 - 1 (최소 0).
 * 도보 환승 leg는 transit이 아니므로 카운팅 대상 외.
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
  };
}
