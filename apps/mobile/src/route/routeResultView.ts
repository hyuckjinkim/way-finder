/**
 * 경로 결과 화면용 순수 뷰 모델 — 포맷터·구간 바·단계 목록·마커·지도 여백.
 * react-native 비의존(단위 테스트 용이). 색은 routeToPolylines의 leg 색을 그대로 쓴다.
 */
import type { Insets, LatLng, MapMarker, Route, TravelMode } from '@wayfinder/shared';
import { haversineDistanceM } from '@wayfinder/shared';
import { routeToPolylines, STOP_GAP_M } from './routeToPolylines.js';
import { CARD_INSET, CARD_WIDTH, SNAP_FRACTIONS } from '../components/sheetSnap.js';

/** 결과 시트(폰)의 처음 높이 — 짧은 결과도 빈 공간이 크지 않게 중간. */
export const RESULT_SHEET_SNAP = 'half' as const;

/** 이 시간(초)을 넘는 도보는 대중교통 권유 문구를 붙인다. */
export const LONG_WALK_SEC = 3 * 3600;

/** 두 지점이 사실상 같은 곳인지(출발=도착 입력 방지). */
export const isSameStop = (a: LatLng, b: LatLng): boolean => haversineDistanceM(a, b) <= STOP_GAP_M;

const FIT_MARGIN = 40;

/** 초 → "N분" 또는 "N시간 M분". */
export function formatDuration(sec: number): string {
  const totalMin = Math.round(sec / 60);
  if (totalMin < 60) return `${totalMin}분`;
  const hours = Math.floor(totalMin / 60);
  const mins = totalMin % 60;
  return mins > 0 ? `${hours}시간 ${mins}분` : `${hours}시간`;
}

/** 미터 → "N.N km" 또는 "N m". */
export function formatDistance(meters: number): string {
  return meters >= 1000 ? `${(meters / 1000).toFixed(1)} km` : `${meters} m`;
}

/** 요금(원) → "1,650원". */
export function formatFare(won: number): string {
  return `${String(Math.round(won)).replace(/\B(?=(\d{3})+(?!\d))/g, ',')}원`;
}

/** HH:MM 포맷터. h23: hour12:false는 일부 엔진에서 "24:10"을 낸다. timeZone 미지정 = 기기 시간대. */
const timeFormat = (timeZone?: string): Intl.DateTimeFormat =>
  new Intl.DateTimeFormat('en-GB', { timeZone, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });
const KST_TIME = timeFormat('Asia/Seoul');
const LOCAL_TIME = timeFormat();

/** 현재 시각 + 소요 → 도착 예정 "HH:MM". 국내(kr) 경로는 기기 시간대와 무관하게 KST, 그 외는 기기 시간대. */
export function arrivalTime(now: Date, durationSec: number, region: 'kr' | 'global' = 'kr'): string {
  const fmt = region === 'kr' ? KST_TIME : LOCAL_TIME;
  const parts = fmt.formatToParts(new Date(now.getTime() + durationSec * 1000));
  const get = (type: string): string => parts.find((p) => p.type === type)?.value ?? '00';
  return `${get('hour')}:${get('minute')}`;
}

/** 도보 leg 합계(분, 반올림). */
export function walkMinutes(route: Route): number {
  const sec = route.legs.filter((l) => l.mode === 'walk').reduce((a, l) => a + l.durationSec, 0);
  return Math.round(sec / 60);
}

/** 대중교통 leg가 있는 경로인지. */
export const hasTransit = (route: Route): boolean => route.legs.some((l) => l.mode === 'transit');

/** 환승 수 = 대중교통 leg 수 - 1 (최소 0). */
export function transferCount(route: Route): number {
  return Math.max(0, route.legs.filter((l) => l.mode === 'transit').length - 1);
}

/** leg별 색 — routeToPolylines와 항상 일치. */
const legColors = (route: Route): string[] => routeToPolylines(route).map((p) => p.color ?? '#8A8F98');

export interface BarSegment {
  /** 소요 시간 비례 가중치(flex 값). */
  weight: number;
  color: string;
}

/** 구간 바 — leg 소요 시간 비례, 색은 폴리라인과 동일(도보=회색). */
export function segmentBar(route: Route): BarSegment[] {
  const colors = legColors(route);
  return route.legs.map((l, i) => ({ weight: Math.max(l.durationSec, 1), color: colors[i]! }));
}

export type StepItem =
  | { kind: 'walk'; minutes: number }
  | { kind: 'transit'; lineName: string; color: string; fromStop?: string; toStop?: string; headsign?: string; minutes: number }
  | { kind: 'other'; mode: 'car' | 'bike'; minutes: number };

/** 선택 경로의 단계 목록: 도보 N분 → [노선 배지] 방면 N분 … */
export function routeStepItems(route: Route): StepItem[] {
  const colors = legColors(route);
  return route.legs.map((l, i): StepItem => {
    const minutes = Math.max(1, Math.round(l.durationSec / 60));
    if (l.mode === 'walk') return { kind: 'walk', minutes };
    if (l.mode === 'transit' && l.transit) {
      return {
        kind: 'transit',
        lineName: l.transit.lineName,
        color: colors[i]!,
        ...(l.transit.fromStop ? { fromStop: l.transit.fromStop } : {}),
        ...(l.transit.toStop ? { toStop: l.transit.toStop } : {}),
        ...(l.transit.headsign ? { headsign: l.transit.headsign } : {}),
        minutes,
      };
    }
    return { kind: 'other', mode: l.mode === 'bike' ? 'bike' : 'car', minutes };
  });
}

/** 단계 소요(분) → 경로 카드와 같은 h/m 표기("2시간 58분"). */
export const formatMinutes = (minutes: number): string => formatDuration(minutes * 60);

/**
 * 대중교통 단계 문구: "구로디지털단지 → 강남 (사당 방면) · 24분". 정류장명이 없으면 "사당 방면 · 24분"으로 폴백.
 * ODsay `way`는 하차역과 같을 수 있다("강남 (강남)") → 정류장명을 보일 때 하차역과 같으면 방면 생략.
 */
export function transitStepText(step: Extract<StepItem, { kind: 'transit' }>): string {
  const stops = step.fromStop && step.toStop ? `${step.fromStop} → ${step.toStop}` : '';
  const headsign = stops && step.headsign?.replace(/\s*방면$/, '') === step.toStop ? '' : step.headsign;
  const head = headsign ? (stops ? `(${headsign})` : headsign) : '';
  return [[stops, head].filter(Boolean).join(' '), formatMinutes(step.minutes)].filter(Boolean).join(' · ');
}

/** 카카오맵 길찾기 링크용 지점(이름 + 좌표). */
export interface LinkStop {
  label: string;
  coord: LatLng;
}

const KAKAO_BY: Record<TravelMode, string> = { transit: 'traffic', walk: 'walk', car: 'car', bike: 'bicycle' };

/** URL 이름이 없으면(스토어 폴백 진입) 좌표를 이름으로 쓴다. */
export function linkStop(stop: LinkStop | undefined, coord: LatLng | undefined): LinkStop | undefined {
  if (stop) return stop;
  return coord ? { label: `${coord.lat.toFixed(5)},${coord.lng.toFixed(5)}`, coord } : undefined;
}

/** 카카오맵 웹 길찾기 링크 — 클라이언트에서 만들어 API 쿼터를 쓰지 않는다(쿼터 소진 시 대안). */
export function kakaoMapLink(origin: LinkStop, destination: LinkStop, mode: TravelMode): string {
  const seg = (s: LinkStop): string => `${encodeURIComponent(s.label)},${s.coord.lat},${s.coord.lng}`;
  return `https://map.kakao.com/link/by/${KAKAO_BY[mode]}/${seg(origin)}/${seg(destination)}`;
}

/** 배지 배경색 위에서 읽히는 글자색. */
export function readableTextColor(hex: string): string {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex);
  if (!m) return '#fff';
  const n = parseInt(m[1]!, 16);
  const lum = (0.299 * (n >> 16) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255)) / 255;
  return lum > 0.65 ? '#111' : '#fff';
}

/**
 * 출발·도착 + 대중교통 leg 시작점(환승/승차) 마커.
 * stops(입력 출발…도착)가 있으면 출·도 마커를 실제 입력 지점에 둔다(카카오 대중교통은 첫/끝 도보가 없어
 * leg 끝점이 역이다). 출·도와 30 m 이내의 승차 점은 빼고, 출·도를 마지막에 넣어 위에 그려지게 한다.
 */
export function routeMarkers(route: Route, stops?: LatLng[]): MapMarker[] {
  const first = route.legs[0];
  const last = route.legs[route.legs.length - 1];
  if (!first || !last) return [];
  const origin = stops?.[0] ?? first.start;
  const destination = stops?.[stops.length - 1] ?? last.end;
  const colors = legColors(route);
  const markers: MapMarker[] = [];
  route.legs.forEach((l, i) => {
    if (l.mode === 'transit' && !isSameStop(l.start, origin) && !isSameStop(l.start, destination)) {
      markers.push({ id: `transfer-${i}`, coord: l.start, kind: 'transfer', color: colors[i] });
    }
  });
  // 출·도는 마지막에 — 같은 zIndex면 나중에 그린 게 위라, 짧은 첫 도보 끝의 승차 점이 '출'을 덮지 않는다.
  markers.push({ id: 'origin', coord: origin, kind: 'origin' }, { id: 'destination', coord: destination, kind: 'destination' });
  return markers;
}

/**
 * 결과 패널(OverlayPanel)에 가려지지 않는 지도 영역 여백.
 * 데스크톱: 좌측 플로팅 카드(inset + 폭)만큼 left. 폰: 결과 시트 처음 높이만큼 bottom.
 */
export function fitInsets(isDesktop: boolean, windowHeight: number): Insets {
  if (isDesktop) {
    return { top: FIT_MARGIN, right: FIT_MARGIN, bottom: FIT_MARGIN, left: CARD_INSET + CARD_WIDTH + FIT_MARGIN };
  }
  const sheet = Math.round(windowHeight * SNAP_FRACTIONS[RESULT_SHEET_SNAP]);
  return { top: FIT_MARGIN, right: FIT_MARGIN, bottom: sheet + FIT_MARGIN / 2, left: FIT_MARGIN };
}

/** 웹에서는 안내(턴바이턴) 비활성 — GPS 추적이 불가능해 네이티브 전용. */
export const canStartNav = (os: string): boolean => os !== 'web';
