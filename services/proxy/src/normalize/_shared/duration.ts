/**
 * F2 — 소요시간 파싱 공용 유틸 (중복 통합).
 *
 * 통합 전: googleRoutes.ts·googleTransit.ts 각각 `parseDurationSec` 정의(2곳 중복).
 * 통합 후: 이 단일 정의만 사용 — 드리프트 방지(P4 carry-forward ②).
 *
 * 입력 형식:
 * - Google Routes/Transit: `'123s'` 또는 `'123.4s'` 문자열(초 + 's' 접미).
 * 누락/형식 이상 시 0 (방어적 — 장애 격리는 핸들러 책임).
 */

/** `'123s'`·`'123.4s'` → 초(정수, 반올림). 누락/형식 이상 시 0. */
export function parseDurationSec(d: string | undefined): number {
  if (!d) return 0;
  const m = /^(\d+(?:\.\d+)?)s$/.exec(d.trim());
  return m ? Math.round(parseFloat(m[1]!)) : 0;
}
