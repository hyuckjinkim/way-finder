import { describe, it, expect } from 'vitest';
import { parsePlaceHint, placeFitBounds, placeHref } from './placeUrl.js';

describe('placeHref ↔ parsePlaceHint', () => {
  const place = { id: 'kakao-addr:127.1,37.5', name: '강남역 2호선 & 신분당선', coord: { lat: 37.4979, lng: 127.0276 } };

  it('id·이름·좌표를 URL에 싣고 그대로 복원한다', () => {
    const href = placeHref(place);
    expect(href.startsWith(`/place/${encodeURIComponent(place.id)}?`)).toBe(true);
    const params = Object.fromEntries(new URL(href, 'http://x').searchParams);
    expect(parsePlaceHint(params)).toEqual({ name: place.name, coord: place.coord });
  });

  it.each([
    [{}],
    [{ name: 'a', lat: '37' }],
    [{ name: 'a', lat: 'x', lng: '127' }],
    [{ name: 'a', lat: '91', lng: '127' }],
  ])('불완전·비정상 파라미터는 undefined (%j)', (p) => expect(parsePlaceHint(p)).toBeUndefined());

  it('배열 파라미터는 첫 값을 쓴다', () => {
    expect(parsePlaceHint({ name: ['a', 'b'], lat: ['37'], lng: '127' })).toEqual({ name: 'a', coord: { lat: 37, lng: 127 } });
  });
});

describe('placeFitBounds', () => {
  it('좌표를 중심에 둔 0이 아닌 크기의 사각형', () => {
    const b = placeFitBounds({ lat: 37.5, lng: 127 });
    expect(b.sw.lat).toBeLessThan(37.5);
    expect(b.ne.lat).toBeGreaterThan(37.5);
    expect(b.sw.lng).toBeLessThan(127);
    expect(b.ne.lng).toBeGreaterThan(127);
    expect((b.ne.lat + b.sw.lat) / 2).toBeCloseTo(37.5, 6);
  });
});
