/**
 * D1 — API 클라이언트.
 *
 * EXPO_PUBLIC_PROXY_BASE_URL env가 설정되면 실 프록시 모드, 미설정이면 데모 모드.
 * EXPO_PUBLIC_ 접두사 변수는 Metro/Expo가 빌드 시 정적으로 인라인하므로
 * process.env 직접 참조가 정석이다(expo-constants 불필요).
 */

/**
 * 프록시 베이스 URL. undefined이면 데모 모드.
 *
 * `EXPO_PUBLIC_PROXY_BASE_URL`이 정식 이름이다(.env.example·app.config.ts·문서·RELEASE-CHECKLIST
 * 가 모두 이 이름을 안내). 과거 코드가 쓰던 `EXPO_PUBLIC_API_URL`은 레거시 폴백으로만 유지한다.
 * 변수명이 어긋나면 키를 넣어도 앱이 계속 데모 모드로 동작하므로 정식 이름을 먼저 읽는다.
 * 점 표기(`process.env.X`) 접근만 Metro가 정적 인라인하므로 점 표기를 사용한다.
 */
// ⚠️ process.env를 `as any` 캐스트로 감싸면 babel 인라이너가 `process.env.X` 패턴을 못 찾아
// 웹 번들에 값이 안 들어간다(배포 웹이 데모 모드로 돌던 원인, 2026-11-18). 반드시 맨 점 표기.
const API_BASE_URL: string | undefined =
  process.env.EXPO_PUBLIC_PROXY_BASE_URL || process.env.EXPO_PUBLIC_API_URL || undefined;

/**
 * 데모 모드 플래그.
 * true → 실 프록시 호출 없이 mock provider 사용.
 * false → API_BASE_URL 기반 프록시 호출.
 */
export const isDemoMode: boolean = !API_BASE_URL;

/** HTTP 오류 — 호출자가 상태 코드로 분기할 수 있게 status를 보존한다 (예: 501 = 이동수단 미지원). */
export class ApiError extends Error {
  readonly status: number;
  /** 프록시 오류 본문 `{error, code}`의 code (예: /v1/routes의 'quota'|'no_route'|'too_close'|'upstream'). */
  readonly code?: string;
  constructor(status: number, message: string, code?: string) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    if (code !== undefined) this.code = code;
  }
}

/** 프록시 요청 타임아웃 — 응답이 없으면 "탐색 중"이 영원히 걸린다. */
const REQUEST_TIMEOUT_MS = 10_000;
/** AbortSignal.timeout 없는 런타임(구형 Hermes)은 타임아웃 생략. */
const timeoutSignal = (): AbortSignal | undefined => AbortSignal.timeout?.(REQUEST_TIMEOUT_MS);

/** 실패 응답 → ApiError. 본문이 `{code}` JSON이면 code를 싣는다(본문 없음·비JSON은 무시). */
async function toApiError(res: Response, url: string): Promise<ApiError> {
  let code: string | undefined;
  try {
    const body = (await res.json()) as { code?: unknown };
    if (typeof body?.code === 'string') code = body.code;
  } catch {
    // 비JSON 본문 — status만으로 분기.
  }
  return new ApiError(res.status, `API error ${res.status}: ${res.statusText} — ${url}`, code);
}

/**
 * 프록시 API를 호출하고 JSON을 반환한다.
 * 실 모드에서만 사용해야 한다(데모 모드에서는 mock provider를 사용할 것).
 *
 * @param path  `/v1/places/search?q=...` 형태의 경로 + 쿼리스트링
 * @returns     파싱된 JSON (unknown — 호출자가 타입 단언)
 * @throws      네트워크/HTTP 오류 시 Error
 */
export async function apiFetch(path: string): Promise<unknown> {
  if (!API_BASE_URL) {
    throw new Error(
      'apiFetch called in demo mode — use PlaceService which handles mode routing.',
    );
  }
  const url = `${API_BASE_URL}${path}`;
  const res = await fetch(url, { signal: timeoutSignal() });
  if (!res.ok) throw await toApiError(res, url);
  return res.json() as Promise<unknown>;
}

/**
 * 프록시 API에 JSON body로 POST하고 JSON을 반환한다 (예: `POST /v1/routes`).
 * 실 모드에서만 사용해야 한다(데모 모드에서는 mock provider를 사용할 것).
 *
 * @param path  `/v1/routes` 형태의 경로 (shared/api 상수를 사용할 것)
 * @param body  직렬화할 요청 body (예: RouteRequest `{ stops, mode }`)
 * @returns     파싱된 JSON (unknown — 호출자가 타입 단언)
 * @throws      데모 모드 호출·네트워크/HTTP 오류 시 Error
 */
export async function apiPost(path: string, body: unknown): Promise<unknown> {
  if (!API_BASE_URL) {
    throw new Error(
      'apiPost called in demo mode — use RouteService which handles mode routing.',
    );
  }
  const url = `${API_BASE_URL}${path}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
    signal: timeoutSignal(),
  });
  if (!res.ok) throw await toApiError(res, url);
  return res.json() as Promise<unknown>;
}
