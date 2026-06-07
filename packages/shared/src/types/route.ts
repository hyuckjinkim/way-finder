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
  /**
   * 커스텀 경로 메타 (P4, 선택). 2-call +N 필터 결과 — 프로필·예산 플래그.
   * 기존 P2 경로(fastest)는 미존재(하위호환). C3 요약·D2 게이트의 단일 입력.
   */
  customMeta?: RouteCustomMeta;
}
