/**
 * A1 — haversine 거리 단위 테스트. 알려진 서울 좌표쌍 ±오차 검증(§8 완전 검증 가능).
 */
import { describe, it, expect } from 'vitest';
import type { LatLng } from '../types/geo.js';
import { haversineDistanceM, toRadians, EARTH_RADIUS_M } from './distance.js';

// 알려진 서울 좌표 (routeFixtures와 정합).
const SEOUL_STATION: LatLng = { lat: 37.5547, lng: 126.9707 }; // 서울역
const CITY_HALL: LatLng = { lat: 37.5665, lng: 126.978 }; // 시청
const GANGNAM: LatLng = { lat: 37.4979, lng: 127.0276 }; // 강남역

describe('haversineDistanceM — 알려진 좌표쌍', () => {
  it('동일 좌표는 0', () => {
    expect(haversineDistanceM(CITY_HALL, CITY_HALL)).toBe(0);
  });

  it('서울역→시청 ≈ 1.5km (±5%)', () => {
    // 실측 직선거리 ≈ 1490m.
    const d = haversineDistanceM(SEOUL_STATION, CITY_HALL);
    expect(d).toBeGreaterThan(1490 * 0.95);
    expect(d).toBeLessThan(1490 * 1.05);
  });

  it('시청→강남역 ≈ 9.0km (±5%)', () => {
    // 실측 직선거리 ≈ 9050m.
    const d = haversineDistanceM(CITY_HALL, GANGNAM);
    expect(d).toBeGreaterThan(9050 * 0.95);
    expect(d).toBeLessThan(9050 * 1.05);
  });

  it('대칭(a→b = b→a)', () => {
    expect(haversineDistanceM(SEOUL_STATION, GANGNAM)).toBeCloseTo(
      haversineDistanceM(GANGNAM, SEOUL_STATION),
      6,
    );
  });

  it('위도 1도 ≈ 111.2km', () => {
    const d = haversineDistanceM({ lat: 37, lng: 127 }, { lat: 38, lng: 127 });
    expect(d).toBeGreaterThan(111_000);
    expect(d).toBeLessThan(111_400);
  });
});

describe('toRadians / EARTH_RADIUS_M', () => {
  it('180도 = π', () => {
    expect(toRadians(180)).toBeCloseTo(Math.PI, 10);
  });

  it('EARTH_RADIUS_M = 6,371,000', () => {
    expect(EARTH_RADIUS_M).toBe(6_371_000);
  });
});
