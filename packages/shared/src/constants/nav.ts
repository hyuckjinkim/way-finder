/**
 * 네비게이션 합성 상수 (P3 §1.5, F1). 단일 진실 소스.
 *
 * UI·상태 머신·스토어가 모두 이 상수를 import한다 — 자체 정의 금지(드리프트 방지,
 * routing.ts 패턴 계승). 값은 합성 검증값으로, 실 GPS 노이즈 특성 미반영 —
 * 디바이스 QA 후 튜닝 대상(§9 명시적 한계, open-question).
 */

/**
 * 경로 이탈 임계 거리(미터). 경로 최근접점에서 이 거리를 초과하면 이탈 판정.
 */
export const OFF_ROUTE_THRESHOLD_M = 30;

/**
 * 도착 판정 반경(미터). 목적지에서 이 반경 내 진입 시 도착(`arrived`).
 */
export const ARRIVAL_RADIUS_M = 20;

/**
 * 재탐색 디바운스(ms). 이탈 확정 후 재탐색 호출을 이 시간만큼 억제 —
 * 연속 off_route 샘플의 재탐색 스톰 방지(C3 in-flight 가드와 함께).
 */
export const REROUTE_DEBOUNCE_MS = 5000;
