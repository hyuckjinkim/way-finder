/**
 * 카카오모빌리티 Directions `sections[].guides[]` 턴바이턴 raw 픽스처 (P5 F3).
 * POST https://apis-navi.kakaomobility.com/v1/waypoints/directions
 *
 * ⚠️ **지식 기반 픽스처 — byte-perfect 미보장.** 키 없어 실 캡처 불가(P4 Valhalla
 * 실-캡처 골든과의 핵심 차이 — 계획 §0). `guides[]`의 x/y 좌표계(WGS84 여부)·
 * `type` numeric 코드표는 키 발급 후 검증(open-questions §P5). 구조는 P1·P2 충실도.
 *
 * 형식:
 * - `guides[].x`/`y` = 턴 좌표(WGS84 가정). **section의 road vertexes와 동일 좌표로 고정**
 *   (step location이 leg coords·서울 bbox 내라는 단언 성립용 — 결정론).
 * - `guides[].type` = 카카오 자체 numeric 코드(아래 추정 표). `guidance` = 안내 텍스트.
 * - `guides[].distance` = 다음 안내까지 거리(m).
 *
 * 추정 type 코드(open-questions §P5 미검증): 1=직진, 2=좌회전, 3=우회전, 100=출발, 101=도착.
 */

/**
 * 단순 차 경로(서울, 1 section) — guides 보유.
 * 기대 RouteStep 추출(테스트 oracle):
 *   guide0(type 100, 출발)   → maneuver 'depart',     location {37.5563,126.9723}
 *   guide1(type 2,   좌회전) → maneuver 'turn-left',  location {37.561, 126.98}
 *   guide2(type 101, 도착)   → maneuver 'arrive',     location {37.5665,126.978}
 */
export const KAKAO_CAR_GUIDES_RAW = {
  trans_id: 'car-guides-fixture',
  routes: [
    {
      result_code: 0,
      result_msg: '길찾기 성공',
      summary: { distance: 3000, duration: 600 },
      sections: [
        {
          distance: 3000,
          duration: 600,
          roads: [
            { vertexes: [126.9723, 37.5563, 126.98, 37.561, 126.978, 37.5665] },
          ],
          guides: [
            { name: '출발지', x: 126.9723, y: 37.5563, type: 100, guidance: '출발', distance: 0 },
            { name: '무교로', x: 126.98, y: 37.561, type: 2, guidance: '무교로 방면 좌회전', distance: 1500 },
            { name: '도착지', x: 126.978, y: 37.5665, type: 101, guidance: '목적지에 도착했습니다', distance: 0 },
          ],
        },
      ],
    },
  ],
};

/**
 * guides 부재 차 경로(하위호환) — steps 미부착(기존 폴리라인 동작) 단언용.
 * 기존 정규화기 무회귀: `guides: []`(또는 부재)면 steps 없이 폴리라인 leg만.
 */
export const KAKAO_CAR_NO_GUIDES_RAW = {
  trans_id: 'car-no-guides-fixture',
  routes: [
    {
      result_code: 0,
      result_msg: '길찾기 성공',
      summary: { distance: 3000, duration: 600 },
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
