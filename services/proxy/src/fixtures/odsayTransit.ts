/**
 * B1 — ODsay searchPubTransPathT raw 픽스처 (§6 부록 형식 기반, 직접 작성).
 * 실 fetch 없이 정규화 함수 단위 테스트용. byte-perfect 미보장 (§7).
 *
 * 시간은 ODsay 규약대로 **분 단위** (정규화기가 ×60으로 초 변환).
 * X=경도, Y=위도.
 */
import type { OdsayTransitResponse } from '@wayfinder/shared/transit';

/** 서울 시내: 지하철 → 환승도보 → 버스 (단일 구간 path[0]). */
export const ODSAY_CITY_RAW: OdsayTransitResponse = {
  result: {
    path: [
      {
        pathType: 3,
        info: {
          totalTime: 23, // 분 (10 + 3 + 9 + 환승버퍼는 정규화기 밖)
          totalDistance: 6220,
          busTransitCount: 1,
          subwayTransitCount: 1,
        },
        subPath: [
          {
            trafficType: 1, // 지하철
            sectionTime: 10,
            distance: 3200,
            startName: '서울역',
            endName: '회현',
            startX: 126.9723,
            startY: 37.5563,
            endX: 126.9882,
            endY: 37.5512,
            way: '사당 방면',
            lane: [{ name: '4호선', subwayCode: 4 }],
          },
          {
            trafficType: 3, // 환승 도보
            sectionTime: 3,
            distance: 220,
            startName: '회현',
            endName: '버스정류장',
            startX: 126.9882,
            startY: 37.5512,
            endX: 126.9885,
            endY: 37.5515,
          },
          {
            trafficType: 2, // 버스
            sectionTime: 9,
            distance: 2800,
            startName: '버스정류장',
            endName: '시청',
            startX: 126.9885,
            startY: 37.5515,
            endX: 126.978,
            endY: 37.5665,
            way: '시청 방면',
            lane: [{ name: '402번', busNo: '402' }],
          },
        ],
      },
    ],
  },
};

/** 빈 경로 응답 (방어적 처리 검증용). */
export const ODSAY_EMPTY_RAW: OdsayTransitResponse = {
  result: { path: [] },
};

/**
 * 시외(서울역→부산역) 단일 KTX 구간 — B3 도시간 판정/정규화용.
 * lane.name='KTX'. 시내 정규화기는 이를 'bus'/'subway'로 떨어뜨리므로,
 * B3가 도시간 구간을 별도로 train/express로 승격한다.
 */
export const ODSAY_INTERCITY_RAW: OdsayTransitResponse = {
  result: {
    path: [
      {
        pathType: 1,
        info: {
          totalTime: 160, // 분
          totalDistance: 325000,
        },
        subPath: [
          {
            trafficType: 1,
            sectionTime: 160,
            distance: 325000,
            startName: '서울역',
            endName: '부산역',
            startX: 126.9707,
            startY: 37.5547,
            endX: 129.0413,
            endY: 35.1151,
            way: '부산행',
            lane: [{ name: 'KTX' }],
          },
        ],
      },
    ],
  },
};
