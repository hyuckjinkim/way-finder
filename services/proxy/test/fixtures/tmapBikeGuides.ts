/**
 * TMAP 자전거 경로 GeoJSON 턴바이턴 raw 픽스처 (P5 F3, best-effort).
 *
 * ⚠️ **지식 기반 픽스처 — byte-perfect 미보장.** 키 없어 실 캡처 불가(계획 §0).
 * TMAP 자전거 maneuver 추출 가능 여부 자체가 미확정(tmapBike stub + KR bike 공급자
 * TBD — 이중 불확실, open-questions §P5). 구조는 TMAP 보행자 GeoJSON 충실도 가정.
 *
 * 형식(보행자와 동일 GeoJSON):
 * - Point feature(`pointType:'SP'`) = 출발/총합 메타.
 * - Point feature with `turnType` = 턴 안내(best-effort 추출 대상). `description` = 안내 텍스트.
 *   `geometry.coordinates` = [lng, lat] 턴 좌표.
 * - LineString feature = 구간 폴리라인.
 *
 * **best-effort 규약:** turnType 보유 Point만 RouteStep으로 추출. 미보유 시 미부착
 * (폴리라인 추종 — P3 TMAP 도보 graceful 패턴). 추정 turnType: 11=좌회전, 12=우회전, 200=출발, 201=도착.
 */

/**
 * 자전거 경로(서울) — turnType 보유 Point feature 포함(추출 가능 형).
 * 기대 RouteStep 추출(테스트 oracle):
 *   turnType 200 → maneuver 'depart',    location {37.5563, 126.9723}
 *   turnType 11  → maneuver 'turn-left',  location {37.561,  126.9805}
 *   turnType 201 → maneuver 'arrive',    location {37.5665, 126.978}
 */
export const TMAP_BIKE_GUIDES_RAW = {
  type: 'FeatureCollection',
  features: [
    {
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [126.9723, 37.5563] },
      properties: { totalDistance: 1900, totalTime: 480, index: 0, pointType: 'SP', turnType: 200, description: '출발' },
    },
    {
      type: 'Feature',
      geometry: {
        type: 'LineString',
        coordinates: [
          [126.9723, 37.5563],
          [126.9805, 37.561],
        ],
      },
      properties: { distance: 1000, time: 250, index: 1, description: '자전거 이동' },
    },
    {
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [126.9805, 37.561] },
      properties: { index: 2, pointType: 'GP', turnType: 11, description: '좌회전' },
    },
    {
      type: 'Feature',
      geometry: {
        type: 'LineString',
        coordinates: [
          [126.9805, 37.561],
          [126.978, 37.5665],
        ],
      },
      properties: { distance: 900, time: 230, index: 3, description: '자전거 이동' },
    },
    {
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [126.978, 37.5665] },
      properties: { index: 4, pointType: 'EP', turnType: 201, description: '도착' },
    },
  ],
};

/**
 * 자전거 경로(서울) — turnType 미보유(추출 불가 형). best-effort: steps 미부착,
 * 폴리라인 추종 graceful degrade 단언용(P3 TMAP 도보 패턴).
 */
export const TMAP_BIKE_NO_GUIDES_RAW = {
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
