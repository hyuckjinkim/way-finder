/**
 * TMAP 보행자 경로 API raw 응답 픽스처 (§6 부록).
 * POST https://apis.openapi.sk.com/tmap/routes/pedestrian?version=1
 *
 * GeoJSON FeatureCollection:
 * - LineString feature들의 coordinates([lng,lat])를 이어 polyline 구성.
 * - 첫 Point feature의 properties.totalDistance(m)/totalTime(s)가 전체 합계.
 * - 개별 LineString feature는 distance/time 부분값.
 *
 * byte-perfect 보장 아님 (§5 스모크로 검증 연기).
 */
export const TMAP_PEDESTRIAN_RAW = {
  type: 'FeatureCollection',
  features: [
    {
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [126.9723, 37.5563] },
      properties: {
        totalDistance: 1100,
        totalTime: 900,
        index: 0,
        pointType: 'SP',
        description: '출발',
      },
    },
    {
      type: 'Feature',
      geometry: {
        type: 'LineString',
        coordinates: [
          [126.9723, 37.5563],
          [126.975, 37.5605],
          [126.978, 37.5665],
        ],
      },
      properties: { distance: 1100, time: 900, index: 1, description: '도보 이동' },
    },
  ],
};

/** 경유지 포함 보행자 경로 (LineString 2개 — passList 분할). */
export const TMAP_PEDESTRIAN_WAYPOINT_RAW = {
  type: 'FeatureCollection',
  features: [
    {
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [126.9723, 37.5563] },
      properties: { totalDistance: 1600, totalTime: 1320, index: 0, pointType: 'SP' },
    },
    {
      type: 'Feature',
      geometry: {
        type: 'LineString',
        coordinates: [
          [126.9723, 37.5563],
          [126.9882, 37.5512],
        ],
      },
      properties: { distance: 900, time: 720, index: 1 },
    },
    {
      type: 'Feature',
      geometry: {
        type: 'LineString',
        coordinates: [
          [126.9882, 37.5512],
          [126.978, 37.5665],
        ],
      },
      properties: { distance: 700, time: 600, index: 2 },
    },
  ],
};
