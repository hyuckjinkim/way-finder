/**
 * A3 — 네비 진행률 단위 테스트. F3 on-route 시퀀스로 진행 단조성·경계 검증.
 */
import { describe, it, expect } from 'vitest';
import type { Route } from '@wayfinder/shared';
import { REFERENCE_PATH, DESTINATION, ON_ROUTE_SEQUENCE } from './fixtures/gpsSequences.js';
import { computeProgress } from './navProgress.js';

const ROUTE: Route = {
  legs: [
    {
      start: REFERENCE_PATH[0]!,
      end: DESTINATION,
      mode: 'walk',
      durationSec: 900,
      distanceM: 1100,
      coords: [...REFERENCE_PATH],
    },
  ],
  totalDurationSec: 900,
  totalDistanceM: 1100,
};

describe('computeProgress — on-route 진행 (F3 시퀀스)', () => {
  it('출발점은 fraction≈0·남은 거리≈전체', () => {
    const r = computeProgress(ROUTE, REFERENCE_PATH[0]!);
    expect(r.progress.fraction).toBeLessThan(0.01);
    expect(r.durationRemainingSec).toBeCloseTo(900, -1);
  });

  it('목적지는 fraction≈1·남은 거리≈0·남은 시간≈0', () => {
    const r = computeProgress(ROUTE, DESTINATION);
    expect(r.progress.fraction).toBeGreaterThan(0.99);
    expect(r.distanceRemainingM).toBeLessThan(1);
    expect(r.durationRemainingSec).toBe(0);
  });

  it('진행에 따라 fraction 단조 증가·남은 거리 단조 감소', () => {
    const fractions: number[] = [];
    const remaining: number[] = [];
    for (const s of ON_ROUTE_SEQUENCE) {
      const r = computeProgress(ROUTE, s.coord);
      fractions.push(r.progress.fraction);
      remaining.push(r.distanceRemainingM);
    }
    for (let i = 1; i < fractions.length; i++) {
      expect(fractions[i]!).toBeGreaterThanOrEqual(fractions[i - 1]! - 1e-9);
      expect(remaining[i]!).toBeLessThanOrEqual(remaining[i - 1]! + 1e-6);
    }
  });

  it('fraction은 항상 0..1', () => {
    for (const s of ON_ROUTE_SEQUENCE) {
      const f = computeProgress(ROUTE, s.coord).progress.fraction;
      expect(f).toBeGreaterThanOrEqual(0);
      expect(f).toBeLessThanOrEqual(1);
    }
  });

  it('남은 시간 = 전체 × (1 − fraction) 비례', () => {
    const mid = ON_ROUTE_SEQUENCE[Math.floor(ON_ROUTE_SEQUENCE.length / 2)]!;
    const r = computeProgress(ROUTE, mid.coord);
    expect(r.durationRemainingSec).toBeCloseTo(900 * (1 - r.progress.fraction), 0);
  });
});

describe('computeProgress — 방어적 경계', () => {
  it('coords < 2 경로는 0 잔여·진행 0', () => {
    const empty: Route = {
      legs: [{ start: DESTINATION, end: DESTINATION, mode: 'walk', durationSec: 0, distanceM: 0, coords: [] }],
      totalDurationSec: 0,
      totalDistanceM: 0,
    };
    const r = computeProgress(empty, DESTINATION);
    expect(r.distanceRemainingM).toBe(0);
    expect(r.progress.fraction).toBe(0);
  });
});
