/**
 * Google Routes v2 (computeRoutes) raw 응답 픽스처 (§6 부록).
 * POST https://routes.googleapis.com/directions/v2:computeRoutes
 *
 * 주의:
 * - duration은 `'123s'` 문자열 (파싱 필요).
 * - polyline.encodedPolyline은 Google encoded polyline → 코덱 decode로 LatLng[].
 * - encodedPolyline 값은 @googlemaps/polyline-codec encode()로 생성한 실 인코딩
 *   (precision 5) — decode 라운드트립이 정확히 성립한다.
 *
 * byte-perfect 보장 아님 (§5 스모크로 검증 연기).
 */

/** 차/도보 경유지 경로 (legs 2개 — intermediates 1개). */
export const GOOGLE_ROUTES_WAYPOINT_RAW = {
  routes: [
    {
      distanceMeters: 4500,
      duration: '780s',
      polyline: { encodedPolyline: '{efdF{g~eWz^kbBs~Av~@' },
      legs: [
        {
          distanceMeters: 2400,
          duration: '420s',
          polyline: { encodedPolyline: '{efdF{g~eWrNco@fOgr@' },
        },
        {
          distanceMeters: 2100,
          duration: '360s',
          polyline: { encodedPolyline: '_fedFgkafWwo@n_@{m@f^' },
        },
      ],
    },
  ],
};

/** 단순 자전거 경로 (글로벌, leg 1개). */
export const GOOGLE_ROUTES_SIMPLE_RAW = {
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

/** 빈 routes (경로 없음). */
export const GOOGLE_ROUTES_EMPTY_RAW = { routes: [] };
