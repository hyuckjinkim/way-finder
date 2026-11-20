import { describe, expect, it } from 'vitest';
import { parseRouteParams, routeQuery } from './routeUrl.js';

const params = (q: string) => Object.fromEntries(new URLSearchParams(q.slice(1)));

describe('routeUrl', () => {
  it('왕복: 이름에 쉼표가 있어도 복원된다', () => {
    const state = {
      origin: { label: '내 위치', coord: { lat: 37.4849, lng: 126.8963 } },
      destination: { label: '스타벅스 강남, 2층', coord: { lat: 37.498, lng: 127.028 } },
      waypoints: [{ label: '사당역', coord: { lat: 37.476, lng: 126.981 } }],
      mode: 'transit' as const,
    };
    expect(parseRouteParams(params(routeQuery(state)))).toEqual(state);
  });

  it('선호·예산(pref·max)도 왕복된다', () => {
    const state = {
      origin: { label: 'A', coord: { lat: 37.5, lng: 127 } },
      destination: { label: 'B', coord: { lat: 37.51, lng: 127.01 } },
      mode: 'walk' as const,
      preference: 'quiet' as const,
      maxExtraMinutes: 10,
    };
    expect(parseRouteParams(params(routeQuery(state)))).toEqual(state);
  });

  it('잘못된 pref·max는 버린다(범위 밖·소수·0)', () => {
    for (const max of ['0', '31', '2.5', 'x', '-3']) {
      expect(parseRouteParams({ pref: 'fly', max }).maxExtraMinutes).toBeUndefined();
    }
    expect(parseRouteParams({ pref: 'fly' }).preference).toBeUndefined();
  });

  it('잘못된 좌표·모드는 버린다', () => {
    expect(parseRouteParams({ o: 'abc,1,x', d: '91,0,y', mode: 'plane' })).toEqual({
      origin: undefined,
      destination: undefined,
      waypoints: undefined,
      mode: undefined,
    });
  });
});
