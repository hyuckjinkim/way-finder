/**
 * A4 — 장애 격리 (graceful degradation) 헬퍼.
 *
 * 공급자 한 곳 실패 시 해당 섹션만 생략하고 나머지는 정상 렌더링.
 * silent failure 금지 — 에러는 반드시 console.error로 로깅.
 *
 * 사용 패턴:
 *   const reviews = await fetchWithFallback(
 *     () => fetchGoogleReviews(id),
 *     [],
 *     'google-reviews',
 *   );
 */

/**
 * 비동기 작업을 실행하고 실패 시 fallback 값을 반환한다.
 * 에러는 콘솔에 로깅 (silent failure 금지).
 *
 * @param fn - 실행할 비동기 함수
 * @param fallback - 실패 시 반환할 기본값
 * @param label - 에러 로그 식별자 (어느 공급자가 실패했는지 추적)
 */
export async function fetchWithFallback<T>(
  fn: () => Promise<T>,
  fallback: T,
  label: string,
): Promise<T> {
  try {
    return await fn();
  } catch (err) {
    console.error(`[degradation] ${label} failed:`, err);
    return fallback;
  }
}
