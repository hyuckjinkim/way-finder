/**
 * 네비게이션 상태 타입 (P3 §1, F1). 합성 GPS 시퀀스·실 GPS·상태 머신·UI·스토어가
 * 공유하는 단일 표면. 모든 좌표는 WGS84(LatLng).
 *
 * 검증 무게중심(§0): GPS 좌표 시퀀스를 합성 입력으로 받는 순수 로직. 따라서 실 GPS
 * 객체(expo-location `LocationObject`)와 합성 픽스처가 `LocationSample` 동일 타입으로
 * 수렴한다 — 상태 머신은 출처를 가리지 않는다.
 */
import type { LatLng } from './geo.js';
import type { RouteStep } from './route.js';

/**
 * 위치 표본 (실 GPS·합성 시퀀스 공통 표면). expo-location `LocationObject`와
 * F3 합성 픽스처가 이 타입으로 수렴 — LocationProvider 매핑의 출력.
 */
export interface LocationSample {
  /** WGS84 좌표 (필수). */
  coord: LatLng;
  /** 진행 방위(도, 0..360, 선택). 정지·미측정 시 부재. */
  headingDeg?: number;
  /** 속도(m/s, 선택). */
  speedMps?: number;
  /** 수평 정확도(미터, 선택). 클수록 부정확 — 나쁜 샘플 필터링 입력. */
  accuracyM?: number;
  /** 표본 타임스탬프(epoch ms). */
  timestampMs: number;
}

/**
 * 네비 상태 enum.
 * - `idle`: 미시작.
 * - `navigating`: on-route 추종 중.
 * - `off_route`: 경로 이탈(최근접점 거리 > OFF_ROUTE_THRESHOLD_M).
 * - `rerouting`: 이탈 확정 → 재탐색 진행 중.
 * - `arrived`: 도착(목적지 ARRIVAL_RADIUS_M 진입).
 */
export type NavStatus = 'idle' | 'navigating' | 'off_route' | 'rerouting' | 'arrived';

/**
 * 네비 상태 (상태 머신 출력의 단일 표면 — UI·스토어의 단일 입력).
 * `(NavState, LocationSample, Route) → NavState` 순수 reducer의 산물(A2).
 */
export interface NavState {
  status: NavStatus;
  /** 활성 leg 인덱스 (Route.legs). */
  activeLegIndex: number;
  /** 활성 step 인덱스 (leg.steps). steps 없는 경로는 0 고정. */
  activeStepIndex: number;
  /** 현재 위치 → 다음 턴(nextStep.location)까지 거리(미터). */
  distanceToNextTurnM: number;
  /** 목적지까지 남은 거리(미터). */
  distanceRemainingM: number;
  /** 남은 시간(초, 비례 추정). */
  durationRemainingSec: number;
  /** 다음 턴 step (steps 있는 경로만 — 폴리라인 추종 네비는 부재). */
  nextStep?: RouteStep;
}

/**
 * 진행률 (A3 산출). `NavState`의 남은 거리/시간과 중복하지 않는 *파생 비율* 단일값:
 * `fraction`은 경로 전체 대비 완료 비율(0..1). 남은 거리/시간 절대값은 `NavState`가
 * 소유하므로 여기서 재정의하지 않는다(중복 0 — advisor 지적).
 */
export interface NavProgress {
  /** 경로 완료 비율 (0..1). 0=출발, 1=도착. */
  fraction: number;
}
