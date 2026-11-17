/**
 * 경로 모델 (설계 문서 §8). Phase 2 길찾기 범위.
 * Route { legs: RouteLeg[] }는 이미 다구간 전제 — 대중교통 leg-chaining·시외
 * 스티칭은 여러 leg의 합성으로 표현 (§8).
 */
import type { LatLng } from './geo.js';

/** 이동 수단 (§8). */
export type TravelMode = 'walk' | 'transit' | 'car' | 'bike';

/**
 * 경로 선호 프로필 (P4 §1). 커스텀 도보 경로 차별화.
 * - `fastest`: 미지정 기본값 = 기존 P2 동작(표준 pedestrian, costing 조정 없음).
 * - `walkable`/`safe`/`quiet`: Valhalla costing 조정으로 지원 (routing.ts 매핑 테이블).
 * - `scenic`: 타입에는 존재하나 P4 costing 미지원(❌) — 그래프 보강 후속 단계에서
 *   `ENABLE_SCENIC` flag로 활성화. costing 매핑 테이블에 항목 없음.
 */
export type RoutePreference = 'fastest' | 'walkable' | 'safe' | 'quiet' | 'scenic';

/**
 * 경로 탐색 요청 (§8 + P4 §3 F1). 클라이언트 → 프록시 `POST /v1/routes` body.
 *
 * `stops`는 [출발지, …경유지, 도착지] 순서. 길이 제약(2..6, 경유지 ≤5)은
 * 타입이 아니라 런타임 검증(프록시 routeValidate)으로 강제한다.
 *
 * `preference`/`maxExtraMinutes`는 P4 신규(선택). 미지정 시 기존 P2 동작과 동일 —
 * 기존 호출자는 하위호환 유지(미지정=`fastest`=무제한 예산).
 */
export interface RouteRequest {
  /** 경유 좌표 순서열. stops[0]=출발, stops[last]=도착, 그 사이=경유지(≤5). */
  stops: LatLng[];
  mode: TravelMode;
  /**
   * 경로 선호 프로필 (P4). 미지정=`fastest`=기존 동작.
   * Valhalla 커스텀 경로는 `region==='kr' && mode==='walk' && preference!=='fastest'`에만 진입.
   */
  preference?: RoutePreference;
  /**
   * "+N분" 예산 (P4 2-call 필터). 프로필 경로가 최속 경로 대비 추가로 허용하는 분.
   * 미지정=무제한(예산 검사 없음). 범위는 routing.ts MAX_EXTRA_MINUTES 상수.
   */
  maxExtraMinutes?: number;
}

/**
 * 커스텀 경로 응답 메타 (P4 §3 F1). 2-call +N 필터 결과의 단일 표면.
 * - 데모 모드: mockRouteProvider가 합성 플래그로 채움 (F2).
 * - 실 모드: extraMinutesFilter(OO1)가 실 산출값으로 채움.
 * `fastest`(기존 P2 경로)는 이 메타가 없다(하위호환 — 미존재 시 플래그 미표시).
 */
export interface RouteCustomMeta {
  /** 적용된 선호 프로필. */
  preference: RoutePreference;
  /** 프로필 경로 소요가 `최속 + maxExtraMinutes` 예산 이내인지. */
  withinBudget: boolean;
  /** 비교 기준이 된 최속(fastest) 경로 소요(초). 데모 합성·실 산출 공통. */
  baselineDurationSec?: number;
}

/**
 * 공급자 무관 정규화 maneuver 종류 (P5 F1 §1.2).
 *
 * **provider-agnostic 단일 키.** Valhalla numeric·카카오 numeric·Google 문자열 enum은
 * 서로 다른 코드스페이스라 같은 필드(`RouteStep.type: number`)에 재사용하면 wire 드리프트.
 * 안내 어휘·아이콘 함수는 *이 정규화 enum만* 키로 쓰고(공급자 무관), 미존재·`'unknown'`이면
 * `RouteStep.instruction` 원문으로 폴백한다.
 * - 매핑 테이블 완전성은 실 응답(키 발급) 후 보강(open-questions §P5). 미매핑 코드→`'unknown'`.
 */
export type ManeuverKind =
  | 'depart'
  | 'turn-left'
  | 'turn-right'
  | 'slight-left'
  | 'slight-right'
  | 'straight'
  | 'uturn'
  | 'roundabout'
  | 'merge'
  | 'fork'
  | 'arrive'
  | 'unknown';

/**
 * 경로의 한 턴(maneuver) — 턴바이턴 네비의 단일 단위 (P3 §1).
 *
 * Valhalla `maneuvers[]` 정규화 산물(F2). 상태 머신의 "다음 턴까지 거리" 입력이
 * 되려면 턴이 *어디서* 일어나는지(`location`) 알아야 한다 — 이것이 `location`을
 * 필수로 두는 이유(advisor 핵심 지적). 디바이스 산물이 아니라 정규화 산물.
 */
export interface RouteStep {
  /**
   * 턴 시작 좌표 (필수). Valhalla `begin_shape_index` → 해당 leg `coords[index]`.
   * "다음 턴까지 거리"(현재 위치 → 다음 step.location)의 입력.
   */
  location: LatLng;
  /** 안내 문구 (예: "Turn left onto 무교로."). Valhalla `instruction`. */
  instruction: string;
  /**
   * 정규화 maneuver 종류 (P5 F1, 선택). **소비자(안내 어휘·아이콘)의 단일 키** —
   * Valhalla numeric·카카오 numeric·Google 문자열이 이 enum으로 수렴(§1.2).
   * 미존재 시 `instruction` 원문 폴백. 가산 optional이라 기존 인라인 `RouteStep`
   * 리터럴(maneuver 미기재) 무수정 — P3 `steps?`·P4 `customMeta` 하위호환 패턴.
   */
  maneuver?: ManeuverKind;
  /**
   * 공급자 raw maneuver 코드 (선택 — 디버그·후속용). Valhalla numeric / 카카오 numeric
   * 원값 보존. **공급자마다 의미가 다른 코드스페이스라 소비자 키로 쓰지 않는다**(→ `maneuver`).
   * Google은 numeric 코드 자체가 없어 부재 가능. 주요 Valhalla 코드:
   * 2=출발, 4=도착, 8=직진, 10=우회전, 15=좌회전.
   */
  type?: number;
  /** 이 step 구간 거리(미터). Valhalla `length`(km) ×1000. 도착 step은 0. */
  distanceM: number;
  /** 도로명 (선택). Valhalla `street_names` — 도착·이름 없는 턴에는 부재. */
  streetNames?: string[];
  /** leg `coords` 인덱스 (선택). 정확 투영용 — `begin_shape_index` 원값 보존. */
  shapeIndex?: number;
}

/**
 * 실시간 교통 leg 메타 (P5 F1, 선택). 도보/대중교통 leg에는 부재.
 *
 * steps·customMeta 하위호환 패턴 — 미존재=교통 정보 없음(기존 동작). 실시간 교통
 * 정규화(traffic.ts)·NavScreen 표시(U)의 단일 표면. 라이브 데이터는 무료 티어
 * viability 확정 후(open-questions §P5) — 현재는 정규화·표시까지만.
 */
export interface RouteLegTraffic {
  /** 혼잡도 버킷. `free`=원활, `slow`=서행, `jam`=정체. */
  congestion?: 'free' | 'slow' | 'jam';
  /** 교통으로 인한 추가 지연(초). 미존재=지연 미상. */
  delaySec?: number;
}

/**
 * 대중교통 leg 메타 (선택). 도보/차/자전거 leg는 사용하지 않는다.
 * `lineType: 'air'`는 ODsay 도시간 응답에서만 생성 — 다른 정규화기는 사용 금지.
 */
export interface TransitMeta {
  lineName: string;
  lineType: 'subway' | 'bus' | 'train' | 'express' | 'air';
  headsign?: string;
  /** 노선 공식색 (#RRGGBB) — 알 수 없으면 미존재. */
  lineColor?: string;
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
  /**
   * 턴바이턴 step (P3, 선택). Valhalla maneuvers 보유 경로(커스텀 도보)만 부착 —
   * 미존재=기존 동작(기존 5개 정규화기·P4 Valhalla 폴리라인 경로 불변, 무회귀).
   * steps 있는 경로만 턴 안내 네비, 없는 경로는 폴리라인 추종 네비로 graceful degrade.
   * (P4 `customMeta` 하위호환 패턴 그대로 — optional, 미존재 시 미부착.)
   */
  steps?: RouteStep[];
  /**
   * 실시간 교통 메타 (P5 F1, 선택). 미존재=교통 정보 없음(기존 동작 — 기존 정규화기
   * 무회귀). traffic 정규화기(traffic.ts)가 채우고 NavScreen이 혼잡 표시에 소비.
   */
  traffic?: RouteLegTraffic;
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
  /**
   * 커스텀 경로 메타 (P4, 선택). 2-call +N 필터 결과 — 프로필·예산 플래그.
   * 기존 P2 경로(fastest)는 미존재(하위호환). C3 요약·D2 게이트의 단일 입력.
   */
  customMeta?: RouteCustomMeta;
  /** 대중교통 요금(원, 선택). */
  fare?: number;
  /** 대안 경로 (첫 경로=자신 제외). 대중교통만 채운다. */
  alternatives?: Route[];
}
