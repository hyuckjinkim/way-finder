import { describe, it, expect } from 'vitest';
import { normalizeKakaoTransit, MAX_KAKAO_ALTERNATIVES } from './kakaoTransit.js';
import { KAKAO_TRANSIT_RAW, KAKAO_TRANSIT_NO_RESULTS } from '../fixtures/kakaoTransit.js';

const FROM = { lat: 37.4852, lng: 126.9014 };
const TO = { lat: 37.4979, lng: 127.0276 };

describe('normalizeKakaoTransit', () => {
  const route = normalizeKakaoTransit(KAKAO_TRANSIT_RAW, FROM, TO)!;

  it('총 소요·거리·요금은 공급자 값(step 합 아님)', () => {
    expect(route.totalDurationSec).toBe(2083);
    expect(route.totalDistanceM).toBe(13489);
    expect(route.fare).toBe(1650);
    const legSum = route.legs.reduce((a, l) => a + l.durationSec, 0);
    expect(legSum).toBeLessThan(route.totalDurationSec);
  });

  it('지하철 step → transit leg (노선명·색·승하차역, [lng,lat] → LatLng)', () => {
    const leg = route.legs[0]!;
    expect(leg.mode).toBe('transit');
    expect(leg.transit).toMatchObject({
      lineName: '2호선',
      lineType: 'subway',
      lineColor: '#00A84D',
      fromStop: '구로디지털단지',
      toStop: '강남',
    });
    expect(leg.coords[0]!.lat).toBeCloseTo(37.48, 1);
    expect(leg.coords[0]!.lng).toBeCloseTo(126.9, 1);
  });

  it('대안: 나머지 경로, WALKING 환승 → walk leg, 버스 색은 vehicle.type', () => {
    const alts = route.alternatives!;
    expect(alts.length).toBe(Math.min(3, MAX_KAKAO_ALTERNATIVES));
    const transfer = alts[0]!;
    expect(transfer.legs.map((l) => l.mode)).toEqual(['transit', 'walk', 'transit']);
    expect(transfer.legs[2]!.transit).toMatchObject({ lineName: '신분당선', lineColor: '#D31145' });
    const bus = alts[1]!.legs[0]!;
    expect(bus.transit).toMatchObject({ lineName: '5531', lineType: 'bus', lineColor: '#5BB025' });
  });

  it('경로 없음 → null', () => {
    expect(normalizeKakaoTransit(KAKAO_TRANSIT_NO_RESULTS, FROM, TO)).toBeNull();
  });
});
