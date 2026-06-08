/**
 * TMAP 보행자 경로 (GeoJSON) → Route 정규화 (A1, 한국 도보).
 *
 * - LineString feature들의 coordinates([lng,lat])를 이어 polyline 구성.
 * - 첫 Point feature properties.totalDistance(m)/totalTime(s) = 전체 합계.
 * - 보행자는 단일 leg로 합성 (TMAP은 경유지도 하나의 LineString 시퀀스로 반환).
 *
 * 자전거 정규화기(tmapBike)가 같은 GeoJSON 파서를 재사용하므로 mode 인자를 받는다.
 */
import type { LatLng, TravelMode } from '@wayfinder/shared';
import type { Route, RouteLeg } from '@wayfinder/shared';
import { pairsToCoords } from './_shared/coords.js';

interface TmapGeometry {
  type?: string;
  coordinates?: number[] | number[][];
}
interface TmapProperties {
  totalDistance?: number;
  totalTime?: number;
}
interface TmapFeature {
  geometry?: TmapGeometry;
  properties?: TmapProperties;
}
export interface TmapGeoJsonRaw {
  features?: TmapFeature[];
}

/**
 * TMAP GeoJSON 응답 → 단일 leg Route. mode로 leg.mode 결정 (도보/자전거 공용).
 * LineString feature들을 순서대로 이어 coords를, Point feature의 total*로 합계를 구성.
 * GeoJSON [lng,lat] 쌍 → LatLng는 `_shared` 통합 매퍼 사용 (F2).
 */
export function normalizeTmapGeoJson(raw: TmapGeoJsonRaw, mode: TravelMode): Route {
  const features = raw.features ?? [];
  if (features.length === 0) throw new Error('tmap: no features in response');

  const coords: LatLng[] = [];
  let totalDistance = 0;
  let totalTime = 0;

  for (const feature of features) {
    const geom = feature.geometry;
    if (geom?.type === 'LineString' && Array.isArray(geom.coordinates)) {
      coords.push(...pairsToCoords(geom.coordinates as number[][]));
    }
    const props = feature.properties;
    if (props?.totalDistance !== undefined) totalDistance = props.totalDistance;
    if (props?.totalTime !== undefined) totalTime = props.totalTime;
  }

  if (coords.length === 0) throw new Error('tmap: no LineString geometry');

  const leg: RouteLeg = {
    start: coords[0]!,
    end: coords[coords.length - 1]!,
    mode,
    durationSec: totalTime,
    distanceM: totalDistance,
    coords,
  };

  return {
    legs: [leg],
    totalDurationSec: totalTime,
    totalDistanceM: totalDistance,
  };
}

/** TMAP 보행자 응답 → Route (mode='walk'). */
export function normalizeTmapPedestrian(raw: TmapGeoJsonRaw): Route {
  return normalizeTmapGeoJson(raw, 'walk');
}
