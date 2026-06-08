/**
 * Mapbox Directions v5 → Route 정규화 (A1, 글로벌 폴백 차/도보/자전거).
 *
 * - geometry.coordinates는 [lng,lat] 배열 (전체 경로, geometries=geojson).
 * - legs[i]는 distance/duration만 → 전체 coords를 첫 leg에 싣고 나머지는 빈 coords
 *   (Mapbox는 leg별 분할 지오메트리를 기본 제공하지 않음 — overview=full 전체선).
 * - transit 미지원 (대중교통은 Google/ODsay — B 스트림).
 *
 * mode 인자로 leg.mode 결정.
 */
import type { TravelMode } from '@wayfinder/shared';
import type { Route, RouteLeg } from '@wayfinder/shared';
import { pairsToCoords } from './_shared/coords.js';

interface MapboxLeg {
  distance?: number;
  duration?: number;
}
interface MapboxRoute {
  distance?: number;
  duration?: number;
  geometry?: { coordinates?: number[][] };
  legs?: MapboxLeg[];
}
export interface MapboxRaw {
  code?: string;
  routes?: MapboxRoute[];
}

/**
 * Mapbox 응답 → Route. code != 'Ok' 또는 routes 없음 → throw (장애 격리는 핸들러 — A3).
 * 전체 geometry는 첫 leg에 싣는다 (leg별 분할 지오메트리 미제공).
 * GeoJSON [lng,lat] 쌍 → LatLng는 `_shared` 통합 매퍼 사용 (F2).
 */
export function normalizeMapboxDirections(raw: MapboxRaw, mode: TravelMode): Route {
  if (raw.code !== undefined && raw.code !== 'Ok') {
    throw new Error(`mapbox: code ${raw.code}`);
  }
  const route = raw.routes?.[0];
  if (!route) throw new Error('mapbox: no route in response');

  const fullCoords = pairsToCoords(route.geometry?.coordinates ?? []);
  const rawLegs = route.legs ?? [];
  if (rawLegs.length === 0) throw new Error('mapbox: no legs');

  const legs: RouteLeg[] = rawLegs.map((leg, i) => {
    const coords = i === 0 ? fullCoords : [];
    const start = coords[0] ?? fullCoords[0] ?? { lat: 0, lng: 0 };
    const end = coords[coords.length - 1] ?? fullCoords[fullCoords.length - 1] ?? start;
    return {
      start,
      end,
      mode,
      durationSec: leg.duration ?? 0,
      distanceM: leg.distance ?? 0,
      coords,
    };
  });

  return {
    legs,
    totalDurationSec: route.duration ?? legs.reduce((a, l) => a + l.durationSec, 0),
    totalDistanceM: route.distance ?? legs.reduce((a, l) => a + l.distanceM, 0),
  };
}
