/**
 * Mapbox Directions v5 raw 응답 픽스처 (§6 부록 — 글로벌 폴백).
 * GET https://api.mapbox.com/directions/v5/mapbox/{profile}/{coords}?geometries=geojson&overview=full
 *
 * 주의:
 * - geometry.coordinates는 [lng,lat] 배열 (전체 경로). leg는 distance/duration만.
 * - distance(m), duration(s).
 * - waypoint 세미콜론 구분 = 경유지 → legs[i].
 *
 * byte-perfect 보장 아님 (§5 스모크로 검증 연기).
 */

/** 경유지 차 경로 (legs 2개 — 좌표 3개). */
export const MAPBOX_WAYPOINT_RAW = {
  code: 'Ok',
  routes: [
    {
      distance: 4500,
      duration: 780,
      geometry: {
        type: 'LineString',
        coordinates: [
          [-74.006, 40.7128],
          [-74.0, 40.72],
          [-73.99, 40.73],
        ],
      },
      legs: [
        { distance: 2400, duration: 420, summary: 'leg1' },
        { distance: 2100, duration: 360, summary: 'leg2' },
      ],
    },
  ],
  waypoints: [],
};

/** 단순 도보 경로 (글로벌, leg 1개). */
export const MAPBOX_SIMPLE_RAW = {
  code: 'Ok',
  routes: [
    {
      distance: 1100,
      duration: 900,
      geometry: {
        type: 'LineString',
        coordinates: [
          [-74.006, 40.7128],
          [-74.003, 40.716],
          [-74.0, 40.72],
        ],
      },
      legs: [{ distance: 1100, duration: 900, summary: 'walk' }],
    },
  ],
  waypoints: [],
};

/** 경로 없음 (code != 'Ok'). */
export const MAPBOX_NO_ROUTE_RAW = { code: 'NoRoute', routes: [] };
