/**
 * TMAP 자전거 경로 (GeoJSON) → Route 정규화 (A1, 한국 자전거 + P5 F2 best-effort steps).
 *
 * 보행자와 동일한 GeoJSON 구조를 공유 — normalizeTmapGeoJson 재사용, mode='bike'.
 * **P5 F2: turnType 보유 Point feature를 best-effort로 RouteStep 추출(여기서만 — 공유
 * 보행자 정규화기 무수정, 회귀 격리).** 미추출 시 폴리라인 추종(P3 TMAP 도보 graceful).
 * **실 형식 미검증 → open-questions §P5(자전거 maneuver 추출 가능 여부 미확정).**
 */
import type { ManeuverKind, Route, RouteStep } from '@wayfinder/shared';
import { normalizeTmapGeoJson, type TmapGeoJsonRaw } from './tmapPedestrian.js';

/**
 * TMAP 자전거 turnType → `ManeuverKind` (P5 F2, best-effort).
 *
 * ⚠️ 추정 코드표 — 실 추출 가능 여부 자체가 미확정(open-questions §P5). 미매핑→`'unknown'`.
 */
const TMAP_BIKE_MANEUVER_KIND: Readonly<Record<number, ManeuverKind>> = {
  11: 'turn-left',
  12: 'turn-right',
  200: 'depart',
  201: 'arrive',
};

interface TmapFeature {
  geometry?: { type?: string; coordinates?: unknown };
  properties?: { turnType?: number; description?: string; distance?: number };
}

/** turnType 보유 Point feature → RouteStep[] (best-effort). 부재 시 빈 배열(폴리라인 폴백). */
function extractTmapBikeSteps(raw: TmapGeoJsonRaw): RouteStep[] {
  const features = (raw.features ?? []) as TmapFeature[];
  const steps: RouteStep[] = [];
  for (const f of features) {
    if (f.geometry?.type !== 'Point') continue;
    const turnType = f.properties?.turnType;
    if (turnType === undefined) continue;
    const coord = f.geometry.coordinates;
    // GeoJSON Point coordinates = [lng, lat].
    if (!Array.isArray(coord) || coord.length < 2) continue;
    const [lng, lat] = coord as number[];
    const step: RouteStep = {
      location: { lat: lat ?? 0, lng: lng ?? 0 },
      instruction: f.properties?.description ?? '',
      maneuver: TMAP_BIKE_MANEUVER_KIND[turnType] ?? 'unknown',
      type: turnType, // raw 보존
      distanceM: f.properties?.distance ?? 0,
    };
    steps.push(step);
  }
  return steps;
}

/**
 * TMAP 자전거 응답 → Route (mode='bike'). turnType 보유 시 best-effort steps 부착,
 * 부재 시 폴리라인 추종(미부착, 하위호환).
 */
export function normalizeTmapBike(raw: TmapGeoJsonRaw): Route {
  const route = normalizeTmapGeoJson(raw, 'bike');
  const steps = extractTmapBikeSteps(raw);
  // 단일 bike leg 가정(보행자 정규화기와 동일) — 추출 step은 첫 leg에 부착.
  if (steps.length > 0 && route.legs[0]) {
    route.legs[0].steps = steps;
  }
  return route;
}
