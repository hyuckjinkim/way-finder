/**
 * 결과 화면 입력 해석 — URL(?o&d&w&mode&pref&max) 우선, 없으면 스토어 폴백, 둘 다 없으면 null.
 * 새로고침·공유 링크에서도 결과가 복원되도록 URL이 단일 진실이다(URL에 o·d가 있으면 pref·max도 URL 값만 쓴다).
 */
import type { LatLng, RoutePreference, TravelMode } from '@wayfinder/shared';
import type { RouteUrlState } from './routeUrl.js';

export interface ResolvedRouteInput {
  stops: LatLng[];
  mode: TravelMode;
  preference?: RoutePreference;
  maxExtraMinutes?: number;
}

export function resolveRouteInput(
  url: RouteUrlState,
  store: { stops: LatLng[]; mode: TravelMode; preference?: RoutePreference; maxExtraMinutes?: number },
): ResolvedRouteInput | null {
  if (url.origin && url.destination) {
    return {
      stops: [
        url.origin.coord,
        ...(url.waypoints ?? []).map((w) => w.coord),
        url.destination.coord,
      ],
      mode: url.mode ?? store.mode,
      preference: url.preference,
      maxExtraMinutes: url.maxExtraMinutes,
    };
  }
  return store.stops.length >= 2
    ? { stops: store.stops, mode: url.mode ?? store.mode, preference: store.preference, maxExtraMinutes: store.maxExtraMinutes }
    : null;
}
