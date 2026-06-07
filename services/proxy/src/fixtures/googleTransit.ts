/**
 * B1 — Google Routes v2 (travelMode=TRANSIT) raw 픽스처 (§6 부록 형식 기반).
 * 실 fetch 없이 정규화 함수 단위 테스트용. byte-perfect 미보장 (§7).
 *
 * encodedPolyline은 @googlemaps/polyline-codec로 인코드한 실제 값 →
 * 정규화기 decode가 라운드트립 검증된다. duration은 '123s' 문자열.
 */
import type { GoogleRoutesResponse } from '../normalize/googleTransit.js';

/** 글로벌 시내: 도보 → 지하철 → 도보 transit (steps 펼침). */
export const GOOGLE_TRANSIT_RAW: GoogleRoutesResponse = {
  routes: [
    {
      distanceMeters: 6220,
      duration: '1380s',
      legs: [
        {
          distanceMeters: 6220,
          duration: '1380s',
          steps: [
            {
              travelMode: 'WALK',
              distanceMeters: 220,
              duration: '180s',
              polyline: { encodedPolyline: '_fedFgkafW{@{@' },
            },
            {
              travelMode: 'TRANSIT',
              distanceMeters: 3200,
              duration: '600s',
              polyline: { encodedPolyline: '{efdF{g~eWz^kbB' },
              transitDetails: {
                transitLine: {
                  name: 'Line 4',
                  nameShort: '4',
                  vehicle: { type: 'SUBWAY' },
                },
                headsign: 'Sadang',
              },
            },
            {
              travelMode: 'TRANSIT',
              distanceMeters: 2800,
              duration: '540s',
              polyline: { encodedPolyline: '{gedFcmafWw|Ar`A' },
              transitDetails: {
                transitLine: {
                  name: 'Bus 402',
                  vehicle: { type: 'BUS' },
                },
                headsign: 'City Hall',
              },
            },
          ],
        },
      ],
    },
  ],
};

/** 빈 응답 (방어적 처리 검증용). */
export const GOOGLE_TRANSIT_EMPTY_RAW: GoogleRoutesResponse = { routes: [] };
