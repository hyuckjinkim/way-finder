import { describe, it, expect, vi } from 'vitest';
import { canCopyText, copyText, routeInputHref, telUrl } from './placeActions.js';
import { parseRouteParams } from '../route/routeUrl.js';

describe('telUrl', () => {
  it.each([
    ['02-123-4567', 'tel:021234567'],
    ['+82 2 123 4567', 'tel:+8221234567'],
    ['(031) 555-0100', 'tel:0315550100'],
  ])('%s → %s', (raw, out) => expect(telUrl(raw)).toBe(out));
  it('번호가 없으면 undefined', () => expect(telUrl(' - ')).toBeUndefined());
});

describe('routeInputHref', () => {
  const place = { name: '강남역', coord: { lat: 37.4979, lng: 127.0276 } };
  it.each(['origin', 'destination'] as const)('%s가 채워진 /route/input 링크를 만든다', (role) => {
    const href = routeInputHref(role, place);
    expect(href.startsWith('/route/input?')).toBe(true);
    const params = Object.fromEntries(new URL(href, 'http://x').searchParams);
    expect(parseRouteParams(params)[role]).toEqual({ label: '강남역', coord: place.coord });
  });
});

describe('copyText', () => {
  it('clipboard가 있으면 복사하고 true', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    const nav = { clipboard: { writeText } } as unknown as Navigator;
    expect(await copyText('서울', nav)).toBe(true);
    expect(writeText).toHaveBeenCalledWith('서울');
  });
  it('clipboard가 없거나 거부되면 false', async () => {
    expect(canCopyText({} as Navigator)).toBe(false);
    expect(await copyText('서울', {} as Navigator)).toBe(false);
    const nav = { clipboard: { writeText: vi.fn().mockRejectedValue(new Error('denied')) } } as unknown as Navigator;
    expect(await copyText('서울', nav)).toBe(false);
  });
});
