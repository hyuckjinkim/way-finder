/**
 * 실시간 교통 raw 응답 픽스처 (P5 F3, T 스트림 정규화 입력).
 *
 * ⚠️ **지식 기반 픽스처 — byte-perfect·실 형식 미보장.** 무료 티어 viability 미확정
 * (Google traffic-aware=상위 SKU, 카카오 무료 범위 미확정 — 계획 §1.3, open-questions §P5).
 * 라이브 데이터는 viability 확정 후. P5는 정규화·표시 메타까지만 — 이 픽스처는 그 행사용.
 *
 * 형식(추정 — 공급자 무관 중간 표현):
 * - `congestionLevel` = 공급자 혼잡 코드(추정: 1=원활, 2=서행, 3=정체) → ManeuverKind 식 버킷 매핑.
 * - `delaySeconds` = 교통 지연(초).
 * 정규화기(traffic.ts)가 leg 단위 `RouteLegTraffic{congestion,delaySec}`로 변환.
 */

/** 정체 구간 — congestionLevel 3, 지연 180초. 기대: {congestion:'jam', delaySec:180}. */
export const TRAFFIC_JAM_RAW = {
  congestionLevel: 3,
  delaySeconds: 180,
};

/** 서행 구간 — congestionLevel 2, 지연 60초. 기대: {congestion:'slow', delaySec:60}. */
export const TRAFFIC_SLOW_RAW = {
  congestionLevel: 2,
  delaySeconds: 60,
};

/** 원활 구간 — congestionLevel 1, 지연 0초. 기대: {congestion:'free', delaySec:0}. */
export const TRAFFIC_FREE_RAW = {
  congestionLevel: 1,
  delaySeconds: 0,
};

/** 교통 정보 부재 — 빈 응답. 기대: 메타 미부착(하위호환, 기존 동작). */
export const TRAFFIC_EMPTY_RAW = {};
