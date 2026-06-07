/**
 * 라우팅 합성 상수 (§8). 단일 진실 소스.
 *
 * 프록시 leg-chaining 합성(B2)·시외 스티칭(B3)과 목 픽스처(F2)·테스트가 모두
 * 이 상수를 import한다 — 자체 상수 정의 금지(드리프트 방지, critic 부수 결정).
 */

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
