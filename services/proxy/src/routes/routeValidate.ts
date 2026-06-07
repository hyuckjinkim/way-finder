/**
 * A3 — 경로 요청 입력 검증 + 장애 격리 헬퍼.
 *
 * `POST /v1/routes` body `{ stops, mode }`의 런타임 검증:
 * - stops 길이 2..6 (출발+도착 필수, 경유지 ≤5 → 최대 6).
 * - 각 stop이 유효한 LatLng (lat -90..90, lng -180..180).
 * - mode가 TravelMode 화이트리스트.
 *
 * 검증 실패 = 400. 공급자 fetch throw는 핸들러에서 명시적 에러 응답으로 격리
 * (silent failure 금지 — `runProviderOrError` 사용).
 */
import type { LatLng, TravelMode, RouteRequest } from '@wayfinder/shared';

/** 허용 이동 수단 화이트리스트 (TravelMode 유니온과 동기). */
const VALID_MODES: readonly TravelMode[] = ['walk', 'transit', 'car', 'bike'];

/** stops 최소/최대 (출발+도착 필수, 경유지 ≤5). */
export const MIN_STOPS = 2;
export const MAX_STOPS = 6;

/** 검증 결과 — 성공이면 파싱된 RouteRequest, 실패면 메시지. */
export type ValidateResult =
  | { ok: true; request: RouteRequest }
  | { ok: false; error: string };

/** 값이 유효한 LatLng인지. */
function isValidLatLng(v: unknown): v is LatLng {
  if (typeof v !== 'object' || v === null) return false;
  const c = v as { lat?: unknown; lng?: unknown };
  return (
    typeof c.lat === 'number' &&
    Number.isFinite(c.lat) &&
    c.lat >= -90 &&
    c.lat <= 90 &&
    typeof c.lng === 'number' &&
    Number.isFinite(c.lng) &&
    c.lng >= -180 &&
    c.lng <= 180
  );
}

/**
 * 파싱된 body를 검증해 RouteRequest로 좁힌다.
 * mode·stops 형태/길이/좌표 유효성을 모두 통과해야 ok.
 */
export function validateRouteBody(body: unknown): ValidateResult {
  if (typeof body !== 'object' || body === null) {
    return { ok: false, error: 'body must be an object' };
  }
  const { stops, mode } = body as { stops?: unknown; mode?: unknown };

  if (typeof mode !== 'string' || !VALID_MODES.includes(mode as TravelMode)) {
    return { ok: false, error: `invalid mode: ${String(mode)}` };
  }

  if (!Array.isArray(stops)) {
    return { ok: false, error: 'stops must be an array' };
  }
  if (stops.length < MIN_STOPS || stops.length > MAX_STOPS) {
    return {
      ok: false,
      error: `stops length must be ${MIN_STOPS}..${MAX_STOPS} (got ${stops.length})`,
    };
  }
  if (!stops.every(isValidLatLng)) {
    return { ok: false, error: 'each stop must be a valid {lat,lng}' };
  }

  return { ok: true, request: { stops: stops as LatLng[], mode: mode as TravelMode } };
}

/**
 * 공급자 호출을 감싸 실패 시 명시적 에러로 격리한다 (silent failure 금지).
 * 단일 Route 반환이라 부분 결과가 무의미 — 실패 시 throw하지 않고 에러 라벨을 로깅하고
 * null을 반환해 호출자가 502 에러 응답을 내도록 한다.
 *
 * @returns 성공 시 Route, 실패 시 null (에러는 console.error 로깅).
 */
export async function runProviderOrError<T>(
  fn: () => Promise<T>,
  label: string,
): Promise<T | null> {
  try {
    return await fn();
  } catch (err) {
    console.error(`[route] ${label} failed:`, err);
    return null;
  }
}
