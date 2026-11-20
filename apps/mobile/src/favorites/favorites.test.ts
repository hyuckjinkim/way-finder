import { describe, it, expect, vi } from 'vitest';
import type { Place } from '@wayfinder/shared';
import {
  addFavorite,
  createFavoriteStore,
  FAVORITES_KEY,
  isFavorite,
  MAX_FAVORITES,
  removeFavorite,
  toggleFavorite,
  type SavedPlace,
} from './favorites.js';
import { parsePlaceHint, placeHref } from '../search/placeUrl.js';

const place = (id: string, extra: Partial<Place> = {}): Place => ({
  id,
  name: `장소 ${id}`,
  coord: { lat: 37.5, lng: 127 },
  category: '카페',
  address: '서울 강남구',
  ...extra,
});

describe('addFavorite / removeFavorite / toggleFavorite', () => {
  it('최신순으로 앞에 추가하고 같은 id는 끌어올린다(중복 없음)', () => {
    const list = addFavorite(addFavorite([], place('a'), 1), place('b'), 2);
    const next = addFavorite(list, place('a'), 3);
    expect(next.map((p) => p.id)).toEqual(['a', 'b']);
    expect(next[0]!.savedAt).toBe(3);
  });
  it('필요한 필드만 담는다 — 상세(리뷰·블로그·전화)는 저장하지 않는다', () => {
    const detail = { ...place('k'), phone: '02-1', reviews: [], blogs: { naver: [], kakao: [] } } as Place;
    expect(Object.keys(addFavorite([], detail, 1)[0]!).sort()).toEqual(
      ['address', 'category', 'coord', 'id', 'name', 'savedAt'],
    );
  });
  it(`최대 ${MAX_FAVORITES}개까지만 — 가장 오래된 것부터 밀려난다`, () => {
    let list: SavedPlace[] = [];
    for (let i = 0; i < MAX_FAVORITES; i++) list = addFavorite(list, place(`p${i}`), i);
    const next = addFavorite(list, place('new'), 999);
    expect(next).toHaveLength(MAX_FAVORITES);
    expect(next[0]!.id).toBe('new');
    expect(isFavorite(next, 'p0')).toBe(false);
  });
  it('삭제', () => expect(removeFavorite(addFavorite([], place('a')), 'a')).toEqual([]));
  it('토글은 저장 ↔ 해제', () => {
    const on = toggleFavorite([], place('a'), 1);
    expect(isFavorite(on, 'a')).toBe(true);
    expect(toggleFavorite(on, place('a'))).toEqual([]);
  });
  it('저장 항목의 링크는 항상 힌트를 실어 다시 열린다', () => {
    const saved = addFavorite([], place('google:ChIJ', { name: '카페 & 빵' }), 1)[0]!;
    const url = new URL(placeHref(saved), 'https://x.test');
    expect(parsePlaceHint(Object.fromEntries(url.searchParams))).toEqual({ name: saved.name, coord: saved.coord });
  });
});

describe('createFavoriteStore', () => {
  const memStorage = (init?: string) => {
    const data = new Map<string, string>(init === undefined ? [] : [[FAVORITES_KEY, init]]);
    return { data, storage: { getItem: (k: string) => data.get(k) ?? null, setItem: (k: string, v: string) => void data.set(k, v) } };
  };

  it('storage에 저장하고 새 스토어가 다시 읽는다', () => {
    const { data, storage } = memStorage();
    const list = addFavorite([], place('a'), 1);
    createFavoriteStore(() => storage).save(list);
    expect(JSON.parse(data.get(FAVORITES_KEY)!)).toEqual(list);
    expect(createFavoriteStore(() => storage).load()).toEqual(list);
  });
  it('save 전까지 load는 같은 참조, save하면 구독자에게 알린다', () => {
    const s = createFavoriteStore(() => memStorage().storage);
    const listener = vi.fn();
    const unsubscribe = s.subscribe(listener);
    expect(s.load()).toBe(s.load());
    s.save(addFavorite([], place('a')));
    expect(listener).toHaveBeenCalledTimes(1);
    unsubscribe();
    s.save([]);
    expect(listener).toHaveBeenCalledTimes(1);
  });
  it('storage가 없거나 throw하면(차단) 메모리로 동작', () => {
    const boom = () => {
      throw new Error('blocked');
    };
    for (const s of [createFavoriteStore(() => undefined), createFavoriteStore(() => ({ getItem: boom, setItem: boom }))]) {
      s.save(addFavorite([], place('a')));
      expect(isFavorite(s.load(), 'a')).toBe(true);
    }
  });
  it('깨진 JSON·배열 아님은 빈 목록', () => {
    expect(createFavoriteStore(() => memStorage('{oops').storage).load()).toEqual([]);
    expect(createFavoriteStore(() => memStorage('{"a":1}').storage).load()).toEqual([]);
  });
  it('힌트(이름·좌표)가 깨진 항목은 버리고 나머지는 살린다', () => {
    const good = addFavorite([], place('ok'), 5)[0]!;
    const raw = JSON.stringify([
      null,
      { id: 'x', name: '', coord: { lat: 37, lng: 127 } },
      { id: 'y', name: 'y', coord: { lat: 'NaN', lng: 127 } },
      { id: 'z', name: 'z' },
      { id: 'w', name: 'w', coord: { lat: 95, lng: 127 } },
      good,
      { id: 'n', name: 'n', coord: { lat: 1, lng: 2 } },
    ]);
    expect(createFavoriteStore(() => memStorage(raw).storage).load()).toEqual([
      good,
      { id: 'n', name: 'n', coord: { lat: 1, lng: 2 }, category: '', address: '', savedAt: 0 },
    ]);
  });
});
