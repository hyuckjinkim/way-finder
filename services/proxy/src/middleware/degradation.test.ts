/**
 * A4 — graceful degradation 단위 테스트.
 * fetchWithFallback: 성공/실패/에러 로깅 검증.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { fetchWithFallback } from './degradation.js';

describe('fetchWithFallback', () => {
  beforeEach(() => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('성공 시 fn의 반환값을 그대로 반환한다', async () => {
    const result = await fetchWithFallback(
      async () => [{ id: 'google:123' }],
      [],
      'test',
    );
    expect(result).toEqual([{ id: 'google:123' }]);
  });

  it('fn이 throw하면 fallback 값을 반환한다', async () => {
    const result = await fetchWithFallback(
      async () => { throw new Error('network error'); },
      [] as unknown[],
      'test',
    );
    expect(result).toEqual([]);
  });

  it('fn이 throw하면 console.error로 에러를 로깅한다 (silent failure 금지)', async () => {
    await fetchWithFallback(
      async () => { throw new Error('google down'); },
      null,
      'google-reviews',
    );
    expect(console.error).toHaveBeenCalledWith(
      expect.stringContaining('google-reviews'),
      expect.any(Error),
    );
  });

  it('fn이 reject Promise여도 fallback 반환', async () => {
    const result = await fetchWithFallback(
      () => Promise.reject(new Error('timeout')),
      'default',
      'test-label',
    );
    expect(result).toBe('default');
  });
});
