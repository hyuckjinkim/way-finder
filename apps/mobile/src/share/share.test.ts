import { describe, it, expect, vi } from 'vitest';
import { buildPlaceShare, canShare, sharePlace } from './share.js';
import { parsePlaceHint } from '../search/placeUrl.js';

const place = { id: 'google:ChIJ', name: '카페 & 빵', coord: { lat: 37.5, lng: 127.03 }, address: '서울 강남구' };
const payload = buildPlaceShare(place, 'https://wayfinder.test');

describe('buildPlaceShare', () => {
  it('현재 origin + 힌트 실은 장소 URL — 링크만으로 바로 열린다', () => {
    const url = new URL(payload.url);
    expect(url.origin).toBe('https://wayfinder.test');
    expect(url.pathname).toBe('/place/google%3AChIJ');
    expect(parsePlaceHint(Object.fromEntries(url.searchParams))).toEqual({ name: place.name, coord: place.coord });
  });
  it('제목은 이름, 본문은 이름 · 주소(주소 없으면 이름만)', () => {
    expect(payload.title).toBe('카페 & 빵');
    expect(payload.text).toBe('카페 & 빵 · 서울 강남구');
    expect(buildPlaceShare({ ...place, address: '' }, '').text).toBe('카페 & 빵');
  });
});

describe('sharePlace', () => {
  const clipboard = () => ({ writeText: vi.fn().mockResolvedValue(undefined) });

  it('navigator.share가 있으면 공유 시트', async () => {
    const nav = { share: vi.fn().mockResolvedValue(undefined), clipboard: clipboard() };
    expect(await sharePlace(payload, nav)).toBe('shared');
    expect(nav.share).toHaveBeenCalledWith(payload);
    expect(nav.clipboard.writeText).not.toHaveBeenCalled();
  });
  it('사용자가 공유 시트를 닫으면(AbortError) 복사하지 않는다', async () => {
    const nav = { share: vi.fn().mockRejectedValue(Object.assign(new Error('x'), { name: 'AbortError' })), clipboard: clipboard() };
    expect(await sharePlace(payload, nav)).toBe('cancelled');
    expect(nav.clipboard.writeText).not.toHaveBeenCalled();
  });
  it('공유가 실패하거나 없으면 링크 복사', async () => {
    const failing = { share: vi.fn().mockRejectedValue(new Error('NotAllowed')), clipboard: clipboard() };
    expect(await sharePlace(payload, failing)).toBe('copied');
    expect(failing.clipboard.writeText).toHaveBeenCalledWith(payload.url);
    expect(await sharePlace(payload, { clipboard: clipboard() })).toBe('copied');
  });
  it('둘 다 없으면 failed, 버튼도 숨김 대상', async () => {
    expect(await sharePlace(payload, {})).toBe('failed');
    expect(canShare({})).toBe(false);
    expect(canShare(undefined)).toBe(false);
    expect(canShare({ clipboard: clipboard() })).toBe(true);
  });
});
