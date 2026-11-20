import { describe, it, expect } from 'vitest';
import { TRANSIT_CHAIN, WALK_SIMPLE } from '@wayfinder/shared/mocks';
import {
  arrivalTime,
  canStartNav,
  fitInsets,
  formatFare,
  formatMinutes,
  hasTransit,
  kakaoMapLink,
  readableTextColor,
  routeMarkers,
  routeStepItems,
  segmentBar,
  transferCount,
  transitStepText,
  walkMinutes,
} from './routeResultView.js';

describe('routeResultView', () => {
  it('formatFare: 천 단위 쉼표 + 원', () => {
    expect(formatFare(1650)).toBe('1,650원');
    expect(formatFare(950)).toBe('950원');
    expect(formatFare(1234567)).toBe('1,234,567원');
  });

  it('arrivalTime: now + 소요를 KST로, 자정 넘김 포함 (기기 시간대 무관)', () => {
    expect(arrivalTime(new Date('2026-01-01T00:50:00Z'), 25 * 60)).toBe('10:15'); // 09:50 KST
    expect(arrivalTime(new Date('2026-01-01T14:50:00Z'), 20 * 60)).toBe('00:10'); // 23:50 KST
  });

  it('formatMinutes: 경로 카드와 같은 h/m 표기', () => {
    expect(formatMinutes(178)).toBe('2시간 58분');
    expect(formatMinutes(24)).toBe('24분');
  });

  it('kakaoMapLink: 이름 인코딩 + 모드별 by 경로', () => {
    const o = { label: '구로디지털단지역', coord: { lat: 37.485, lng: 126.901 } };
    const d = { label: '강남역', coord: { lat: 37.498, lng: 127.028 } };
    expect(kakaoMapLink(o, d, 'transit')).toBe(
      `https://map.kakao.com/link/by/traffic/${encodeURIComponent('구로디지털단지역')},37.485,126.901/${encodeURIComponent('강남역')},37.498,127.028`,
    );
    expect(kakaoMapLink(o, d, 'walk')).toContain('/link/by/walk/');
  });

  it('도보 합계·환승 수·대중교통 여부', () => {
    expect(hasTransit(WALK_SIMPLE)).toBe(false);
    expect(walkMinutes(WALK_SIMPLE)).toBe(15);
    expect(hasTransit(TRANSIT_CHAIN)).toBe(true);
    expect(transferCount(TRANSIT_CHAIN)).toBe(1);
  });

  it('segmentBar: leg 수만큼, 가중치=소요, 도보는 회색', () => {
    const bar = segmentBar(WALK_SIMPLE);
    expect(bar).toHaveLength(WALK_SIMPLE.legs.length);
    expect(bar[0]!.weight).toBe(WALK_SIMPLE.legs[0]!.durationSec);
    expect(bar[0]!.color).toBe('#8A8F98');
  });

  it('routeStepItems: transit leg는 노선명·색·방면 포함', () => {
    const steps = routeStepItems(TRANSIT_CHAIN);
    const transit = steps.filter((s) => s.kind === 'transit');
    expect(transit.map((s) => (s.kind === 'transit' ? s.lineName : ''))).toEqual(['4호선', '402번']);
    expect(transit[0]).toMatchObject({ headsign: '사당 방면' });
  });

  it('routeMarkers: origin + transit leg 시작마다 transfer(노선색) + destination', () => {
    const m = routeMarkers(TRANSIT_CHAIN);
    expect(m[0]).toMatchObject({ kind: 'origin' });
    expect(m[m.length - 1]).toMatchObject({ kind: 'destination' });
    const transfers = m.filter((x) => x.kind === 'transfer');
    expect(transfers).toHaveLength(2);
    expect(transfers.every((t) => typeof t.color === 'string')).toBe(true);
  });

  it('fitInsets: 데스크톱은 left가 카드 폭 이상, 폰은 bottom이 패널 높이 이상', () => {
    expect(fitInsets(true, 800, 0).left).toBeGreaterThanOrEqual(400);
    expect(fitInsets(false, 800, 300).bottom).toBeGreaterThanOrEqual(300);
    expect(fitInsets(false, 800, 0).bottom).toBeGreaterThanOrEqual(800 * 0.55); // 미측정 → 최대 높이
  });

  it('readableTextColor: 밝은 배경은 어두운 글자', () => {
    expect(readableTextColor('#FFD700')).toBe('#111');
    expect(readableTextColor('#3949AB')).toBe('#fff');
  });

  it('canStartNav: 웹만 false', () => {
    expect(canStartNav('web')).toBe(false);
    expect(canStartNav('ios')).toBe(true);
    expect(canStartNav('android')).toBe(true);
  });

  it('transitStepText: 정류장명 있으면 "A → B (방면) · N분", 없으면 방면만', () => {
    const base = { kind: 'transit' as const, lineName: '2호선', color: '#00A84D', minutes: 24 };
    expect(transitStepText({ ...base, fromStop: '구로디지털단지', toStop: '강남', headsign: '사당 방면' })).toBe(
      '구로디지털단지 → 강남 (사당 방면) · 24분',
    );
    expect(transitStepText({ ...base, fromStop: '구로디지털단지', toStop: '강남' })).toBe('구로디지털단지 → 강남 · 24분');
    expect(transitStepText({ ...base, headsign: '사당 방면' })).toBe('사당 방면 · 24분');
    expect(transitStepText(base)).toBe('24분');
    // ODsay way가 하차역과 같으면("강남 (강남)") 방면 생략
    expect(transitStepText({ ...base, fromStop: '구로디지털단지', toStop: '강남', headsign: '강남' })).toBe(
      '구로디지털단지 → 강남 · 24분',
    );
    expect(transitStepText({ ...base, fromStop: '구로디지털단지', toStop: '강남', headsign: '잠실' })).toBe(
      '구로디지털단지 → 강남 (잠실) · 24분',
    );
    expect(transitStepText({ ...base, minutes: 178 })).toBe('2시간 58분');
  });
});
