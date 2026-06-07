/**
 * 경로 모델 (설계 문서 §8). Phase 2 길찾기 범위 — P1에서는 미사용이나
 * 스키마 안정성을 위해 포함 (Route { legs: RouteLeg[] }는 이미 다구간 전제).
 */
import type { LatLng } from './geo.js';

/** 이동 수단 (§8). */
export type TravelMode = 'walk' | 'transit' | 'car' | 'bike';

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
  /** 인코딩된 경로 폴리라인 (지도 표시용, 선택). */
  polyline?: string;
}

/**
 * 전체 경로. 다구간(legs) 전제 (§8).
 * 총 소요 = Σ leg.durationSec + 환승 대기 버퍼.
 */
export interface Route {
  legs: RouteLeg[];
  /** 총 소요 시간(초) — 환승 대기 버퍼 포함. */
  totalDurationSec: number;
  /** 총 거리(미터). */
  totalDistanceM: number;
}
