/**
 * F3 — 합성 GPS 시퀀스 픽스처 (P3 §3 F3). 검증 무게중심(§0)의 입력.
 *
 * 결정론적 `LocationSample[]` 시퀀스 다종. nav 상태 머신(A2)·진행률(A3) 단위
 * 테스트의 oracle — 각 시퀀스에 기대 NavState 전이를 주석으로 명시한다.
 *
 * **자기완결(self-contained):** 좌표는 여기서 직접 하드코딩한다. 프록시 Valhalla
 * 골든 픽스처를 패키지 경계 너머로 import하지 않는다(apps/mobile은 services/proxy를
 * 참조하지 않는다 — 계획에 없는 의존). 대신 아래 REFERENCE_PATH가 시퀀스가 추종하는
 * 경로를 명시 — A2가 이 좌표로 매칭 Route를 구성한다.
 *
 * **기하 설계 (서울 bbox, lat 37.5665):**
 * - 경도 1° ≈ 88,237 m, 위도 1° ≈ 111,132 m (위도 37.5665 기준).
 * - REFERENCE_PATH는 위도 고정·정동(due east) 직선 → 경로 수직 이탈 = 순수 위도 오프셋.
 *   따라서 위도 +Δ는 수직 거리 Δ×111,132 m로 깔끔하게 환산(임계 30m 판정 검증 가능).
 * - 경계 케이스: 위도 +0.000261(≈29.0m, 이탈 아님) vs +0.000279(≈31.0m, 이탈).
 *   OFF_ROUTE_THRESHOLD_M=30 을 사이에 두고 직전/직후로 straddle.
 */
import type { LatLng, LocationSample } from '@wayfinder/shared';

/**
 * 시퀀스가 추종하는 기준 경로 (정동 직선, lat 고정). A2는 이 좌표로 Route를 구성한다.
 * 점 간격 ≈ 50m (경도 +0.0005667°). 시작=출발지, 마지막=목적지.
 */
export const REFERENCE_PATH: readonly LatLng[] = [
  { lat: 37.5665, lng: 126.978 }, // 0  출발지
  { lat: 37.5665, lng: 126.9785667 }, // 1  ~50m
  { lat: 37.5665, lng: 126.9791334 }, // 2  ~100m
  { lat: 37.5665, lng: 126.9797001 }, // 3  ~150m
  { lat: 37.5665, lng: 126.9802668 }, // 4  ~200m  목적지
] as const;

/** 기준 경로의 목적지(마지막 점). 도착 판정 기준. */
export const DESTINATION: LatLng = REFERENCE_PATH[REFERENCE_PATH.length - 1]!;

/** 위도 오프셋(도) → 수직 거리(m) 환산 상수 (lat 37.5665). 픽스처 설계·테스트 공용. */
export const M_PER_DEG_LAT = 111132;

/** 고정 시작 타임스탬프 — 결정론. 샘플 간 1초(1000ms) 간격. */
const T0 = 1_700_000_000_000;
const STEP_MS = 1000;

/** 기준 경로 위 점에 위도 오프셋을 더해 LocationSample 생성 (i번째 타임스탬프). */
function sampleAt(base: LatLng, latOffsetDeg: number, i: number, accuracyM = 5): LocationSample {
  return {
    coord: { lat: base.lat + latOffsetDeg, lng: base.lng },
    accuracyM,
    timestampMs: T0 + i * STEP_MS,
    headingDeg: 90, // 정동 진행
    speedMps: 1.4, // 보행 속도
  };
}

/**
 * (1) on-route 추종 — 기준 경로를 정확히 따라 출발→목적지 진행.
 *
 * 기대 NavState 전이: idle → navigating(점 0~3, 다음 턴/진행률 갱신) → arrived(점 4,
 * 목적지 ARRIVAL_RADIUS_M=20 내). 매 샘플 distanceToNextTurn·distanceRemaining 감소.
 */
export const ON_ROUTE_SEQUENCE: readonly LocationSample[] = REFERENCE_PATH.map((p, i) =>
  sampleAt(p, 0, i),
);

/**
 * (2) off-route 이탈 — 경로 진입 후 임계(30m)를 초과해 북쪽으로 이탈.
 *
 * 기대 NavState 전이: navigating(점 0~1, on-route) → off_route(점 2~3, 위도 +0.00045
 * ≈50m > 30m). 상태 머신은 점 2에서 off_route 감지 → 재탐색 트리거 판정(C3 엣지 트리거).
 */
export const OFF_ROUTE_SEQUENCE: readonly LocationSample[] = [
  sampleAt(REFERENCE_PATH[0]!, 0, 0),
  sampleAt(REFERENCE_PATH[1]!, 0, 1),
  sampleAt(REFERENCE_PATH[2]!, 0.00045, 2), // ≈50m 북쪽 — 이탈
  sampleAt(REFERENCE_PATH[3]!, 0.00045, 3), // ≈50m 북쪽 — 이탈 유지
];

/**
 * (3a) 경계 — 임계 직전(이탈 아님). 위도 +0.000261 ≈ 29.0m < 30m.
 *
 * 기대 NavState: navigating 유지(off_route 미발생) — 임계 직전은 on-route로 취급.
 */
export const BOUNDARY_JUST_UNDER_SEQUENCE: readonly LocationSample[] = [
  sampleAt(REFERENCE_PATH[1]!, 0, 0),
  sampleAt(REFERENCE_PATH[2]!, 0.000261, 1), // ≈29.0m < 30m — 이탈 아님
];

/**
 * (3b) 경계 — 임계 직후(이탈). 위도 +0.000279 ≈ 31.0m > 30m.
 *
 * 기대 NavState: navigating → off_route(점 1에서 임계 초과 감지).
 */
export const BOUNDARY_JUST_OVER_SEQUENCE: readonly LocationSample[] = [
  sampleAt(REFERENCE_PATH[1]!, 0, 0),
  sampleAt(REFERENCE_PATH[2]!, 0.000279, 1), // ≈31.0m > 30m — 이탈
];

/**
 * (3c) 도착 반경 진입 — 목적지 근처로 수렴(ARRIVAL_RADIUS_M=20 내).
 *
 * 기대 NavState: navigating → arrived(마지막 샘플, 목적지 ≈10m 내).
 */
export const ARRIVAL_SEQUENCE: readonly LocationSample[] = [
  sampleAt(REFERENCE_PATH[3]!, 0, 0),
  sampleAt(DESTINATION, 0.00009, 1), // ≈10m 북쪽 — 도착 반경 내
  sampleAt(DESTINATION, 0, 2), // 목적지 정확
];

/**
 * (3d) GPS 정확도 나쁜 샘플 — 큰 accuracyM. on-route 위치이나 신뢰도 낮음.
 *
 * 기대 NavState: 상태 머신/필터가 accuracyM 큰 샘플을 어떻게 다루는지(무시/감쇠)의
 * 입력. 좌표 자체는 on-route이므로 필터링 전엔 navigating.
 */
export const POOR_ACCURACY_SEQUENCE: readonly LocationSample[] = [
  sampleAt(REFERENCE_PATH[1]!, 0, 0, 5), // 양호
  sampleAt(REFERENCE_PATH[2]!, 0, 1, 60), // 나쁨(60m 정확도)
  sampleAt(REFERENCE_PATH[2]!, 0.0003, 2, 80), // 나쁨 + 위치 튐(≈33m 북쪽)
];
