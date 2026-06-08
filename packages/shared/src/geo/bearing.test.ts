/**
 * A1 — initial bearing 단위 테스트. 알려진 방향(북/동/남/서) ±오차.
 */
import { describe, it, expect } from 'vitest';
import type { LatLng } from '../types/geo.js';
import { initialBearingDeg } from './bearing.js';

const ORIGIN: LatLng = { lat: 37.5665, lng: 126.978 }; // 시청

describe('initialBearingDeg — 기본 방향', () => {
  it('정북 ≈ 0', () => {
    const b = initialBearingDeg(ORIGIN, { lat: ORIGIN.lat + 0.01, lng: ORIGIN.lng });
    expect(b).toBeCloseTo(0, 1);
  });

  it('정동 ≈ 90', () => {
    const b = initialBearingDeg(ORIGIN, { lat: ORIGIN.lat, lng: ORIGIN.lng + 0.01 });
    expect(b).toBeCloseTo(90, 1);
  });

  it('정남 ≈ 180', () => {
    const b = initialBearingDeg(ORIGIN, { lat: ORIGIN.lat - 0.01, lng: ORIGIN.lng });
    expect(b).toBeCloseTo(180, 1);
  });

  it('정서 ≈ 270', () => {
    const b = initialBearingDeg(ORIGIN, { lat: ORIGIN.lat, lng: ORIGIN.lng - 0.01 });
    expect(b).toBeCloseTo(270, 1);
  });

  it('동일 좌표는 0(방향 미정의 방어)', () => {
    expect(initialBearingDeg(ORIGIN, ORIGIN)).toBe(0);
  });

  it('항상 0..360 범위', () => {
    const b = initialBearingDeg(ORIGIN, { lat: ORIGIN.lat - 0.01, lng: ORIGIN.lng - 0.01 });
    expect(b).toBeGreaterThanOrEqual(0);
    expect(b).toBeLessThan(360);
    expect(b).toBeGreaterThan(180);
    expect(b).toBeLessThan(270);
  });
});
