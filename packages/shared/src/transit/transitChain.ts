/**
 * B2 — 대중교통 leg-chaining 합성 엔진 (설계 문서 §8 핵심).
 *
 * 경유지(stops)가 있으면 각 인접 구간(A→B, B→C …)을 독립 탐색(B1 정규화 결과)한 뒤
 * subPath/step들을 순서대로 이어붙여 하나의 Route로 합성한다.
 *
 * 총 소요 = Σ leg.durationSec + TRANSFER_BUFFER_SEC × (환승 수).
 * **환승 수 규약(F2 픽스처·B2 엔진 공통): transferCount = legs.length - 1.**
 * (TRANSIT_CHAIN: 3 leg → 버퍼 2회 = 600s, total 1920s;
 *  INTERCITY_STITCH: 3 leg → 버퍼 2회 = 600s, total 11400s. 두 픽스처 모두 성립.)
 * 환승 버퍼 상수는 shared `TRANSFER_BUFFER_SEC`를 import — 자체 상수 정의 금지(F1.2 동결).
 */
import { TRANSFER_BUFFER_SEC } from '../index.js';
import type { Route, RouteLeg } from '../index.js';

/**
 * 구간별 RouteLeg 배열들을 순서대로 이어붙여 Route를 합성한다.
 *
 * @param segmentLegs 인접 구간(A→B, B→C …)별 정규화 leg 배열. 순서 보존.
 * @returns 합성 Route. leg가 0개면 빈 Route.
 */
export function chainTransitLegs(segmentLegs: RouteLeg[][]): Route {
  const legs: RouteLeg[] = segmentLegs.flat();
  return buildTransitRoute(legs);
}

/**
 * 이미 펼쳐진 leg 배열을 Route로 합성 (산술 단일 진실).
 * 시외 스티칭(B3)도 이 함수를 공유해 동일한 버퍼 규약을 보장한다.
 */
export function buildTransitRoute(legs: RouteLeg[]): Route {
  const legSum = legs.reduce((acc, leg) => acc + leg.durationSec, 0);
  const distSum = legs.reduce((acc, leg) => acc + leg.distanceM, 0);
  const transfers = legs.length > 0 ? legs.length - 1 : 0;
  return {
    legs,
    totalDurationSec: legSum + TRANSFER_BUFFER_SEC * transfers,
    totalDistanceM: distSum,
  };
}
