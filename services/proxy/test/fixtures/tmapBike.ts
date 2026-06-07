/**
 * TMAP 자전거 경로 API raw 응답 픽스처 (§6 부록).
 * 보행자와 동일한 GeoJSON 구조 (자전거 엔드포인트).
 *
 * **실 형식 미검증 → open-questions 로깅 대상 (§신규 결정).**
 * 정규화기는 보행자와 같은 GeoJSON 파서를 공유하되 leg.mode='bike'로 매핑.
 */
export const TMAP_BIKE_RAW = {
  type: 'FeatureCollection',
  features: [
    {
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [126.9723, 37.5563] },
      properties: { totalDistance: 1900, totalTime: 480, index: 0, pointType: 'SP' },
    },
    {
      type: 'Feature',
      geometry: {
        type: 'LineString',
        coordinates: [
          [126.9723, 37.5563],
          [126.9805, 37.561],
          [126.978, 37.5665],
        ],
      },
      properties: { distance: 1900, time: 480, index: 1, description: '자전거 이동' },
    },
  ],
};
