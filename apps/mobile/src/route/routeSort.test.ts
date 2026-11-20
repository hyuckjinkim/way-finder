import { describe, it, expect } from 'vitest';
import type { Route, RouteLeg, TransitMeta } from '@wayfinder/shared';
import { arrangeRoutes } from './routeSort.js';

const P = { lat: 37.5, lng: 127 };
const walk = (min: number): RouteLeg => ({ start: P, end: P, mode: 'walk', durationSec: min * 60, distanceM: 1, coords: [] });
const ride = (lineType: TransitMeta['lineType']): RouteLeg => ({
  start: P, end: P, mode: 'transit', durationSec: 600, distanceM: 1, coords: [],
  transit: { lineName: lineType, lineType },
});
const route = (totalMin: number, legs: RouteLeg[]): Route => ({ legs, totalDurationSec: totalMin * 60, totalDistanceM: 1 });

// A: 40분·환승1·도보10 (지하철만) / B: 30분·환승2·도보5 (혼합) / C: 50분·환승0·도보2 (버스만)
const A = route(40, [walk(10), ride('subway'), ride('subway')]);
const B = route(30, [walk(5), ride('subway'), ride('bus'), ride('bus')]);
const C = route(50, [walk(2), ride('bus')]);
const ALL = [A, B, C];

describe('arrangeRoutes', () => {
  it('최소시간', () => expect(arrangeRoutes(ALL, 'time', 'all')).toEqual([B, A, C]));
  it('최소환승', () => expect(arrangeRoutes(ALL, 'transfers', 'all')).toEqual([C, A, B]));
  it('최소도보', () => expect(arrangeRoutes(ALL, 'walk', 'all')).toEqual([C, B, A]));
  it('지하철만 — 대중교통 leg 전부 지하철', () => expect(arrangeRoutes(ALL, 'time', 'subway')).toEqual([A]));
  it('버스만 — 대중교통 leg 전부 버스', () => expect(arrangeRoutes(ALL, 'time', 'bus')).toEqual([C]));
  it('대중교통 없는 경로는 노선 필터에서 빠진다', () => {
    expect(arrangeRoutes([route(10, [walk(10)])], 'time', 'subway')).toEqual([]);
  });
  it('동률은 원래 순서 유지, 입력 배열 불변', () => {
    const D = route(40, [walk(10), ride('bus')]);
    const input = [A, D];
    expect(arrangeRoutes(input, 'time', 'all')).toEqual([A, D]);
    expect(input).toEqual([A, D]);
  });
});
