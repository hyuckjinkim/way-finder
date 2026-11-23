/**
 * 앱으로 길안내 (F3) — 웹은 턴바이턴이 없으니 카카오맵·네이버지도 앱 스킴으로 넘기고, 없으면 웹으로 폴백.
 * 스킴 형식: docs/research/2026-11-20-지도앱-미구현-기능-우선순위/map-ux.md §4.
 */
import type { LatLng, TravelMode } from '@wayfinder/shared';
import { kakaoMapLink, type LinkStop } from './routeResultView.js';

export type HandoffApp = 'kakao' | 'naver';
export type Device = 'android' | 'ios' | 'desktop';

export interface HandoffArgs {
  origin: LinkStop;
  destination: LinkStop;
  /** 경유지 좌표(출·도 제외). 카카오 대중교통은 경유지를 받지 않는다. */
  waypoints: LatLng[];
  mode: TravelMode;
  /** 네이버 필수 파라미터 — 모바일 웹은 페이지 호스트. */
  appname: string;
}

/** 스킴 시도 → 이 시간 뒤에도 페이지가 보이면 폴백(앱 미설치). */
export const FALLBACK_DELAY_MS = 1500;
export const NAVER_WEB = 'https://map.naver.com/';

const KAKAO_BY: Record<TravelMode, string> = { transit: 'publictransit', walk: 'foot', car: 'car', bike: 'bicycle' };
const NAVER_PATH: Record<TravelMode, string> = { transit: 'public', walk: 'walk', car: 'car', bike: 'bicycle' };

// ponytail: iPadOS 13+는 데스크톱 UA(Macintosh)라 desktop으로 분류 — 웹 링크로 열린다.
export function deviceFromUA(ua: string): Device {
  if (/android/i.test(ua)) return 'android';
  if (/iphone|ipad|ipod/i.test(ua)) return 'ios';
  return 'desktop';
}

const ll = (c: LatLng): string => `${c.lat},${c.lng}`;
/** URLSearchParams는 공백을 '+'로 바꿔 앱이 그대로 보여 준다 — encodeURIComponent로 직접 잇는다. */
const query = (pairs: [string, string | number][]): string =>
  pairs.map(([k, v]) => `${k}=${encodeURIComponent(v)}`).join('&');

export function kakaoAppUrl({ origin, destination, waypoints, mode }: HandoffArgs): string {
  // ponytail: 경유지 키 vp, vp2…vp5는 추정(문서엔 "vp ~ vp5"만) — 틀리면 앱이 2번째부터 무시.
  // 좌표·모드만 있어 인코딩 불필요 — 공식 예시처럼 쉼표 그대로.
  const vps = mode === 'transit' ? [] : waypoints.slice(0, 5).map((w, i) => `${i ? `vp${i + 1}` : 'vp'}=${ll(w)}&`);
  return `kakaomap://route?sp=${ll(origin.coord)}&${vps.join('')}ep=${ll(destination.coord)}&by=${KAKAO_BY[mode]}`;
}

export function naverAppUrl({ origin, destination, waypoints, mode, appname }: HandoffArgs): string {
  const vs = waypoints.slice(0, 5).flatMap((w, i): [string, number][] => [[`v${i + 1}lat`, w.lat], [`v${i + 1}lng`, w.lng]]);
  return `nmap://route/${NAVER_PATH[mode]}?${query([
    ['slat', origin.coord.lat], ['slng', origin.coord.lng], ['sname', origin.label],
    ...vs,
    ['dlat', destination.coord.lat], ['dlng', destination.coord.lng], ['dname', destination.label],
    ['appname', appname],
  ])}`;
}

/** 안드로이드: intent://로 앱 실행, 미설치면 Play 스토어로 자동 이동. */
export const naverIntentUrl = (nmap: string): string =>
  `intent://${nmap.slice('nmap://'.length)}#Intent;scheme=nmap;action=android.intent.action.VIEW;` +
  'category=android.intent.category.BROWSABLE;package=com.nhn.android.nmap;end';

export interface HandoffPlan {
  primary: string;
  /** 스킴을 먼저 시도한 뒤 FALLBACK_DELAY_MS 후에도 페이지에 남아 있으면 열 URL. */
  fallback?: string;
}

export function handoffPlan(app: HandoffApp, device: Device, args: HandoffArgs): HandoffPlan {
  const kakaoWeb = kakaoMapLink(args.origin, args.destination, args.mode);
  if (device === 'desktop') return { primary: app === 'kakao' ? kakaoWeb : NAVER_WEB };
  if (app === 'kakao') return { primary: kakaoAppUrl(args), fallback: kakaoWeb };
  const nmap = naverAppUrl(args);
  return device === 'android' ? { primary: naverIntentUrl(nmap) } : { primary: nmap, fallback: NAVER_WEB };
}

/** 웹 전용 실행기. 앱이 열리면 페이지가 숨겨지거나 타이머가 늦게 돌아 폴백하지 않는다. */
export function openHandoff(plan: HandoffPlan): void {
  if (/^https?:/.test(plan.primary)) {
    window.open(plan.primary, '_blank', 'noopener');
    return;
  }
  const startedAt = Date.now();
  window.location.href = plan.primary;
  const { fallback } = plan;
  if (!fallback) return;
  // 앱 전환(또는 iOS "앱에서 열기" 확인창)으로 페이지가 가려지면 폴백을 취소한다.
  const cancel = (): void => {
    clearTimeout(timer);
    window.removeEventListener('pagehide', cancel);
    window.removeEventListener('blur', cancel);
    document.removeEventListener('visibilitychange', cancel);
  };
  const timer = setTimeout(() => {
    cancel();
    if (!document.hidden && Date.now() - startedAt < FALLBACK_DELAY_MS + 500) window.location.href = fallback;
  }, FALLBACK_DELAY_MS);
  window.addEventListener('pagehide', cancel);
  window.addEventListener('blur', cancel);
  document.addEventListener('visibilitychange', cancel);
}
