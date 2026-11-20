/**
 * 대중교통 탐색 오류 — 공급자(ODsay·프록시 카카오) 실패를 코드로 분류한다.
 * 호출자는 코드로 폴백·재시도·문구를 결정한다(quota·no_route·too_close는 재시도/폴백 무의미).
 */
export type TransitErrorCode = 'quota' | 'no_route' | 'too_close' | 'auth' | 'upstream';

const CODES: readonly TransitErrorCode[] = ['quota', 'no_route', 'too_close', 'auth', 'upstream'];

export class TransitError extends Error {
  readonly code: TransitErrorCode;
  constructor(code: TransitErrorCode, message?: string) {
    super(message ?? `transit: ${code}`);
    this.name = 'TransitError';
    this.code = code;
  }
}

export const isTransitErrorCode = (v: unknown): v is TransitErrorCode =>
  CODES.includes(v as TransitErrorCode);

/**
 * TransitError면 코드, 아니면 undefined.
 * instanceof 대신 name으로 판별 — 테스트의 vi.resetModules·번들 중복으로 클래스 정체성이 갈라져도 동작.
 */
export function transitErrorCode(err: unknown): TransitErrorCode | undefined {
  const e = err as { name?: unknown; code?: unknown } | null;
  return e?.name === 'TransitError' && isTransitErrorCode(e.code) ? e.code : undefined;
}

/**
 * ODsay 에러 본문(HTTP 200 + `{error:[{code,message}]}` 또는 `{error:{code,msg}}`) → 코드.
 * 확인된 것은 `[ApiKeyAuthFailed]`(실측)뿐. -98(출·도착 700m 이내)·-99(검색결과 없음)는 ODsay 문서 기준,
 * quota 본문은 미문서화(429 "Daily quota exceeded" 추정). 모르는 건 upstream — 프록시(카카오) 폴백을 막지 않도록.
 */
export function classifyOdsayError(error: unknown): TransitErrorCode {
  const e = (Array.isArray(error) ? error[0] : error) as { code?: unknown; message?: unknown; msg?: unknown } | undefined;
  const code = String(e?.code ?? '');
  const msg = String(e?.message ?? e?.msg ?? '');
  if (code === '429' || /quota/i.test(msg)) return 'quota';
  if (code === '-98') return 'too_close';
  if (code === '-99') return 'no_route';
  if (/ApiKeyAuthFailed/i.test(msg)) return 'auth';
  return 'upstream';
}
