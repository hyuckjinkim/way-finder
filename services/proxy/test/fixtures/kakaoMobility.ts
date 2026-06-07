/**
 * 카카오모빌리티 다중경유지 Directions API raw 응답 픽스처 (§6 부록).
 * POST https://apis-navi.kakaomobility.com/v1/waypoints/directions
 *
 * 주의:
 * - vertexes는 [lng,lat,lng,lat,...] 평면 배열 (경도 먼저).
 * - section은 origin→waypoint, waypoint→destination 으로 분할 → leg 매핑.
 * - summary.distance(m), duration(s).
 *
 * byte-perfect 보장 아님 (fetch 불가 환경) — 실 형식 검증은 §5 스모크로 연기.
 */
export const KAKAO_MOBILITY_WAYPOINT_RAW = {
  trans_id: 'mobility-fixture',
  routes: [
    {
      result_code: 0,
      result_msg: '길찾기 성공',
      summary: {
        origin: { name: '출발', x: 126.9723, y: 37.5563 },
        destination: { name: '도착', x: 126.978, y: 37.5665 },
        waypoints: [{ name: '경유', x: 126.9882, y: 37.5512 }],
        distance: 4500,
        duration: 780,
      },
      sections: [
        {
          distance: 2400,
          duration: 420,
          roads: [
            { vertexes: [126.9723, 37.5563, 126.98, 37.5538, 126.9882, 37.5512] },
          ],
          guides: [],
        },
        {
          distance: 2100,
          duration: 360,
          roads: [
            { vertexes: [126.9882, 37.5512, 126.983, 37.559, 126.978, 37.5665] },
          ],
          guides: [],
        },
      ],
    },
  ],
};

/** 경유지 없는 단순 차 경로 (section 1개). */
export const KAKAO_MOBILITY_SIMPLE_RAW = {
  trans_id: 'mobility-simple',
  routes: [
    {
      result_code: 0,
      result_msg: '길찾기 성공',
      summary: {
        origin: { name: '출발', x: 126.9723, y: 37.5563 },
        destination: { name: '도착', x: 126.978, y: 37.5665 },
        waypoints: [],
        distance: 3000,
        duration: 600,
      },
      sections: [
        {
          distance: 3000,
          duration: 600,
          roads: [
            { vertexes: [126.9723, 37.5563, 126.98, 37.561, 126.978, 37.5665] },
          ],
          guides: [],
        },
      ],
    },
  ],
};

/** 경로 탐색 실패 응답 (result_code != 0). */
export const KAKAO_MOBILITY_FAIL_RAW = {
  trans_id: 'mobility-fail',
  routes: [{ result_code: 104, result_msg: '출발지와 도착지가 너무 가깝습니다' }],
};
