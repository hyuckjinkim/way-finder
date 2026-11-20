/**
 * 경로 공유 (F2) — 결과 링크 페이로드만 만든다. 공유 시트/복사 폴백은 src/share/share.ts(sharePlace).
 */
import type { LatLng } from '@wayfinder/shared';
import type { ShareResult, SharePayload } from '../share/share.js';
import type { ResolvedRouteInput } from './routeInput.js';
import { routeQuery, type RouteUrlState, type UrlStop } from './routeUrl.js';

/** 결과별 토스트 문구(null = 토스트 없음 — 공유 시트가 이미 피드백을 준다). */
export const SHARE_TOAST: Record<ShareResult, string | null> = {
  shared: null,
  cancelled: null,
  copied: '경로 링크를 복사했어요',
  failed: '링크를 복사하지 못했어요',
};

/**
 * 공유 링크 상태 — URL에 o·d가 있으면 그대로(라벨 유지), 스토어 폴백 진입이면 입력 좌표로 만든다
 * (빈 라벨은 decodeStop이 좌표 문자열로 채운다).
 */
function shareState(url: RouteUrlState, input: ResolvedRouteInput): RouteUrlState {
  const opts = { mode: input.mode, preference: input.preference, maxExtraMinutes: input.maxExtraMinutes };
  if (url.origin && url.destination) return { ...url, ...opts };
  const stop = (coord: LatLng): UrlStop => ({ label: '', coord });
  const s = input.stops;
  return { origin: stop(s[0]!), destination: stop(s[s.length - 1]!), waypoints: s.slice(1, -1).map(stop), ...opts };
}

const stopName = (s: UrlStop | undefined): string =>
  s ? s.label || `${s.coord.lat.toFixed(5)},${s.coord.lng.toFixed(5)}` : '';

/** origin = 페이지 origin(`https://host`). 링크는 /route/result?o&d&w&mode&pref&max. */
export function buildRouteShare(url: RouteUrlState, input: ResolvedRouteInput, origin: string): SharePayload {
  const state = shareState(url, input);
  return {
    title: '경로 결과',
    text: `${stopName(state.origin)} → ${stopName(state.destination)}`,
    url: `${origin}/route/result${routeQuery(state)}`,
  };
}
