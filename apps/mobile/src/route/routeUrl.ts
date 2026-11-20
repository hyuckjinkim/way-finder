/**
 * 경로 화면 URL 상태 — 새로고침·공유 링크에서도 출발/도착/모드를 복원한다.
 * 형식: `?o=lat,lng,이름&d=lat,lng,이름&w=lat,lng,이름|...&mode=transit&pref=quiet&max=10`
 * (이름은 마지막 필드라 쉼표를 포함해도 된다; URLSearchParams가 인코딩.)
 */
import type { LatLng, RoutePreference, TravelMode } from '@wayfinder/shared';
import { MAX_EXTRA_MINUTES, MIN_EXTRA_MINUTES } from '@wayfinder/shared';

export interface UrlStop {
  label: string;
  coord: LatLng;
}

export interface RouteUrlState {
  origin?: UrlStop;
  destination?: UrlStop;
  waypoints?: UrlStop[];
  mode?: TravelMode;
  /** 도보 선호(미지정=fastest). */
  preference?: RoutePreference;
  /** "+N분" 예산(MIN 초과 ~ MAX 정수, 미지정=무제한). */
  maxExtraMinutes?: number;
}

const MODES: readonly TravelMode[] = ['walk', 'transit', 'car', 'bike'];
const PREFERENCES: readonly RoutePreference[] = ['fastest', 'walkable', 'safe', 'quiet', 'scenic'];

const encodeStop = (s: UrlStop): string => `${s.coord.lat.toFixed(6)},${s.coord.lng.toFixed(6)},${s.label}`;

export function decodeStop(raw: string | undefined | null): UrlStop | undefined {
  if (!raw) return undefined;
  const [latS, lngS, ...rest] = raw.split(',');
  const lat = Number(latS);
  const lng = Number(lngS);
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180) return undefined;
  return { coord: { lat, lng }, label: rest.join(',') || `${lat.toFixed(4)}, ${lng.toFixed(4)}` };
}

/** state → 쿼리스트링(선행 `?` 포함, 빈 상태면 ''). */
export function routeQuery(state: RouteUrlState): string {
  const qs = new URLSearchParams();
  if (state.origin) qs.set('o', encodeStop(state.origin));
  if (state.destination) qs.set('d', encodeStop(state.destination));
  if (state.waypoints?.length) qs.set('w', state.waypoints.map(encodeStop).join('|'));
  if (state.mode) qs.set('mode', state.mode);
  if (state.preference) qs.set('pref', state.preference);
  if (state.maxExtraMinutes !== undefined) qs.set('max', String(state.maxExtraMinutes));
  const s = qs.toString();
  return s ? `?${s}` : '';
}

/** expo-router `useLocalSearchParams()` 결과 → state. 잘못된 값은 버린다. */
export function parseRouteParams(params: Record<string, string | string[] | undefined>): RouteUrlState {
  const one = (k: string) => {
    const v = params[k];
    return Array.isArray(v) ? v[0] : v;
  };
  const mode = one('mode');
  const pref = one('pref');
  const max = Number(one('max'));
  const waypoints = (one('w') ?? '')
    .split('|')
    .map(decodeStop)
    .filter((s): s is UrlStop => s !== undefined);
  return {
    origin: decodeStop(one('o')),
    destination: decodeStop(one('d')),
    waypoints: waypoints.length ? waypoints : undefined,
    mode: MODES.includes(mode as TravelMode) ? (mode as TravelMode) : undefined,
    preference: PREFERENCES.includes(pref as RoutePreference) ? (pref as RoutePreference) : undefined,
    maxExtraMinutes:
      Number.isInteger(max) && max > MIN_EXTRA_MINUTES && max <= MAX_EXTRA_MINUTES ? max : undefined,
  };
}
