/**
 * 경로 결과 화면용 순수 뷰 모델 — 포맷터·구간 바·단계 목록·마커·지도 여백.
 * react-native 비의존(단위 테스트 용이). 색은 routeToPolylines의 leg 색을 그대로 쓴다.
 */
import type { Insets, LatLng, MapMarker, Route, TravelMode } from '@wayfinder/shared';
import { routeToPolylines } from './routeToPolylines.js';

/** 이 너비 이상이면 좌측 플로팅 카드, 미만이면 하단 시트. */
export const DESKTOP_MIN_WIDTH = 768;
/** 데스크톱 좌측 카드 너비(px). */
export const SIDE_CARD_WIDTH = 400;
/** 폰 하단 시트 최대 높이 비율. */
export const SHEET_MAX_HEIGHT_RATIO = 0.55;

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

/** 한국 시각(KST) HH:MM — 기기 시간대와 무관. h23: hour12:false는 일부 엔진에서 "24:10"을 낸다. */
const KST_TIME = new Intl.DateTimeFormat('en-GB', {
  timeZone: 'Asia/Seoul',
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
});

/** 현재 시각 + 소요 → 도착 예정 "HH:MM"(Asia/Seoul). */
export function arrivalTime(now: Date, durationSec: number): string {
  const parts = KST_TIME.formatToParts(new Date(now.getTime() + durationSec * 1000));
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

/** 출발·도착 + 대중교통 leg 시작점(환승/승차) 마커. */
export function routeMarkers(route: Route): MapMarker[] {
  const first = route.legs[0];
  const last = route.legs[route.legs.length - 1];
  if (!first || !last) return [];
  const colors = legColors(route);
  const markers: MapMarker[] = [{ id: 'origin', coord: first.start, kind: 'origin' }];
  route.legs.forEach((l, i) => {
    if (l.mode === 'transit') {
      markers.push({ id: `transfer-${i}`, coord: l.start, kind: 'transfer', color: colors[i] });
    }
  });
  markers.push({ id: 'destination', coord: last.end, kind: 'destination' });
  return markers;
}

/**
 * 결과 패널에 가려지지 않는 지도 영역 여백.
 * 데스크톱: 좌측 카드 폭만큼 left. 폰: 측정한 패널 높이(미측정이면 최대 높이)만큼 bottom.
 */
export function fitInsets(isDesktop: boolean, windowHeight: number, panelHeight: number): Insets {
  if (isDesktop) {
    return { top: FIT_MARGIN, right: FIT_MARGIN, bottom: FIT_MARGIN, left: SIDE_CARD_WIDTH + FIT_MARGIN };
  }
  const h = panelHeight > 0 ? panelHeight : windowHeight * SHEET_MAX_HEIGHT_RATIO;
  return { top: FIT_MARGIN, right: FIT_MARGIN, bottom: Math.round(h) + FIT_MARGIN / 2, left: FIT_MARGIN };
}

/** 웹에서는 안내(턴바이턴) 비활성 — GPS 추적이 불가능해 네이티브 전용. */
export const canStartNav = (os: string): boolean => os !== 'web';
