/**
 * A3 — 경로 요청 입력 검증 + 장애 격리 헬퍼.
 *
 * `POST /v1/routes` body `{ stops, mode }`의 런타임 검증:
 * - stops 길이 2..7 (출발+도착 필수, 경유지 ≤MAX_WAYPOINTS(5) → 최대 7).
 * - 각 stop이 유효한 LatLng (lat -90..90, lng -180..180).
 * - mode가 TravelMode 화이트리스트.
 *
 * 검증 실패 = 400. 공급자 fetch throw는 핸들러에서 명시적 에러 응답으로 격리
 * (silent failure 금지 — `runProviderOrError` 사용).
 */
import type {
  LatLng,
  TravelMode,
  RouteRequest,
  RoutePreference,
} from '@wayfinder/shared';
import { MAX_STOPS, MIN_EXTRA_MINUTES, MAX_EXTRA_MINUTES } from '@wayfinder/shared';

/** 허용 이동 수단 화이트리스트 (TravelMode 유니온과 동기). */
const VALID_MODES: readonly TravelMode[] = ['walk', 'transit', 'car', 'bike'];

/**
 * 허용 경로 선호 프로필 화이트리스트 (P4 OW2 — RoutePreference 유니온과 동기).
 * `scenic`은 costing 미지원(P4)이나 유효한 `RoutePreference`이므로 검증은 통과한다
 * (미지원은 costing 단계 관심사 — OO1이 빈 costing 폴백). 미지정(undefined)=fastest 허용.
 */
const VALID_PREFERENCES: readonly RoutePreference[] = [
  'fastest',
  'walkable',
  'safe',
  'quiet',
  'scenic',
];

/**
 * stops 최소/최대. 출발+도착 필수이므로 최소 2.
 * 최대는 shared MAX_STOPS(= MAX_WAYPOINTS + 2 = 7) — 앱 경유지 한도와 단일 진실 소스 공유.
 */
export const MIN_STOPS = 2;
export { MAX_STOPS };

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
 * mode·stops 형태/길이/좌표 유효성 + P4 선택 필드(preference·maxExtraMinutes)를 통과해야 ok.
 *
 * **P4 OW2:** `preference`·`maxExtraMinutes`는 선택 필드 — 미지정 시 기존 P2 동작과
 * 동일(하위호환). 지정 시 화이트리스트·범위 검증 후 **반환 request에 스레딩**한다
 * (이 패스스루가 Valhalla 커스텀 경로 슬롯 활성의 전제 — F1 dormant 슬롯을 깨움).
 */
export function validateRouteBody(body: unknown): ValidateResult {
  if (typeof body !== 'object' || body === null) {
    return { ok: false, error: 'body must be an object' };
  }
  const { stops, mode, preference, maxExtraMinutes } = body as {
    stops?: unknown;
    mode?: unknown;
    preference?: unknown;
    maxExtraMinutes?: unknown;
  };

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

  // P4 preference 화이트리스트 (선택 — 미지정=fastest 허용).
  if (
    preference !== undefined &&
    (typeof preference !== 'string' ||
      !VALID_PREFERENCES.includes(preference as RoutePreference))
  ) {
    return { ok: false, error: `invalid preference: ${String(preference)}` };
  }

  // P4 maxExtraMinutes 범위 (선택 — 미지정=무제한 예산).
  if (maxExtraMinutes !== undefined) {
    if (
      typeof maxExtraMinutes !== 'number' ||
      !Number.isFinite(maxExtraMinutes) ||
      maxExtraMinutes < MIN_EXTRA_MINUTES ||
      maxExtraMinutes > MAX_EXTRA_MINUTES
    ) {
      return {
        ok: false,
        error: `maxExtraMinutes must be ${MIN_EXTRA_MINUTES}..${MAX_EXTRA_MINUTES} (got ${String(maxExtraMinutes)})`,
      };
    }
  }

  const request: RouteRequest = { stops: stops as LatLng[], mode: mode as TravelMode };
  if (preference !== undefined) request.preference = preference as RoutePreference;
  if (maxExtraMinutes !== undefined) request.maxExtraMinutes = maxExtraMinutes;
  return { ok: true, request };
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
