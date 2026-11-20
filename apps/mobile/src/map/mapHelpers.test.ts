import { describe, expect, it } from 'vitest';
import {
  approxZoomForBounds,
  boundsMoved,
  fitKey,
  markerHtml,
  markerSpec,
  normalizeInsets,
  polylineStyle,
  withUserMarker,
} from './mapHelpers.js';

const bounds = { sw: { lat: 37.4, lng: 126.9 }, ne: { lat: 37.6, lng: 127.1 } };

describe('normalizeInsets', () => {
  it('expands a number to uniform insets', () => {
    expect(normalizeInsets(10)).toEqual({ top: 10, right: 10, bottom: 10, left: 10 });
  });
  it('keeps explicit insets and defaults to 40', () => {
    expect(normalizeInsets({ top: 1, right: 2, bottom: 3, left: 4 })).toEqual({ top: 1, right: 2, bottom: 3, left: 4 });
    expect(normalizeInsets()).toEqual({ top: 40, right: 40, bottom: 40, left: 40 });
  });
});

describe('fitKey', () => {
  it('is empty without fitTo and equal for equal values', () => {
    expect(fitKey()).toBe('');
    expect(fitKey({ bounds, padding: 10 })).toBe(fitKey({ bounds: structuredClone(bounds), padding: 10 }));
  });
  it('changes when bounds or padding change', () => {
    const base = fitKey({ bounds, padding: 10 });
    expect(fitKey({ bounds, padding: 11 })).not.toBe(base);
    expect(fitKey({ bounds: { ...bounds, ne: { lat: 38, lng: 127.1 } }, padding: 10 })).not.toBe(base);
  });
});

describe('withUserMarker', () => {
  it('appends a user marker for userLocation', () => {
    const out = withUserMarker([{ id: 'a', coord: { lat: 1, lng: 2 } }], { lat: 3, lng: 4 });
    expect(out).toHaveLength(2);
    expect(out[1]).toMatchObject({ kind: 'user', coord: { lat: 3, lng: 4 } });
  });
  it('returns markers untouched without userLocation', () => {
    expect(withUserMarker(undefined)).toEqual([]);
  });
});

describe('markerSpec / markerHtml', () => {
  it('place and undefined use the default pin', () => {
    expect(markerSpec('place')).toBeNull();
    expect(markerSpec(undefined)).toBeNull();
  });
  it('origin/destination carry labels', () => {
    expect(markerSpec('origin')?.label).toBe('출');
    expect(markerSpec('destination')?.label).toBe('도');
  });
  it('transfer uses color as border, user has halo', () => {
    expect(markerSpec('transfer', '#ff0000')?.borderColor).toBe('#ff0000');
    expect(markerSpec('user')?.halo).toBe(true);
  });
  it('strips unsafe characters from css colors', () => {
    const html = markerHtml(markerSpec('transfer', 'red;"><script>')!);
    expect(html).not.toContain('<script>');
    expect(html).not.toContain('red;');
  });
});

describe('polylineStyle', () => {
  it('applies defaults and a wider outline', () => {
    const st = polylineStyle({ id: 'p', coords: [] });
    expect(st).toMatchObject({ width: 5, outlineWidth: 8, dashed: false });
  });
  it('honors width/color/dashed', () => {
    expect(polylineStyle({ id: 'p', coords: [], width: 3, color: '#0f0', dashed: true })).toMatchObject({
      width: 3, outlineWidth: 6, color: '#0f0', dashed: true,
    });
  });
});

describe('approxZoomForBounds', () => {
  it('zooms in for smaller boxes and clamps', () => {
    const small = approxZoomForBounds({ sw: { lat: 0, lng: 0 }, ne: { lat: 0.01, lng: 0.01 } });
    expect(small).toBeGreaterThan(approxZoomForBounds(bounds));
    expect(approxZoomForBounds({ sw: { lat: 0, lng: 0 }, ne: { lat: 0, lng: 0 } })).toBe(19);
    expect(approxZoomForBounds({ sw: { lat: -80, lng: -170 }, ne: { lat: 80, lng: 170 } })).toBeGreaterThanOrEqual(1);
  });
});

describe('boundsMoved', () => {
  const searched = { sw: { lat: 37.5, lng: 127.0 }, ne: { lat: 37.6, lng: 127.1 } };
  it('지도 높이만 줄면(폰 목록) 움직인 게 아니다', () => {
    expect(boundsMoved(searched, { sw: { lat: 37.53, lng: 127.0 }, ne: { lat: 37.6, lng: 127.1 } })).toBe(false);
  });
  it('1/4 이상 옮기거나 줌을 바꾸면 움직였다', () => {
    expect(boundsMoved(searched, { sw: { lat: 37.5, lng: 127.03 }, ne: { lat: 37.6, lng: 127.13 } })).toBe(true);
    expect(boundsMoved(searched, { sw: { lat: 37.525, lng: 127.025 }, ne: { lat: 37.575, lng: 127.075 } })).toBe(true);
  });
});
