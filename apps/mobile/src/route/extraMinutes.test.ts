/**
 * B2 — "+N분" 슬라이더 순수 로직 단위 테스트.
 */
import { describe, it, expect } from 'vitest';
import {
  MIN_EXTRA_MINUTES,
  MAX_EXTRA_MINUTES,
  DEFAULT_EXTRA_MINUTES,
  clampExtraMinutes,
  ratioToExtraMinutes,
  extraMinutesToRatio,
  toRouteExtraMinutes,
} from './extraMinutes.js';

describe('상수 — @wayfinder/shared 단일 진실 소스', () => {
  it('MIN_EXTRA_MINUTES는 0이다', () => {
    expect(MIN_EXTRA_MINUTES).toBe(0);
  });

  it('MAX_EXTRA_MINUTES는 30이다', () => {
    expect(MAX_EXTRA_MINUTES).toBe(30);
  });

  it('DEFAULT_EXTRA_MINUTES는 MIN~MAX 범위 내다', () => {
    expect(DEFAULT_EXTRA_MINUTES).toBeGreaterThanOrEqual(MIN_EXTRA_MINUTES);
    expect(DEFAULT_EXTRA_MINUTES).toBeLessThanOrEqual(MAX_EXTRA_MINUTES);
  });
});

describe('clampExtraMinutes', () => {
  it('범위 내 값을 그대로 반환한다', () => {
    expect(clampExtraMinutes(10)).toBe(10);
    expect(clampExtraMinutes(0)).toBe(0);
    expect(clampExtraMinutes(30)).toBe(30);
  });

  it('MIN 미만 값을 MIN으로 클램프한다', () => {
    expect(clampExtraMinutes(-5)).toBe(MIN_EXTRA_MINUTES);
    expect(clampExtraMinutes(-100)).toBe(MIN_EXTRA_MINUTES);
  });

  it('MAX 초과 값을 MAX로 클램프한다', () => {
    expect(clampExtraMinutes(31)).toBe(MAX_EXTRA_MINUTES);
    expect(clampExtraMinutes(100)).toBe(MAX_EXTRA_MINUTES);
  });

  it('소수점 값을 반올림한다', () => {
    expect(clampExtraMinutes(10.4)).toBe(10);
    expect(clampExtraMinutes(10.5)).toBe(11);
    expect(clampExtraMinutes(10.6)).toBe(11);
  });

  it('기본값은 클램프 후에도 동일하다', () => {
    expect(clampExtraMinutes(DEFAULT_EXTRA_MINUTES)).toBe(DEFAULT_EXTRA_MINUTES);
  });
});

describe('ratioToExtraMinutes', () => {
  it('ratio=0은 MIN을 반환한다', () => {
    expect(ratioToExtraMinutes(0)).toBe(MIN_EXTRA_MINUTES);
  });

  it('ratio=1은 MAX를 반환한다', () => {
    expect(ratioToExtraMinutes(1)).toBe(MAX_EXTRA_MINUTES);
  });

  it('ratio=0.5는 중간값을 반환한다', () => {
    const mid = Math.round((MAX_EXTRA_MINUTES - MIN_EXTRA_MINUTES) / 2 + MIN_EXTRA_MINUTES);
    expect(ratioToExtraMinutes(0.5)).toBe(mid);
  });

  it('범위 밖 ratio도 클램프된다', () => {
    expect(ratioToExtraMinutes(-0.5)).toBe(MIN_EXTRA_MINUTES);
    expect(ratioToExtraMinutes(1.5)).toBe(MAX_EXTRA_MINUTES);
  });
});

describe('extraMinutesToRatio', () => {
  it('MIN은 0을 반환한다', () => {
    expect(extraMinutesToRatio(MIN_EXTRA_MINUTES)).toBe(0);
  });

  it('MAX는 1을 반환한다', () => {
    expect(extraMinutesToRatio(MAX_EXTRA_MINUTES)).toBe(1);
  });

  it('중간값은 0.5 근처를 반환한다', () => {
    const mid = (MAX_EXTRA_MINUTES - MIN_EXTRA_MINUTES) / 2 + MIN_EXTRA_MINUTES;
    const ratio = extraMinutesToRatio(Math.round(mid));
    expect(ratio).toBeCloseTo(0.5, 1);
  });

  it('ratioToExtraMinutes와 역함수 관계다', () => {
    const minutes = 15;
    const ratio = extraMinutesToRatio(minutes);
    expect(ratioToExtraMinutes(ratio)).toBe(minutes);
  });
});

describe('toRouteExtraMinutes', () => {
  it('MIN(0)은 undefined를 반환한다(무제한)', () => {
    expect(toRouteExtraMinutes(MIN_EXTRA_MINUTES)).toBeUndefined();
  });

  it('MIN 초과 값은 숫자를 반환한다', () => {
    expect(toRouteExtraMinutes(10)).toBe(10);
    expect(toRouteExtraMinutes(MAX_EXTRA_MINUTES)).toBe(MAX_EXTRA_MINUTES);
  });

  it('MAX 초과 값은 MAX로 클램프 후 반환한다', () => {
    expect(toRouteExtraMinutes(100)).toBe(MAX_EXTRA_MINUTES);
  });

  it('기본값은 MIN 초과이므로 정상 숫자를 반환한다', () => {
    // DEFAULT_EXTRA_MINUTES(10) > MIN_EXTRA_MINUTES(0) — 항상 숫자 반환
    expect(toRouteExtraMinutes(DEFAULT_EXTRA_MINUTES)).toBe(DEFAULT_EXTRA_MINUTES);
  });
});
