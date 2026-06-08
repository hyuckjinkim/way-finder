/**
 * 라우팅 합성 상수 (§8). 단일 진실 소스.
 *
 * 프록시 leg-chaining 합성(B2)·시외 스티칭(B3)과 목 픽스처(F2)·테스트가 모두
 * 이 상수를 import한다 — 자체 상수 정의 금지(드리프트 방지, critic 부수 결정).
 */
import type { RoutePreference } from '../types/route.js';

/**
 * 대중교통 환승 1회당 대기 버퍼(초). 실측 데이터 없는 고정 상수 —
 * Phase 3+ 실시간 교통 연동 시 정밀화 (§7 명시적 한계).
 */
export const TRANSFER_BUFFER_SEC = 300;

/**
 * 경유지 최대 개수. stops = [출발, ...경유지, 도착]이므로 경유지만 ≤5.
 * 앱(waypoints.ts)·프록시(routeValidate.ts)가 모두 이 상수에서 파생한다 — 드리프트 방지.
 */
export const MAX_WAYPOINTS = 5;

/**
 * 경로 정지점(stops) 최대 개수 = 출발 1 + 경유지 MAX_WAYPOINTS + 도착 1.
 * 출발·도착 필수 + 경유지 ≤MAX_WAYPOINTS → 7.
 */
export const MAX_STOPS = MAX_WAYPOINTS + 2;

/**
 * "+N분" 예산 슬라이더 범위 (P4 §3 F1.3). UI 슬라이더(B2)·프록시 검증(OW2)이 모두
 * 이 상수에서 파생한다 — 드리프트 방지. 단일 진실 소스.
 */
export const MIN_EXTRA_MINUTES = 0;
export const MAX_EXTRA_MINUTES = 30;
/** N분 슬라이더 기본값 (미지정 시 UI 초기값). */
export const DEFAULT_EXTRA_MINUTES = 10;

/**
 * Valhalla pedestrian costing 옵션 (P4 §1 — 1차 출처 검증된 옵션만).
 * `valhallaProvider`(A2)가 프로필별로 `costing_options.pedestrian`에 병합한다.
 */
export interface PedestrianCostingOptions {
  walkway_factor?: number;
  sidewalk_factor?: number;
  alley_factor?: number;
  driveway_factor?: number;
  use_lit?: number;
  use_living_streets?: number;
}

/**
 * 프로필 → Valhalla costing 매핑 (P4 §1 검증 옵션 기반, §3 F1.2 확정값).
 *
 * **`*_factor`는 곱셈 비용 계수: <1.0=선호(비용↓), >1.0=회피(비용↑).**
 * - `walkable`: footway/보도 선호(`walkway_factor`·`sidewalk_factor` <1.0 → 보행로 우선).
 * - `safe`: 가로등(`use_lit=1` 비점등 회피) + 소로(alley/driveway) 회피로 큰길 근사.
 * - `quiet`: footway 선호(`walkway_factor` <1.0) + 생활도로 선호로 유동인구 적은 경로 근사.
 *
 * **`scenic`은 항목 없음(❌ 미지원)** — `RoutePreference`에는 존재하나 costing 미지원.
 * 공원·녹지 옵션이 Valhalla에 부재하여 그래프 보강 후속 단계에서 `ENABLE_SCENIC` flag로
 * 활성화. P4에서는 UI·costing 모두 비활성.
 * `fastest`도 항목 없음 — 표준 pedestrian costing(조정 없음)이므로 매핑 불필요.
 */
export const PROFILE_COSTING: Partial<
  Record<RoutePreference, PedestrianCostingOptions>
> = {
  // 곱셈 비용: <1.0=선호. 보행로(walkway/sidewalk) 우선 → 비용 낮춤.
  walkable: { walkway_factor: 0.5, sidewalk_factor: 0.5 },
  safe: { use_lit: 1.0, alley_factor: 4.0, driveway_factor: 8.0 },
  // 곱셈 비용: <1.0=선호. footway 우선(walkway_factor 0.7) + 생활도로 선호.
  quiet: { walkway_factor: 0.7, use_living_streets: 1.0 },
} as const;
