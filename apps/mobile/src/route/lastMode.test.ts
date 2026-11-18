import { describe, it, expect, afterEach } from 'vitest';
import { loadLastMode, saveLastMode } from './lastMode.js';

const setStorage = (v: unknown): void => {
  (globalThis as { localStorage?: unknown }).localStorage = v;
};

describe('lastMode', () => {
  afterEach(() => setStorage(undefined));

  it('저장한 모드를 복원', () => {
    const m = new Map<string, string>();
    setStorage({ getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => m.set(k, v) });
    saveLastMode('bike');
    expect(loadLastMode()).toBe('bike');
  });

  it('유효하지 않은 값은 무시', () => {
    setStorage({ getItem: () => 'plane', setItem: () => {} });
    expect(loadLastMode()).toBeUndefined();
  });

  it('localStorage가 없거나 던져도 throw 없음', () => {
    expect(loadLastMode()).toBeUndefined();
    expect(() => saveLastMode('walk')).not.toThrow();
    const boom = () => {
      throw new Error('denied');
    };
    setStorage({ getItem: boom, setItem: boom });
    expect(loadLastMode()).toBeUndefined();
    expect(() => saveLastMode('walk')).not.toThrow();
  });
});
