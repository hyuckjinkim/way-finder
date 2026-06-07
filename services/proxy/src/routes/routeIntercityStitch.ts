/**
 * B3 — 시외 3단 스티칭 (설계 문서 §8).
 *
 * 시외 경로는 한 번의 시내 탐색으로 풀 수 없다. 3단으로 합성한다:
 *   1) 출발지 → 출발역 (시내 ODsay)
 *   2) 출발역 → 도착역 (도시간 — KTX 등, ODsay 도시간 응답)
 *   3) 도착역 → 목적지 (시내 ODsay)
 *
 * 시내 정규화기(B1 odsayTransit)는 trafficType 1/2를 subway/bus로만 떨어뜨린다.
 * 도시간 구간은 여기서 train/express/air로 **승격**한다 (`'air'`·`'train'`·`'express'`는
 * ODsay 도시간 전용 — F1 동결, 다른 정규화기 사용 금지).
 *
 * 환승 버퍼·총합 산술은 B2 buildTransitRoute를 공유 — 동일 규약(transferCount=legs-1).
 *
 * **도시간 판정 휴리스틱(open-question):** 실 거리/행정구역 데이터가 없어 출발·도착
 * 위도 차(>1.5°)로 도시간을 근사한다(mockRouteProvider와 동일). 실 형식 검증은
 * §5 스모크/사용자 액션으로 연기 — open-questions.md 로깅.
 */
import type { LatLng, RouteLeg, Route, TransitMeta } from '@wayfinder/shared';
import { buildTransitRoute } from './routeTransitChain.js';

/** 도시간 판정 위도 차 임계(도). mockRouteProvider 휴리스틱과 동기. */
export const INTERCITY_LAT_THRESHOLD = 1.5;

/** 도시간 차량 종류 → lineType. 기본 train(KTX·일반열차), 고속버스는 express. */
export type IntercityVehicle = 'train' | 'express' | 'air';

/**
 * 출발/도착 위도 차로 시외(도시간) 여부를 근사한다.
 * routeRegion('kr')은 서울·부산을 모두 한국으로 보므로 시외 판정엔 못 쓴다(M2 별개).
 */
export function isIntercity(stops: LatLng[]): boolean {
  const first = stops[0];
  const last = stops[stops.length - 1];
  if (!first || !last) return false;
  return Math.abs(first.lat - last.lat) > INTERCITY_LAT_THRESHOLD;
}

/**
 * 도시간 구간 leg를 도시간 lineType으로 승격한다.
 * 시내 정규화 결과(subway/bus)를 train/express/air로 교체 — lineName은 유지.
 */
export function promoteIntercityLeg(
  leg: RouteLeg,
  vehicle: IntercityVehicle,
): RouteLeg {
  const transit: TransitMeta = {
    lineName: leg.transit?.lineName ?? '',
    lineType: vehicle,
    ...(leg.transit?.headsign ? { headsign: leg.transit.headsign } : {}),
  };
  return { ...leg, mode: 'transit', transit };
}

/**
 * 3단 leg 배열을 순서대로 이어붙여 시외 Route로 합성한다.
 * 도시간 구간(가운데)은 호출 전에 promoteIntercityLeg로 승격되어 들어온다.
 *
 * @param accessLegs 출발지 → 출발역 (시내).
 * @param intercityLegs 출발역 → 도착역 (도시간, 승격됨).
 * @param egressLegs 도착역 → 목적지 (시내).
 */
export function stitchIntercity(
  accessLegs: RouteLeg[],
  intercityLegs: RouteLeg[],
  egressLegs: RouteLeg[],
): Route {
  const legs: RouteLeg[] = [...accessLegs, ...intercityLegs, ...egressLegs];
  return buildTransitRoute(legs);
}
