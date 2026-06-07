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
import type { TravelMode } from '@wayfinder/shared';

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
  // "auto": 실 키가 전부 존재해야 실 모드
  return !(
    env.KAKAO_REST_KEY &&
    env.GOOGLE_PLACES_KEY &&
    env.NAVER_CLIENT_ID &&
    env.NAVER_CLIENT_SECRET
  );
}

/**
 * 라우팅 데모 모드 여부 (A4). 지역·모드별로 필요한 공급자 키가 있는지 본다.
 * - DEMO_MODE='true'/'false'는 전역 강제 (장소와 동일 시맨틱).
 * - 'auto': 필수 키가 전부 있어야 실 모드. 하나라도 비면 데모(mockRouteProvider).
 *   - kr + transit  → ODsay 키 (시내·도시간 대중교통).
 *   - kr + 그 외     → 카카오모빌리티 + TMAP 키 (차/도보/자전거).
 *   - global        → Google Routes 키 (전 모드 공통).
 *
 * 키 0개로 전체 빌드·테스트가 green이어야 하는 설계 원칙 준수.
 * mode 기본값은 'car' — 다이렉트 호출자는 기존 시그니처 그대로(인자 미전달) 사용한다.
 */
export function isRouteDemoMode(
  env: Env,
  region: 'kr' | 'global',
  mode: TravelMode = 'car',
): boolean {
  const demo = (env.DEMO_MODE ?? 'auto').toLowerCase();
  if (demo === 'true') return true;
  if (demo === 'false') return false;
  // "auto": 지역·모드별 필수 키가 전부 존재해야 실 모드
  if (region === 'kr') {
    return mode === 'transit'
      ? !env.ODSAY_API_KEY
      : !(env.KAKAO_MOBILITY_KEY && env.TMAP_APP_KEY);
  }
  return !env.GOOGLE_ROUTES_KEY;
}

/** TTL 상수 (초 단위) */
export const TTL = {
  BLOG: 6 * 60 * 60,          // 6h
  PLACE: 24 * 60 * 60,        // 24h
  GOOGLE: 30 * 24 * 60 * 60,  // 30일 (Google Places 약관 최대치)
} as const;
