/**
 * C1 — 합성 LocationProvider 단위 테스트.
 *
 * 검증: (1) 즉시(cadence≤0) 방출 — 전 시퀀스 동기 방출, (2) cadence 방출 —
 * fake timers로 틱마다 1개씩 순서대로, (3) 해지 — 해지 후 cb 미호출.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { LocationSample } from '@wayfinder/shared';
import { createSyntheticLocationProvider } from './locationProvider.js';

function sample(i: number): LocationSample {
  return { coord: { lat: 37.5 + i * 0.001, lng: 126.9 }, timestampMs: 1000 + i };
}

const SEQ: readonly LocationSample[] = [sample(0), sample(1), sample(2)];

describe('createSyntheticLocationProvider — 즉시 방출(cadence≤0)', () => {
  it('watch 호출 시 전 시퀀스를 순서대로 동기 방출한다', () => {
    const provider = createSyntheticLocationProvider(SEQ, 0);
    const received: LocationSample[] = [];

    provider.watch((s) => received.push(s));

    expect(received).toEqual(SEQ);
  });
});

describe('createSyntheticLocationProvider — cadence 방출', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('cadence(ms)마다 1개씩 순서대로 방출한다', () => {
    const provider = createSyntheticLocationProvider(SEQ, 1000);
    const received: LocationSample[] = [];

    provider.watch((s) => received.push(s));

    expect(received).toHaveLength(0); // 즉시 방출 없음
    vi.advanceTimersByTime(1000);
    expect(received).toEqual([SEQ[0]]);
    vi.advanceTimersByTime(2000);
    expect(received).toEqual(SEQ);
  });

  it('해지 후에는 cb를 호출하지 않는다', () => {
    const provider = createSyntheticLocationProvider(SEQ, 1000);
    const cb = vi.fn();

    const unwatch = provider.watch(cb);
    vi.advanceTimersByTime(1000);
    expect(cb).toHaveBeenCalledTimes(1);

    unwatch();
    vi.advanceTimersByTime(5000);
    expect(cb).toHaveBeenCalledTimes(1); // 해지 이후 추가 호출 없음
  });
});
