/**
 * 실시간 교통 정규화 (P5 T1). 공급자 교통 응답(혼잡 코드·지연) → `RouteLegTraffic`.
 *
 * 카카오모빌리티/Google 등 공급자 교통 메타를 leg 단위 `{congestion, delaySec}`로 수렴.
 * `congestionLevel`(추정 1=원활,2=서행,3=정체) → `'free'|'slow'|'jam'` 버킷, `delaySeconds`→`delaySec`.
 *
 * ⚠️ **지식 기반 픽스처 — byte-perfect·실 형식 미보장.** 무료 티어 viability 미확정
 * (Google traffic-aware=상위 SKU, 카카오 무료 범위 미확정 — 계획 §1.3, open-questions §P5).
 * 라이브 데이터는 viability 확정 후. P5는 정규화·표시 메타까지만.
 *
 * 하위호환: 교통 정보 부재(빈 입력·미매핑 혼잡도·지연 미상)면 해당 필드 미부착 →
 * 입력이 전부 비면 `undefined` 반환(호출자가 leg.traffic 미부착 — 기존 동작 무회귀).
 */
import type { RouteLegTraffic } from '@wayfinder/shared';

/**
 * 공급자 교통 raw (공급자 무관 중간 표현). 정규화 입력 계약.
 * - `congestionLevel`: 공급자 혼잡 코드(추정 1=원활, 2=서행, 3=정체).
 * - `delaySeconds`: 교통 지연(초).
 */
export interface TrafficRaw {
  congestionLevel?: number;
  delaySeconds?: number;
}

/**
 * 공급자 혼잡 코드 → `congestion` 버킷 (P5 T1 §1.2).
 *
 * ⚠️ 추정 코드표 — 실 코드표는 키 발급 후 검증(open-questions §P5). 미매핑·undefined →
 * `undefined`(혼잡도 미상, 필드 미부착). Google·카카오 응답을 동일 enum으로 수렴(load-bearing).
 */
const CONGESTION_BUCKET: Readonly<Record<number, RouteLegTraffic['congestion']>> = {
  1: 'free', // 원활
  2: 'slow', // 서행
  3: 'jam', // 정체
};

/** 공급자 혼잡 코드 → `congestion`. 미매핑·undefined → `undefined`(미부착). */
function congestionBucket(level: number | undefined): RouteLegTraffic['congestion'] {
  return level !== undefined ? CONGESTION_BUCKET[level] : undefined;
}

/**
 * 공급자 교통 raw → `RouteLegTraffic` 메타. 혼잡도·지연 둘 다 부재 시 `undefined`
 * (호출자가 leg.traffic 미부착 — 하위호환). 둘 중 하나만 있어도 메타 부착.
 *
 * - `congestionLevel` → `congestion` 버킷 (미매핑 시 필드 생략).
 * - `delaySeconds` → `delaySec` (미존재 시 필드 생략, 음수는 0으로 클램프).
 */
export function normalizeTraffic(raw: TrafficRaw): RouteLegTraffic | undefined {
  const congestion = congestionBucket(raw.congestionLevel);
  const delaySec =
    raw.delaySeconds !== undefined ? Math.max(0, raw.delaySeconds) : undefined;

  if (congestion === undefined && delaySec === undefined) return undefined;

  const traffic: RouteLegTraffic = {};
  if (congestion !== undefined) traffic.congestion = congestion;
  if (delaySec !== undefined) traffic.delaySec = delaySec;
  return traffic;
}
