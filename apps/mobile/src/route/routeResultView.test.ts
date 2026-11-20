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
    expect(arrivalTime(new Date('2026-01-01T14:50:00Z'), 20 * 60, 'kr')).toBe('00:10');
  });

  it('arrivalTime: 해외(global) 경로는 기기 시간대', () => {
    const at = new Date('2026-01-01T14:50:00Z');
    const local = new Intl.DateTimeFormat('en-GB', { hour: '2-digit', minute: '2-digit', hourCycle: 'h23' })
      .format(new Date(at.getTime() + 20 * 60 * 1000));
    expect(arrivalTime(at, 20 * 60, 'global')).toBe(local);
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

  it('routeMarkers: origin + transit leg 시작마다 transfer(노선색) + destination — 출발지와 겹치는 승차점은 생략', () => {
    const m = routeMarkers(TRANSIT_CHAIN);
    // 출·도는 승차 점 위에 그려지도록 맨 뒤(순서 = 그리기 순서)
    expect(m.slice(-2).map((x) => x.kind)).toEqual(['origin', 'destination']);
    const transfers = m.filter((x) => x.kind === 'transfer');
    // TRANSIT_CHAIN은 출발지에서 바로 승차 → 첫 승차점(흰 점)이 '출'을 가리므로 빠지고 환승점 1개만.
    expect(transfers).toHaveLength(1);
    expect(transfers.every((t) => typeof t.color === 'string')).toBe(true);
  });

  it('fitInsets: 데스크톱은 left가 플로팅 카드(16+380) 이상, 폰은 bottom이 결과 시트(60%) 이상', () => {
    expect(fitInsets(true, 800).left).toBeGreaterThanOrEqual(16 + 380);
    expect(fitInsets(false, 800).bottom).toBeGreaterThanOrEqual(800 * 0.6);
  });

  it('routeMarkers: stops가 있으면 출·도를 입력 지점에, 출발 30 m 이내 승차점(흰 점)은 생략', () => {
    const first = TRANSIT_CHAIN.legs.find((l) => l.mode === 'transit')!;
    const away = { lat: first.start.lat + 0.01, lng: first.start.lng };
    const dest = { lat: 37.6, lng: 127.1 };
    const m = routeMarkers(TRANSIT_CHAIN, [away, dest]);
    expect(m.find((x) => x.kind === 'origin')).toMatchObject({ coord: away });
    expect(m.find((x) => x.kind === 'destination')).toMatchObject({ coord: dest });
    // 출발지가 첫 승차역과 같으면 그 승차점 마커는 빠진다
    const atStation = routeMarkers(TRANSIT_CHAIN, [first.start, dest]);
    expect(atStation.some((x) => x.kind === 'transfer' && x.coord === first.start)).toBe(false);
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
