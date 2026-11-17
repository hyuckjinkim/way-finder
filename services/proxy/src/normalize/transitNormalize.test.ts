/**
 * B1 — 시내 대중교통 정규화 단위 테스트 (ODsay·Google transit).
 * subPath/steps → RouteLeg[] 변환, transit 메타, 분→초, 폴리라인 디코드 검증.
 */
import { describe, it, expect } from 'vitest';

import { normalizeOdsayTransit } from '@wayfinder/shared/transit';
import { normalizeGoogleTransit } from './googleTransit.js';
import {
  ODSAY_CITY_RAW,
  ODSAY_EMPTY_RAW,
} from '../fixtures/odsayTransit.js';
import {
  GOOGLE_TRANSIT_RAW,
  GOOGLE_TRANSIT_EMPTY_RAW,
} from '../fixtures/googleTransit.js';

describe('normalizeOdsayTransit', () => {
  const legs = normalizeOdsayTransit(ODSAY_CITY_RAW);

  it('subPath 각각이 하나의 RouteLeg가 된다', () => {
    expect(legs).toHaveLength(3);
  });

  it('trafficType=1(지하철) → mode=transit, lineType=subway, lane[0].name=lineName', () => {
    const leg = legs[0]!;
    expect(leg.mode).toBe('transit');
    expect(leg.transit?.lineType).toBe('subway');
    expect(leg.transit?.lineName).toBe('4호선');
    expect(leg.transit?.headsign).toBe('사당 방면');
  });

  it('trafficType=3(도보)는 환승 도보 leg — mode=walk, transit 메타 없음', () => {
    const leg = legs[1]!;
    expect(leg.mode).toBe('walk');
    expect(leg.transit).toBeUndefined();
  });

  it('trafficType=2(버스) → lineType=bus, lane[0].name=lineName', () => {
    const leg = legs[2]!;
    expect(leg.mode).toBe('transit');
    expect(leg.transit?.lineType).toBe('bus');
    expect(leg.transit?.lineName).toBe('402번');
  });

  it('sectionTime(분)을 초로 변환한다 (×60)', () => {
    expect(legs[0]!.durationSec).toBe(600); // 10분
    expect(legs[1]!.durationSec).toBe(180); // 3분
    expect(legs[2]!.durationSec).toBe(540); // 9분
  });

  it('start/end 좌표를 X=lng, Y=lat로 매핑한다', () => {
    const leg = legs[0]!;
    expect(leg.start.lat).toBeCloseTo(37.5563);
    expect(leg.start.lng).toBeCloseTo(126.9723);
    expect(leg.coords.length).toBeGreaterThanOrEqual(2);
  });

  it('시내 정규화는 train/express/air lineType을 생성하지 않는다', () => {
    for (const leg of legs) {
      if (leg.transit) {
        expect(['subway', 'bus']).toContain(leg.transit.lineType);
      }
    }
  });

  it('빈 경로 응답 → 빈 배열 (방어적)', () => {
    expect(normalizeOdsayTransit(ODSAY_EMPTY_RAW)).toEqual([]);
  });
});

describe('normalizeGoogleTransit', () => {
  const legs = normalizeGoogleTransit(GOOGLE_TRANSIT_RAW);

  it('legs[].steps[] 각각이 RouteLeg가 된다', () => {
    expect(legs).toHaveLength(3);
  });

  it('WALK step → mode=walk, transit 메타 없음', () => {
    const leg = legs[0]!;
    expect(leg.mode).toBe('walk');
    expect(leg.transit).toBeUndefined();
  });

  it('TRANSIT step(SUBWAY) → lineType=subway, transitLine.name=lineName, headsign', () => {
    const leg = legs[1]!;
    expect(leg.mode).toBe('transit');
    expect(leg.transit?.lineType).toBe('subway');
    expect(leg.transit?.lineName).toBe('Line 4');
    expect(leg.transit?.headsign).toBe('Sadang');
  });

  it('TRANSIT step(BUS) → lineType=bus', () => {
    expect(legs[2]!.transit?.lineType).toBe('bus');
  });

  it("duration '123s' 문자열을 초로 파싱한다", () => {
    expect(legs[0]!.durationSec).toBe(180);
    expect(legs[1]!.durationSec).toBe(600);
    expect(legs[2]!.durationSec).toBe(540);
  });

  it('encodedPolyline을 LatLng[]로 디코드한다 (프록시에서 1회)', () => {
    const leg = legs[1]!;
    expect(leg.coords.length).toBeGreaterThanOrEqual(2);
    expect(leg.coords[0]!.lat).toBeCloseTo(37.5563, 3);
    expect(leg.coords[0]!.lng).toBeCloseTo(126.9723, 3);
  });

  it('글로벌 정규화는 air lineType을 절대 생성하지 않는다', () => {
    for (const leg of legs) {
      expect(leg.transit?.lineType).not.toBe('air');
    }
  });

  it('빈 응답 → 빈 배열 (방어적)', () => {
    expect(normalizeGoogleTransit(GOOGLE_TRANSIT_EMPTY_RAW)).toEqual([]);
  });
});

// 실 ODsay 응답 형태(2026-11-18 서울역→시청 실측, 좌표 외 필드 축약): 도보 subPath에 좌표가 없다.
// 회귀: 이전엔 도보 leg가 start/end {0,0}·coords []로 정규화돼 지도에 (0,0)이 찍혔다.
const ODSAY_REAL_SHAPE = {
  result: { path: [{ pathType: 1, info: { totalTime: 5 }, subPath: [
    { trafficType: 3, distance: 40, sectionTime: 1 },
    { trafficType: 1, distance: 1100, sectionTime: 2, lane: [{ name: '수도권 1호선', subwayCode: 1 }],
      startName: '서울역', startX: 126.972314, startY: 37.555942,
      endName: '시청', endX: 126.977142, endY: 37.565364, way: '시청' },
    { trafficType: 3, distance: 147, sectionTime: 2 },
  ] }] },
} as unknown as Parameters<typeof normalizeOdsayTransit>[0];

describe('normalizeOdsayTransit — 실 응답: 좌표 없는 도보 subPath', () => {
  const from = { lat: 37.5563, lng: 126.9723 };
  const to = { lat: 37.5665, lng: 126.978 };
  const legs = normalizeOdsayTransit(ODSAY_REAL_SHAPE, from, to);

  it('어떤 leg도 (0,0) 좌표를 갖지 않는다', () => {
    for (const leg of legs) {
      for (const p of [leg.start, leg.end, ...leg.coords]) expect(p.lat).not.toBe(0);
    }
  });

  it('첫 도보 = 출발지→승차역, 마지막 도보 = 하차역→도착지', () => {
    expect(legs[0]).toMatchObject({ mode: 'walk', start: from, end: { lat: 37.555942, lng: 126.972314 } });
    expect(legs[2]).toMatchObject({ mode: 'walk', start: { lat: 37.565364, lng: 126.977142 }, end: to });
    expect(legs[0]!.coords).toHaveLength(2);
  });
});
