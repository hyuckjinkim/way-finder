import { describe, it, expect } from 'vitest';
import { createRecentStore, MAX_RECENT, pushRecent, removeRecent, RECENT_KEY } from './recentSearches.js';

describe('pushRecent / removeRecent', () => {
  it('최신순으로 앞에 추가하고 중복은 끌어올린다', () => {
    expect(pushRecent(['b', 'a'], 'a')).toEqual(['a', 'b']);
  });
  it('공백만 있는 검색어는 무시', () => {
    expect(pushRecent(['a'], '  ')).toEqual(['a']);
  });
  it('최대 10개까지만 보관', () => {
    const full = Array.from({ length: MAX_RECENT }, (_, i) => `q${i}`);
    const next = pushRecent(full, 'new');
    expect(next).toHaveLength(MAX_RECENT);
    expect(next[0]).toBe('new');
    expect(next).not.toContain(`q${MAX_RECENT - 1}`);
  });
  it('삭제', () => expect(removeRecent(['a', 'b'], 'a')).toEqual(['b']));
});

describe('createRecentStore', () => {
  it('storage에 저장하고 다시 읽는다', () => {
    const data = new Map<string, string>();
    const storage = { getItem: (k: string) => data.get(k) ?? null, setItem: (k: string, v: string) => void data.set(k, v) };
    createRecentStore(() => storage).save(['강남역']);
    expect(data.get(RECENT_KEY)).toBe('["강남역"]');
    expect(createRecentStore(() => storage).load()).toEqual(['강남역']);
  });
  it('storage가 없으면 메모리에 보관', () => {
    const s = createRecentStore(() => undefined);
    s.save(['a']);
    expect(s.load()).toEqual(['a']);
  });
  it('storage가 throw해도(차단) 메모리로 동작', () => {
    const boom = () => {
      throw new Error('blocked');
    };
    const s = createRecentStore(() => ({ getItem: boom, setItem: boom }));
    s.save(['a']);
    expect(s.load()).toEqual(['a']);
  });
  it('깨진 JSON은 빈 목록', () => {
    const s = createRecentStore(() => ({ getItem: () => '{oops', setItem: () => {} }));
    expect(s.load()).toEqual([]);
  });
});
