/**
 * F3 — 합성 GPS 시퀀스 픽스처 (P3 §3 F3). 검증 무게중심(§0)의 입력.
 *
 * 결정론적 `LocationSample[]` 시퀀스 다종. nav 상태 머신(A2)·진행률(A3) 단위
 * 테스트의 oracle — 각 시퀀스에 기대 NavState 전이를 주석으로 명시한다.
 *
 * **골든 경로 정합(plan F3 완료 기준):** `REFERENCE_PATH`는 P4 Valhalla 골든 픽스처
 * WALK_SIMPLE(`services/proxy/.../walkSimple.ts`)의 디코드된 leg coords를 **복사**한
 * 것이다(precision 6, 55개 점). 따라서 시퀀스는 F2가 그 픽스처에서 추출한 `steps`
 * (턴 위치)와 동일 경로를 추종한다 — A2가 ON_ROUTE_SEQUENCE를 F2-정규화된 WALK_SIMPLE
 * Route와 짝지어 "다음 턴까지 거리"를 검증할 수 있다.
 *
 * **자기완결:** 좌표는 복사값으로 하드코딩한다 — 프록시 픽스처를 패키지 경계 너머로
 * import하지 않는다(apps/mobile은 services/proxy를 참조하지 않는다). 골든 타일 재캡처로
 * WALK_SIMPLE shape가 바뀌면 이 좌표도 재복사 필요.
 *
 * **이탈/경계 좌표:** REFERENCE_PATH 위 점(인덱스 43↔44 사이 정동 직선 구간 중점,
 * lat 37.570169)에서 남쪽으로 알려진 위도 오프셋을 더해 경로 수직 이탈을 만든다.
 * 그 구간은 정동이라 위도 오프셋이 순수 수직 거리 ≈ Δ×111,132 m. 인근 정점이 멀어
 * 최근접점 거리가 오프셋과 일치(테스트가 min-distance로 재확인). OFF_ROUTE_THRESHOLD_M
 * =30 을 사이에 두고 직전(≈29m)/직후(≈31m) straddle.
 */
import type { LatLng, LocationSample } from '@wayfinder/shared';

/**
 * 기준 경로 = WALK_SIMPLE 골든 픽스처의 디코드 leg coords(55개, precision 6, 복사값).
 * 시작=출발지(시청 인근), 마지막=목적지(종로 방면). F2가 이 경로에서 steps를 추출한다.
 */
export const REFERENCE_PATH: readonly LatLng[] = [
  { lat: 37.566421, lng: 126.977896 }, // 0  출발지
  { lat: 37.566429, lng: 126.978277 },
  { lat: 37.566381, lng: 126.978415 },
  { lat: 37.566362, lng: 126.97847 },
  { lat: 37.566347, lng: 126.978521 },
  { lat: 37.56634, lng: 126.978563 }, // 5
  { lat: 37.566322, lng: 126.978656 },
  { lat: 37.566273, lng: 126.978907 },
  { lat: 37.566259, lng: 126.978982 },
  { lat: 37.566253, lng: 126.979011 },
  { lat: 37.566246, lng: 126.979142 }, // 10
  { lat: 37.566364, lng: 126.979148 },
  { lat: 37.566899, lng: 126.979196 },
  { lat: 37.566878, lng: 126.979786 },
  { lat: 37.567345, lng: 126.979792 },
  { lat: 37.567342, lng: 126.979973 }, // 15
  { lat: 37.567323, lng: 126.980479 },
  { lat: 37.567312, lng: 126.980583 },
  { lat: 37.567697, lng: 126.980649 },
  { lat: 37.56789, lng: 126.981333 },
  { lat: 37.567983, lng: 126.982026 }, // 20
  { lat: 37.567988, lng: 126.98205 },
  { lat: 37.568014, lng: 126.982198 },
  { lat: 37.568011, lng: 126.982696 },
  { lat: 37.568603, lng: 126.982705 },
  { lat: 37.568628, lng: 126.982707 }, // 25
  { lat: 37.568677, lng: 126.982758 },
  { lat: 37.568736, lng: 126.982765 },
  { lat: 37.568762, lng: 126.982768 },
  { lat: 37.569007, lng: 126.982777 },
  { lat: 37.569074, lng: 126.982785 }, // 30
  { lat: 37.569199, lng: 126.982805 },
  { lat: 37.56953, lng: 126.982854 },
  { lat: 37.569662, lng: 126.982875 },
  { lat: 37.569908, lng: 126.983035 },
  { lat: 37.570028, lng: 126.98313 }, // 35
  { lat: 37.570105, lng: 126.983264 },
  { lat: 37.570158, lng: 126.983323 },
  { lat: 37.570164, lng: 126.983985 },
  { lat: 37.570167, lng: 126.984033 },
  { lat: 37.570153, lng: 126.984449 }, // 40
  { lat: 37.570126, lng: 126.98575 },
  { lat: 37.570163, lng: 126.986046 },
  { lat: 37.570172, lng: 126.986899 },
  { lat: 37.570167, lng: 126.987377 },
  { lat: 37.570169, lng: 126.98764 }, // 45
  { lat: 37.570177, lng: 126.987844 },
  { lat: 37.570175, lng: 126.988176 },
  { lat: 37.570183, lng: 126.988557 },
  { lat: 37.570221, lng: 126.989481 },
  { lat: 37.570235, lng: 126.98975 }, // 50
  { lat: 37.570329, lng: 126.99089 },
  { lat: 37.570351, lng: 126.991195 },
  { lat: 37.57039, lng: 126.991957 },
  { lat: 37.5704, lng: 126.9921 }, // 54  목적지
] as const;

/** 기준 경로의 목적지(마지막 점). 도착 판정 기준. */
export const DESTINATION: LatLng = REFERENCE_PATH[REFERENCE_PATH.length - 1]!;

/** 위도 오프셋(도) → 거리(m) 환산 상수 (lat ≈37.57). 픽스처 설계·테스트 공용. */
export const M_PER_DEG_LAT = 111132;

/**
 * 이탈/경계 베이스 점 — REFERENCE_PATH[43]↔[44] 정동 직선 구간 중점.
 * 이 점에서 남쪽 위도 오프셋이 순수 수직 이탈(인근 정점 멀어 최근접점 = 오프셋).
 */
const OFFSET_BASE: LatLng = { lat: 37.570169, lng: 126.987138 };

/** 고정 시작 타임스탬프 — 결정론. 샘플 간 1초(1000ms) 간격. */
const T0 = 1_700_000_000_000;
const STEP_MS = 1000;

/** 좌표 + 타임스탬프(i초)로 LocationSample 생성. */
function sample(coord: LatLng, i: number, accuracyM = 5): LocationSample {
  return {
    coord,
    accuracyM,
    timestampMs: T0 + i * STEP_MS,
    headingDeg: 90,
    speedMps: 1.4,
  };
}

/** 베이스 점에 남쪽 위도 오프셋(m)을 더한 좌표. */
function offsetSouthM(base: LatLng, meters: number): LatLng {
  return { lat: +(base.lat - meters / M_PER_DEG_LAT).toFixed(6), lng: base.lng };
}

/**
 * (1) on-route 추종 — 골든 경로를 정확히 따라 출발→목적지 진행(전 정점 통과).
 *
 * 기대 NavState 전이: idle → navigating(점 0~53, 다음 턴/진행률 갱신) → arrived
 * (점 54=목적지, ARRIVAL_RADIUS_M=20 내). 매 샘플 distanceRemaining 감소.
 */
export const ON_ROUTE_SEQUENCE: readonly LocationSample[] = REFERENCE_PATH.map((p, i) =>
  sample(p, i),
);

/**
 * (2) off-route 이탈 — 경로 진입 후 임계(30m)를 ≈50m 초과해 남쪽으로 이탈.
 *
 * 기대 NavState 전이: navigating(점 0~1, on-route) → off_route(점 2~3, ≈50m > 30m).
 * 상태 머신은 점 2에서 off_route 감지 → 재탐색 트리거(C3 엣지 트리거).
 */
export const OFF_ROUTE_SEQUENCE: readonly LocationSample[] = [
  sample(REFERENCE_PATH[42]!, 0),
  sample(REFERENCE_PATH[43]!, 1),
  sample(offsetSouthM(OFFSET_BASE, 50), 2), // ≈50m 남쪽 — 이탈
  sample(offsetSouthM(OFFSET_BASE, 50), 3), // 이탈 유지
];

/**
 * (3a) 경계 — 임계 직전(이탈 아님). ≈29m < 30m.
 * 기대 NavState: navigating 유지(off_route 미발생).
 */
export const BOUNDARY_JUST_UNDER_SEQUENCE: readonly LocationSample[] = [
  sample(REFERENCE_PATH[43]!, 0),
  sample(offsetSouthM(OFFSET_BASE, 29), 1), // ≈29m < 30m — 이탈 아님
];

/**
 * (3b) 경계 — 임계 직후(이탈). ≈31m > 30m.
 * 기대 NavState: navigating → off_route.
 */
export const BOUNDARY_JUST_OVER_SEQUENCE: readonly LocationSample[] = [
  sample(REFERENCE_PATH[43]!, 0),
  sample(offsetSouthM(OFFSET_BASE, 31), 1), // ≈31m > 30m — 이탈
];

/**
 * (3c) 도착 반경 진입 — 목적지 근처로 수렴(ARRIVAL_RADIUS_M=20 내).
 * 기대 NavState: navigating → arrived(마지막 샘플, 목적지 도달).
 */
export const ARRIVAL_SEQUENCE: readonly LocationSample[] = [
  sample(REFERENCE_PATH[53]!, 0),
  sample({ lat: +(DESTINATION.lat - 10 / M_PER_DEG_LAT).toFixed(6), lng: DESTINATION.lng }, 1), // ≈10m
  sample(DESTINATION, 2), // 목적지 정확
];

/**
 * (3d) GPS 정확도 나쁜 샘플 — 큰 accuracyM. on-route 위치이나 신뢰도 낮음.
 * 기대 NavState: 상태 머신/필터의 accuracyM 처리(무시/감쇠) 입력. 좌표는 on-route.
 */
export const POOR_ACCURACY_SEQUENCE: readonly LocationSample[] = [
  sample(REFERENCE_PATH[43]!, 0, 5), // 양호
  sample(REFERENCE_PATH[44]!, 1, 60), // 나쁨(60m 정확도)
  sample(offsetSouthM(OFFSET_BASE, 33), 2, 80), // 나쁨 + 위치 튐(≈33m)
];
