import { describe, it, expect } from 'vitest';
import { buildRouteShare } from './routeShare.js';
import { parseRouteParams } from './routeUrl.js';

const ORIGIN = 'https://wf.example';
const parseUrl = (url: string) => {
  expect(url.startsWith(`${ORIGIN}/route/result?`)).toBe(true);
  return parseRouteParams(Object.fromEntries(new URL(url).searchParams));
};

describe('buildRouteShare', () => {
  it('URL 상태가 있으면 라벨·경유지 유지, 모드·선호는 해석된 입력값', () => {
    const url = parseRouteParams({ o: '1,2,출발 A', d: '3,4,도착', w: '5,6,경유' });
    const p = buildRouteShare(url, { stops: [], mode: 'walk', preference: 'quiet', maxExtraMinutes: 10 }, ORIGIN);
    expect(p.title).toBe('경로 결과');
    expect(p.text).toBe('출발 A → 도착');
    const back = parseUrl(p.url);
    expect(back.origin?.label).toBe('출발 A');
    expect(back.waypoints?.[0]?.label).toBe('경유');
    expect(back).toMatchObject({ mode: 'walk', preference: 'quiet', maxExtraMinutes: 10 });
  });

  it('스토어 폴백 진입: 좌표로 o·w·d 생성, 이름은 좌표', () => {
    const stops = [{ lat: 1, lng: 2 }, { lat: 5, lng: 6 }, { lat: 3, lng: 4 }];
    const p = buildRouteShare({}, { stops, mode: 'transit' }, ORIGIN);
    expect(p.text).toBe('1.00000,2.00000 → 3.00000,4.00000');
    const back = parseUrl(p.url);
    expect(back.origin?.coord).toEqual(stops[0]);
    expect(back.waypoints?.map((w) => w.coord)).toEqual([stops[1]]);
    expect(back.destination?.coord).toEqual(stops[2]);
    expect(back.mode).toBe('transit');
  });
});
