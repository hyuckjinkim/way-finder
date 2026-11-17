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

  it('잘못된 좌표·모드는 버린다', () => {
    expect(parseRouteParams({ o: 'abc,1,x', d: '91,0,y', mode: 'plane' })).toEqual({
      origin: undefined,
      destination: undefined,
      waypoints: undefined,
      mode: undefined,
    });
  });
});
