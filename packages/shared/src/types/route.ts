/**
 * 경로 모델 (설계 문서 §8). Phase 2 길찾기 범위.
 * Route { legs: RouteLeg[] }는 이미 다구간 전제 — 대중교통 leg-chaining·시외
 * 스티칭은 여러 leg의 합성으로 표현 (§8).
 */
import type { LatLng } from './geo.js';

/** 이동 수단 (§8). */
export type TravelMode = 'walk' | 'transit' | 'car' | 'bike';

/**
 * 경로 탐색 요청 (§8). 클라이언트 → 프록시 `POST /v1/routes` body.
 *
 * `stops`는 [출발지, …경유지, 도착지] 순서. 길이 제약(2..6, 경유지 ≤5)은
 * 타입이 아니라 런타임 검증(프록시 routeValidate)으로 강제한다.
 */
export interface RouteRequest {
  /** 경유 좌표 순서열. stops[0]=출발, stops[last]=도착, 그 사이=경유지(≤5). */
  stops: LatLng[];
  mode: TravelMode;
}

/**
 * 대중교통 leg 메타 (선택). 도보/차/자전거 leg는 사용하지 않는다.
 * `lineType: 'air'`는 ODsay 도시간 응답에서만 생성 — 다른 정규화기는 사용 금지.
 */
export interface TransitMeta {
  lineName: string;
  lineType: 'subway' | 'bus' | 'train' | 'express' | 'air';
  headsign?: string;
}

/**
 * 경로의 한 구간 (leg). 경유지 사이 또는 환승 사이의 단일 이동 단위.
 * 대중교통 경유지·시외 스티칭은 여러 leg의 합성(leg-chaining)으로 표현 (§8).
 */
export interface RouteLeg {
  start: LatLng;
  end: LatLng;
  mode: TravelMode;
  /** 소요 시간(초). */
  durationSec: number;
  /** 거리(미터). */
  distanceM: number;
  /**
   * 지도 표시용 경로 좌표열 (필수). 인코딩 폴리라인이 아니라 디코드된 좌표.
   * encoded polyline → LatLng[] 디코딩은 프록시 정규화 레이어에서 1회 수행하고
   * 앱은 절대 디코드하지 않는다 (앱 폴리라인 코덱 의존 0 — §8 critic C1).
   */
  coords: LatLng[];
  /** 대중교통 leg 메타 (transit 모드 leg에만 존재). */
  transit?: TransitMeta;
}

/**
 * 전체 경로. 다구간(legs) 전제 (§8).
 * 총 소요 = Σ leg.durationSec + 환승 대기 버퍼(TRANSFER_BUFFER_SEC × 환승 수).
 */
export interface Route {
  legs: RouteLeg[];
  /** 총 소요 시간(초) — 환승 대기 버퍼 포함. */
  totalDurationSec: number;
  /** 총 거리(미터). */
  totalDistanceM: number;
}
