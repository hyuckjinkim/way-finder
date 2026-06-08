/**
 * Google Routes v2 (computeRoutes) `legs[].steps[].navigationInstruction` 턴바이턴
 * raw 픽스처 (P5 F3). POST https://routes.googleapis.com/directions/v2:computeRoutes
 *
 * ⚠️ **지식 기반 픽스처 — byte-perfect 미보장.** 키 없어 실 캡처 불가(계획 §0).
 * `routes.legs.steps.navigationInstruction`·`.startLocation` 필드마스크는 실 호출 시
 * 적용 필요(open-questions §P5 — maneuver enum 실 값 미검증). 구조는 P1·P2 충실도.
 *
 * 형식:
 * - `navigationInstruction.maneuver` = Google 문자열 enum
 *   (TURN_LEFT·TURN_RIGHT·STRAIGHT·DEPART·MERGE·FORK·ROUNDABOUT_* 등) → ManeuverKind 직접 매핑.
 * - `navigationInstruction.instructions` = 안내 텍스트.
 * - `startLocation.latLng` = {latitude, longitude} 턴 시작 좌표.
 * - `distanceMeters` = step 거리(m).
 * - leg.polyline.encodedPolyline = leg 전체 폴리라인(precision 5, @googlemaps/polyline-codec).
 *
 * **수렴 단언(§1.2 load-bearing):** step1의 maneuver `TURN_LEFT`는 kakao 픽스처의
 * numeric type 2와 **동일 `'turn-left'` ManeuverKind로 수렴**해야 한다.
 */

/**
 * 단순 차/자전거 경로(글로벌 — NYC, leg 1개) — navigationInstruction 보유.
 * **startLocation 좌표는 leg polyline 디코드 점과 일치**(step location ∈ leg coords 단언 성립).
 * 기대 RouteStep 추출(테스트 oracle):
 *   step0 DEPART     → maneuver 'depart',     location {40.7128, -74.006}
 *   step1 TURN_LEFT  → maneuver 'turn-left',  location {40.72,   -74}      (← kakao type 2와 수렴)
 *   step2 TURN_RIGHT → maneuver 'turn-right', location {40.73,   -73.99}
 */
export const GOOGLE_CAR_STEPS_RAW = {
  routes: [
    {
      distanceMeters: 1900,
      duration: '480s',
      polyline: { encodedPolyline: '_vnwFnhubM_l@od@o}@o}@' },
      legs: [
        {
          distanceMeters: 1900,
          duration: '480s',
          polyline: { encodedPolyline: '_vnwFnhubM_l@od@o}@o}@' },
          steps: [
            {
              distanceMeters: 0,
              startLocation: { latLng: { latitude: 40.7128, longitude: -74.006 } },
              navigationInstruction: { maneuver: 'DEPART', instructions: 'Head north' },
            },
            {
              distanceMeters: 1000,
              startLocation: { latLng: { latitude: 40.72, longitude: -74 } },
              navigationInstruction: { maneuver: 'TURN_LEFT', instructions: 'Turn left' },
            },
            {
              distanceMeters: 900,
              startLocation: { latLng: { latitude: 40.73, longitude: -73.99 } },
              navigationInstruction: { maneuver: 'TURN_RIGHT', instructions: 'Turn right onto destination' },
            },
          ],
        },
      ],
    },
  ],
};

/**
 * navigationInstruction 부재 경로(하위호환) — steps 미부착(기존 폴리라인 동작) 단언용.
 * 기존 정규화기 무회귀: steps 부재(또는 navigationInstruction 부재)면 폴리라인 leg만.
 */
export const GOOGLE_CAR_NO_STEPS_RAW = {
  routes: [
    {
      distanceMeters: 1900,
      duration: '480s',
      polyline: { encodedPolyline: '_vnwFnhubM_l@od@o}@o}@' },
      legs: [
        {
          distanceMeters: 1900,
          duration: '480s',
          polyline: { encodedPolyline: '_vnwFnhubM_l@od@o}@o}@' },
        },
      ],
    },
  ],
};
