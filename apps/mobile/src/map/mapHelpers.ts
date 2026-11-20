/**
 * 지도 어댑터 공용 순수 헬퍼 (RN/DOM 의존 없음 — vitest로 직접 검증).
 * Kakao 웹 / MapLibre 웹·네이티브가 같은 규칙(여백 정규화, 마커 모양, 값 비교 키)을 쓰도록 한다.
 */
import type { BBox, Insets, LatLng, MapMarker, MapPolyline } from '@wayfinder/shared';

export const DEFAULT_FIT_PADDING = 40;
export const DEFAULT_LINE_COLOR = '#2563eb';
export const DEFAULT_LINE_WIDTH = 5;
/** 흰 외곽선이 본선보다 굵은 정도(px) — 지도 위 가독성. */
export const OUTLINE_EXTRA_WIDTH = 3;
export const USER_MARKER_ID = '__user__';

/** number → 균일 여백, Insets → 그대로, 미지정 → 기본값. */
export function normalizeInsets(padding?: number | Insets): Insets {
  if (padding === undefined) padding = DEFAULT_FIT_PADDING;
  if (typeof padding === 'number') {
    return { top: padding, right: padding, bottom: padding, left: padding };
  }
  return { top: padding.top, right: padding.right, bottom: padding.bottom, left: padding.left };
}

/** fitTo를 값으로 비교하기 위한 키 (객체 identity가 매 렌더 바뀌어도 재적용 안 함). */
export function fitKey(fitTo?: { bounds: BBox; padding?: number | Insets }): string {
  if (!fitTo) return '';
  const { sw, ne } = fitTo.bounds;
  const p = normalizeInsets(fitTo.padding);
  return [sw.lat, sw.lng, ne.lat, ne.lng, p.top, p.right, p.bottom, p.left].join(',');
}

/** markers + userLocation → 렌더할 마커 목록 (userLocation은 'user' 마커로). */
export function withUserMarker(markers?: MapMarker[], userLocation?: LatLng): MapMarker[] {
  const list = markers ?? [];
  return userLocation
    ? [...list, { id: USER_MARKER_ID, coord: userLocation, kind: 'user' }]
    : list;
}

export interface MarkerSpec {
  size: number;
  background: string;
  borderColor: string;
  borderWidth: number;
  label?: string;
  /** user 마커의 파란 후광. */
  halo?: boolean;
}

/** 기본 핀(place/미지정)은 null — 각 렌더러의 기본 마커를 쓴다. */
export function markerSpec(kind: MapMarker['kind'], color?: string): MarkerSpec | null {
  switch (kind) {
    case 'origin':
      return { size: 28, background: '#16a34a', borderColor: '#fff', borderWidth: 3, label: '출' };
    case 'destination':
      return { size: 28, background: '#dc2626', borderColor: '#fff', borderWidth: 3, label: '도' };
    case 'transfer':
      return { size: 14, background: '#fff', borderColor: color ?? '#374151', borderWidth: 3 };
    case 'user':
      return { size: 16, background: '#2563eb', borderColor: '#fff', borderWidth: 3, halo: true };
    default:
      return null;
  }
}

/** CSS 값에 들어갈 수 있는 문자만 허용 (HTML 문자열에 삽입되므로). */
function safeCss(value: string): string {
  return value.replace(/[^#\w(),.% -]/g, '');
}

/** CustomOverlay/maplibre Marker용 inline HTML. 클릭은 지도로 통과(pointer-events:none). */
export function markerHtml(spec: MarkerSpec): string {
  const shadow = spec.halo
    ? '0 0 0 8px rgba(37,99,235,.25),0 1px 4px rgba(0,0,0,.4)'
    : '0 1px 4px rgba(0,0,0,.4)';
  const style = [
    `width:${spec.size}px`,
    `height:${spec.size}px`,
    `border-radius:50%`,
    `box-sizing:content-box`,
    `background:${safeCss(spec.background)}`,
    `border:${spec.borderWidth}px solid ${safeCss(spec.borderColor)}`,
    `box-shadow:${shadow}`,
    `pointer-events:none`,
    `display:flex`,
    `align-items:center`,
    `justify-content:center`,
    `color:#fff`,
    `font:700 13px/1 sans-serif`,
  ].join(';');
  return `<div style="${style}">${spec.label ?? ''}</div>`;
}

export function polylineStyle(pl: MapPolyline) {
  const width = pl.width ?? DEFAULT_LINE_WIDTH;
  return {
    color: pl.color ?? DEFAULT_LINE_COLOR,
    width,
    outlineWidth: width + OUTLINE_EXTRA_WIDTH,
    dashed: !!pl.dashed,
  };
}

/**
 * 네이티브 Kakao 전용: setBounds가 없어 bbox에 맞는 zoom을 근사한다
 * (web mercator, 뷰포트 폭 ~360px 가정, 1~19 클램프).
 */
export function approxZoomForBounds(bounds: BBox): number {
  const span = Math.max(
    Math.abs(bounds.ne.lng - bounds.sw.lng),
    Math.abs(bounds.ne.lat - bounds.sw.lat),
    1e-6,
  );
  const zoom = Math.floor(Math.log2((360 * 360) / (256 * span)));
  return Math.min(19, Math.max(1, zoom));
}

/**
 * '이 지역 재검색'을 띄울 만큼 지도가 움직였나 — 중심이 검색 영역의 1/4 이상 이동했거나 줌(가로 폭)이 바뀜.
 * 세로 폭은 보지 않는다: 폰에서 결과 목록이 열리면 지도 높이만 줄어 영역이 바뀌지만 사용자가 옮긴 건 아니다.
 */
export function boundsMoved(searched: BBox, now: BBox): boolean {
  const latSpan = searched.ne.lat - searched.sw.lat;
  const lngSpan = searched.ne.lng - searched.sw.lng;
  const dLat = Math.abs((now.ne.lat + now.sw.lat) / 2 - (searched.ne.lat + searched.sw.lat) / 2);
  const dLng = Math.abs((now.ne.lng + now.sw.lng) / 2 - (searched.ne.lng + searched.sw.lng) / 2);
  const widthRatio = (now.ne.lng - now.sw.lng) / lngSpan;
  return dLat > latSpan / 4 || dLng > lngSpan / 4 || widthRatio < 0.8 || widthRatio > 1.25;
}
