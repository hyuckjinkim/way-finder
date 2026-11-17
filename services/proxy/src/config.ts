/**
 * A5 — 데모 모드 설정.
 *
 * DEMO_MODE env 변수 동작:
 * - "true"  → 항상 데모 모드 (mock provider, 실 fetch 없음)
 * - "false" → 항상 실 모드 (API 키 필요)
 * - "auto"  → 키 env가 하나라도 없으면 데모 모드로 자동 전환 (기본값)
 *
 * Cloudflare Workers 환경에서 env는 fetch()의 두 번째 인자로 주입된다.
 */
import type { TravelMode, RoutePreference } from '@wayfinder/shared';

export interface Env {
  DEMO_MODE: string;
  KAKAO_REST_KEY: string;
  GOOGLE_PLACES_KEY: string;
  NAVER_CLIENT_ID: string;
  NAVER_CLIENT_SECRET: string;
  // 라우팅 공급자 키 (P2 — wrangler secret 전용, 앱/저장소 미포함).
  KAKAO_MOBILITY_KEY: string;
  TMAP_APP_KEY: string;
  GOOGLE_ROUTES_KEY: string;
  // ODsay 대중교통(한국 시내·도시간) API 키. kr transit 실 모드 게이트.
  ODSAY_API_KEY: string;
  MAPBOX_TOKEN: string;
  // Valhalla 커스텀 도보 라우팅 URL (P4 — 로컬 self-hosted, 키 불필요).
  // 미설정 시 커스텀 경로는 데모/TMAP 폴백 (키 0개 동작 유지).
  VALHALLA_URL: string;
  CACHE: KVNamespace;
}

/**
 * 데모 모드 여부 판정.
 * "auto" 모드에서는 API 키가 하나라도 비어있으면 데모 모드로 동작한다.
 * 키 없이 전체 빌드·테스트가 green이어야 하는 설계 원칙 준수.
 */
export function isDemoMode(env: Env): boolean {
  const mode = (env.DEMO_MODE ?? 'auto').toLowerCase();
  if (mode === 'true') return true;
  if (mode === 'false') return false;
  // "auto": 카카오 REST 키가 있으면 실 모드.
  // 구글·네이버는 선택 — 없으면 구글 탭·해외 검색 / 네이버 블로그만 빈 결과(호출부 가드).
  // 네이버는 API HUB 이관 후 "한시적 무료"라 필수 키에서 제외(2026-11-18).
  return !env.KAKAO_REST_KEY;
}

/**
 * 라우팅 데모 모드 여부 (A4). 지역·모드별로 필요한 공급자 키가 있는지 본다.
 * - DEMO_MODE='true'/'false'는 전역 강제 (장소와 동일 시맨틱).
 * - 'auto': 해당 모드의 공급자 키가 있으면 실 모드, 비면 데모(mockRouteProvider).
 *   - kr + transit  → ODsay 키 (시내·도시간 대중교통).
 *   - kr + car      → 카카오모빌리티 키 (유료 가능 — 비워도 다른 모드 영향 없음).
 *   - kr + walk     → TMAP 키.
 *   - kr + bike     → VALHALLA_URL (TMAP엔 자전거 API 없음 — 자체 호스팅 Valhalla bicycle).
 *   - global        → Google Routes 키 (전 모드 공통, 유료 가능).
 *
 * 키 0개로 전체 빌드·테스트가 green이어야 하는 설계 원칙 준수.
 * mode는 필수 — 기본값이 있으면 호출부가 누락해도 컴파일돼 모드별 게이트가 무력화된다.
 */
export function isRouteDemoMode(
  env: Env,
  region: 'kr' | 'global',
  mode: TravelMode,
): boolean {
  const demo = (env.DEMO_MODE ?? 'auto').toLowerCase();
  if (demo === 'true') return true;
  if (demo === 'false') return false;
  // "auto": 지역·모드별 필수 키가 전부 존재해야 실 모드
  // 모드별 공급자 키만 본다 — 카카오모빌리티(유료 가능)가 없어도 도보·자전거(TMAP)는 실 모드.
  if (region === 'kr') {
    if (mode === 'transit') return !env.ODSAY_API_KEY;
    if (mode === 'car') return !env.KAKAO_MOBILITY_KEY;
    if (mode === 'bike') return !env.VALHALLA_URL;
    return !env.TMAP_APP_KEY;
  }
  return !env.GOOGLE_ROUTES_KEY;
}

/**
 * 경로 요청 처리 방식.
 * - 'real': 해당 모드 공급자 키 있음.
 * - 'demo': 키 없음 + 앱 전체가 데모(무료 장소 키도 없음) → mock 경로 (키 0개 개발 흐름 유지).
 * - 'unavailable': 앱은 실 모드인데 이 모드 키만 없음(유료 가능 키를 비운 국내 전용 운영 등)
 *   → 가짜 경로를 실사용자에게 보이지 않도록 501 MODE_UNAVAILABLE.
 */
export function routeGate(
  env: Env,
  region: 'kr' | 'global',
  mode: TravelMode,
): 'real' | 'demo' | 'unavailable' {
  if (!isRouteDemoMode(env, region, mode)) return 'real';
  return isDemoMode(env) ? 'demo' : 'unavailable';
}

/** routeGate가 'unavailable'일 때의 응답 본문 (앱은 HTTP 501로 판별). */
export function modeUnavailableBody(region: 'kr' | 'global', mode: TravelMode) {
  return { error: `mode unavailable (${region}/${mode})`, code: 'MODE_UNAVAILABLE' } as const;
}

/**
 * Valhalla 커스텀 경로 진입 판정 (P4 §3 F1.4).
 *
 * 커스텀 경로는 **한국·도보·비-fastest 프로필**에만 진입한다 — 기존 4모드는 전부 불변.
 * `region==='kr' && mode==='walk' && preference && preference!=='fastest'`.
 *
 * scenic은 `RoutePreference`에 존재하나 costing 미지원(P4) — 판정은 타입상 통과하나
 * 실 배선(OW1)에서 PROFILE_COSTING 미존재로 폴백/검증 단계가 처리한다(이 함수 범위 밖).
 */
export function isValhallaCustomRoute(
  region: 'kr' | 'global',
  mode: TravelMode,
  preference: RoutePreference | undefined,
): boolean {
  return (
    region === 'kr' &&
    mode === 'walk' &&
    preference !== undefined &&
    preference !== 'fastest'
  );
}

/** TTL 상수 (초 단위) */
export const TTL = {
  BLOG: 6 * 60 * 60,          // 6h
  PLACE: 24 * 60 * 60,        // 24h
  GOOGLE: 30 * 24 * 60 * 60,  // 30일 (Google Places 약관 최대치)
} as const;
