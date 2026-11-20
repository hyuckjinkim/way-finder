import { describe, it, expect, vi } from 'vitest';
import { kstDate, reserveDaily, reserveKakaoTransit, KAKAO_TRANSIT_DAILY_CAP } from './transitQuota.js';
import { fakeQuotaNamespace } from '../fixtures/kakaoTransit.js';

function mapStorage() {
  const m = new Map<string, unknown>();
  return {
    m,
    get: async <T>(k: string) => m.get(k) as T | undefined,
    put: async <T>(k: string, v: T) => void m.set(k, v),
  };
}

describe('kstDate', () => {
  it('UTC 14:59 → 같은 날, 15:00 → KST 다음 날', () => {
    expect(kstDate(Date.UTC(2026, 10, 20, 14, 59))).toBe('2026-11-20');
    expect(kstDate(Date.UTC(2026, 10, 20, 15, 0))).toBe('2026-11-21');
  });
});

describe('reserveDaily', () => {
  it('상한까지 예약되고 상한에서 차단', async () => {
    const s = mapStorage();
    for (let i = 0; i < 3; i++) expect(await reserveDaily(s, 'd', 1, 3)).toBe(true);
    expect(await reserveDaily(s, 'd', 1, 3)).toBe(false);
  });

  it('n건은 전부 또는 0 — 넘치면 아무것도 소비하지 않음', async () => {
    const s = mapStorage();
    expect(await reserveDaily(s, 'd', 2, 3)).toBe(true);
    expect(await reserveDaily(s, 'd', 2, 3)).toBe(false);
    expect(await reserveDaily(s, 'd', 1, 3)).toBe(true);
  });

  it('날짜가 바뀌면 0부터', async () => {
    const s = mapStorage();
    expect(await reserveDaily(s, 'd1', 3, 3)).toBe(true);
    expect(await reserveDaily(s, 'd1', 1, 3)).toBe(false);
    expect(await reserveDaily(s, 'd2', 1, 3)).toBe(true);
  });

  it('기본 상한은 950', async () => {
    const s = mapStorage();
    expect(await reserveDaily(s, 'd', KAKAO_TRANSIT_DAILY_CAP)).toBe(true);
    expect(await reserveDaily(s, 'd', 1)).toBe(false);
  });
});

describe('reserveKakaoTransit (DO 경유)', () => {
  it('DO 클래스로 예약 — KST 자정 넘으면 리셋', async () => {
    let now = Date.UTC(2026, 10, 20, 14, 0);
    const storage = new Map<string, unknown>([['usage', { date: '2026-11-20', count: KAKAO_TRANSIT_DAILY_CAP }]]);
    const ns = fakeQuotaNamespace(storage, () => now);
    expect(await reserveKakaoTransit(ns, 1)).toBe(false);
    now = Date.UTC(2026, 10, 20, 15, 0);
    expect(await reserveKakaoTransit(ns, 1)).toBe(true);
  });

  it('바인딩 없음 → 차단(fail-closed)', async () => {
    expect(await reserveKakaoTransit(undefined, 1)).toBe(false);
  });

  it('DO 오류 → 차단(fail-closed)', async () => {
    const err = vi.spyOn(console, 'error').mockImplementation(() => {});
    const ns = {
      idFromName: () => ({}),
      get: () => ({ fetch: async () => { throw new Error('down'); } }),
    } as unknown as DurableObjectNamespace;
    expect(await reserveKakaoTransit(ns, 1)).toBe(false);
    err.mockRestore();
  });
});
