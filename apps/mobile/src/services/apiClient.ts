/**
 * D1 — API 클라이언트.
 *
 * EXPO_PUBLIC_API_URL env가 설정되면 실 프록시 모드, 미설정이면 데모 모드.
 * EXPO_PUBLIC_ 접두사 변수는 Metro/Expo가 빌드 시 정적으로 인라인하므로
 * process.env 직접 참조가 정석이다(expo-constants 불필요).
 */

/** 프록시 베이스 URL. undefined이면 데모 모드. */
const API_BASE_URL: string | undefined =
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (process.env as any)['EXPO_PUBLIC_API_URL'] as string | undefined;

/**
 * 데모 모드 플래그.
 * true → 실 프록시 호출 없이 mock provider 사용.
 * false → API_BASE_URL 기반 프록시 호출.
 */
export const isDemoMode: boolean = !API_BASE_URL;

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
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`API error ${res.status}: ${res.statusText} — ${url}`);
  }
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
  });
  if (!res.ok) {
    throw new Error(`API error ${res.status}: ${res.statusText} — ${url}`);
  }
  return res.json() as Promise<unknown>;
}
