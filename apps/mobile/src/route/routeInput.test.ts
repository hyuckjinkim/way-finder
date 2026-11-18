import { describe, it, expect } from 'vitest';
import { resolveRouteInput } from './routeInput.js';
import { parseRouteParams, routeQuery } from './routeUrl.js';

const A = { label: 'A', coord: { lat: 37.5, lng: 127.0 } };
const B = { label: 'B', coord: { lat: 37.6, lng: 127.1 } };
const W = { label: 'W', coord: { lat: 37.55, lng: 127.05 } };
const store = { stops: [], mode: 'transit' as const };

describe('resolveRouteInput', () => {
  it('URL이 있으면 URL 우선 (새로고침/공유 링크)', () => {
    const url = parseRouteParams(Object.fromEntries(new URLSearchParams(routeQuery({ origin: A, destination: B, waypoints: [W], mode: 'walk' }))));
    expect(resolveRouteInput(url, store)).toEqual({ stops: [A.coord, W.coord, B.coord], mode: 'walk' });
  });
  it('URL mode 없으면 스토어 mode', () => {
    expect(resolveRouteInput({ origin: A, destination: B }, { ...store, mode: 'car' })?.mode).toBe('car');
  });
  it('URL 없으면 스토어 폴백', () => {
    expect(resolveRouteInput({}, { stops: [A.coord, B.coord], mode: 'walk' })).toEqual({ stops: [A.coord, B.coord], mode: 'walk' });
  });
  it('둘 다 없으면 null', () => {
    expect(resolveRouteInput({}, store)).toBeNull();
    expect(resolveRouteInput({ origin: A }, store)).toBeNull();
  });
});
