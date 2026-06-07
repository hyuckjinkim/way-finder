/**
 * D3 — Route → MapPolyline[] 변환.
 *
 * Route.legs를 MapPolyline 배열로 변환한다.
 * - leg.coords를 그대로 사용한다 (앱은 디코드하지 않음 — §8 critic C1).
 * - 모드·노선별 색상을 부여한다.
 * - 각 leg는 고유 id를 가진 MapPolyline으로 변환된다.
 * - MapPolyline { id, coords, color?, width? } — 현 인터페이스로 다구간·대중교통 표현 가능.
 *
 * MapView 파일 수정 금지 (§8 D4 경계).
 */
import type { MapPolyline } from '@wayfinder/shared';
import type { Route, RouteLeg, TravelMode, TransitMeta } from '@wayfinder/shared';
import type { BBox, LatLng } from '@wayfinder/shared';

// ─── 모드별 기본 색상 ──────────────────────────────────────────────────────────

/** 이동 수단별 기본 선 색상. */
const MODE_COLOR: Record<TravelMode, string> = {
  walk: '#888888',    // 회색 — 도보
  bike: '#4CAF50',    // 녹색 — 자전거
  car: '#1a73e8',     // 파란색 — 자동차
  transit: '#E53935', // 빨간색 — 대중교통 기본 (노선별 오버라이드)
};

/** 대중교통 노선 유형별 색상 오버라이드. */
const TRANSIT_LINE_COLOR: Record<NonNullable<TransitMeta['lineType']>, string> = {
  subway: '#3949AB',  // 남색 — 지하철
  bus: '#F57C00',     // 주황 — 버스
  train: '#6D4C41',   // 갈색 — 기차/KTX
  express: '#8E24AA', // 보라 — 고속버스
  air: '#00ACC1',     // 청록 — 항공
};

/** 모드·노선별 색상 결정. */
function colorForLeg(leg: RouteLeg): string {
  if (leg.mode === 'transit' && leg.transit) {
    return TRANSIT_LINE_COLOR[leg.transit.lineType];
  }
  return MODE_COLOR[leg.mode];
}

/** 모드별 선 두께. */
function widthForLeg(leg: RouteLeg): number {
  return leg.mode === 'walk' ? 3 : 5;
}

/**
 * Route.legs → MapPolyline[].
 *
 * coords는 leg.coords 그대로 (디코드 금지 — 프록시가 이미 디코드).
 * 각 leg에 고유 id(`leg-{index}`)를 부여한다.
 *
 * MapPolyline 적합성: 다구간·대중교통 라인별 색상이
 * `{ id, coords, color?, width? }` 인터페이스로 완전히 표현된다.
 */
export function routeToPolylines(route: Route): MapPolyline[] {
  return route.legs.map((leg, index) => ({
    id: `leg-${index}`,
    coords: leg.coords,
    color: colorForLeg(leg),
    width: widthForLeg(leg),
  }));
}

/**
 * 전체 경로의 BBox (fitBounds용).
 * 모든 leg의 coords를 순회해 남서/북동 경계를 계산한다.
 * coords가 비어 있는 leg는 건너뛴다.
 */
export function boundsForRoute(legs: Route['legs']): BBox | null {
  const allCoords: LatLng[] = legs.flatMap((leg) => leg.coords);
  if (allCoords.length === 0) return null;

  let minLat = allCoords[0]!.lat;
  let maxLat = allCoords[0]!.lat;
  let minLng = allCoords[0]!.lng;
  let maxLng = allCoords[0]!.lng;

  for (const c of allCoords) {
    if (c.lat < minLat) minLat = c.lat;
    if (c.lat > maxLat) maxLat = c.lat;
    if (c.lng < minLng) minLng = c.lng;
    if (c.lng > maxLng) maxLng = c.lng;
  }

  return {
    sw: { lat: minLat, lng: minLng },
    ne: { lat: maxLat, lng: maxLng },
  };
}
