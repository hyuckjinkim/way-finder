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
import { haversineDistanceM } from '@wayfinder/shared';

/** 입력 지점과 경로 끝이 이보다 멀면 "같은 곳"이 아니다 — 도보 연결선·마커 판단 기준(m). */
export const STOP_GAP_M = 30;

// ─── 모드별 기본 색상 ──────────────────────────────────────────────────────────

/** 이동 수단별 기본 선 색상. */
const MODE_COLOR: Record<TravelMode, string> = {
  walk: '#8A8F98',    // 회색 — 도보 (점선)
  bike: '#2E9E5B',    // 녹색 — 자전거
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
    return leg.transit.lineColor ?? TRANSIT_LINE_COLOR[leg.transit.lineType];
  }
  return MODE_COLOR[leg.mode];
}

const WALK_WIDTH = 4;

/** 모드별 선 두께. */
function widthForLeg(leg: RouteLeg): number {
  return leg.mode === 'walk' ? WALK_WIDTH : leg.mode === 'transit' ? 6 : 5;
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
export function routeToPolylines(route: Route, stops?: LatLng[]): MapPolyline[] {
  const lines: MapPolyline[] = route.legs.map((leg, index) => ({
    id: `leg-${index}`,
    coords: leg.coords,
    color: colorForLeg(leg),
    width: widthForLeg(leg),
    ...(leg.mode === 'walk' ? { dashed: true } : {}),
  }));
  // 카카오 대중교통은 첫/끝 도보를 주지 않는다 → 입력 출발지→첫 승차, 마지막 하차→도착지를 점선으로 잇는다.
  // stops 없이 부르면(구간 바 색 계산) leg 인덱스와 1:1을 유지한다.
  const first = route.legs[0];
  const last = route.legs[route.legs.length - 1];
  const origin = stops?.[0];
  const dest = stops?.[stops.length - 1];
  const connector = (id: string, a: LatLng, b: LatLng): MapPolyline => ({
    id,
    coords: [a, b],
    color: MODE_COLOR.walk,
    width: WALK_WIDTH,
    dashed: true,
  });
  if (first?.mode === 'transit' && origin && haversineDistanceM(origin, first.start) > STOP_GAP_M) {
    lines.unshift(connector('walk-origin', origin, first.start));
  }
  if (last?.mode === 'transit' && dest && haversineDistanceM(last.end, dest) > STOP_GAP_M) {
    lines.push(connector('walk-destination', last.end, dest));
  }
  // 경유지: 구간별 탐색을 이어 붙인 경로라 구간 경계(leg i 끝 → leg i+1 시작)에도 도보가 빠져 있다.
  // Route에 경계 정보가 없으니 경유지마다 (끝→경유지 + 경유지→다음 시작)이 최소인 경계를 순서대로 고른다.
  let from = 0;
  (stops?.slice(1, -1) ?? []).forEach((w, j) => {
    let best = -1;
    let bestGap = Infinity;
    for (let i = from; i < route.legs.length - 1; i++) {
      const gap = haversineDistanceM(route.legs[i]!.end, w) + haversineDistanceM(w, route.legs[i + 1]!.start);
      if (gap < bestGap) [best, bestGap] = [i, gap];
    }
    if (best < 0) return;
    from = best + 1;
    const before = route.legs[best]!;
    const after = route.legs[best + 1]!;
    if (before.mode === 'transit' && haversineDistanceM(before.end, w) > STOP_GAP_M) {
      lines.push(connector(`walk-wp${j}-in`, before.end, w));
    }
    if (after.mode === 'transit' && haversineDistanceM(w, after.start) > STOP_GAP_M) {
      lines.push(connector(`walk-wp${j}-out`, w, after.start));
    }
  });
  return lines;
}

/**
 * 전체 경로의 BBox (fitBounds용).
 * 모든 leg의 coords(+ extra: 입력 출발·도착 등)를 순회해 남서/북동 경계를 계산한다.
 * coords가 비어 있는 leg는 건너뛴다.
 */
export function boundsForRoute(legs: Route['legs'], extra: LatLng[] = []): BBox | null {
  const allCoords: LatLng[] = [...legs.flatMap((leg) => leg.coords), ...extra];
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
