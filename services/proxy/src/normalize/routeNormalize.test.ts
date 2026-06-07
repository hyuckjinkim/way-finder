/**
 * A1 라우팅 정규화 단위 테스트.
 * 각 공급자 raw 픽스처(§6 부록) → Route/RouteLeg 변환 검증.
 * encoded polyline → LatLng[] 디코드(Google) 포함.
 */
import { describe, it, expect } from 'vitest';
import type { Route } from '@wayfinder/shared';

import { normalizeKakaoMobility } from './kakaoMobility.js';
import { normalizeTmapPedestrian } from './tmapPedestrian.js';
import { normalizeTmapBike } from './tmapBike.js';
import { normalizeGoogleRoutes } from './googleRoutes.js';
import { normalizeMapboxDirections } from './mapboxDirections.js';

import {
  KAKAO_MOBILITY_WAYPOINT_RAW,
  KAKAO_MOBILITY_SIMPLE_RAW,
  KAKAO_MOBILITY_FAIL_RAW,
} from '../../test/fixtures/kakaoMobility.js';
import {
  TMAP_PEDESTRIAN_RAW,
  TMAP_PEDESTRIAN_WAYPOINT_RAW,
} from '../../test/fixtures/tmapPedestrian.js';
import { TMAP_BIKE_RAW } from '../../test/fixtures/tmapBike.js';
import {
  GOOGLE_ROUTES_WAYPOINT_RAW,
  GOOGLE_ROUTES_SIMPLE_RAW,
  GOOGLE_ROUTES_EMPTY_RAW,
} from '../../test/fixtures/googleRoutes.js';
import {
  MAPBOX_WAYPOINT_RAW,
  MAPBOX_SIMPLE_RAW,
  MAPBOX_NO_ROUTE_RAW,
} from '../../test/fixtures/mapboxDirections.js';

/** 공통 Route 형태 단언 헬퍼. */
function expectValidRoute(route: Route): void {
  expect(Array.isArray(route.legs)).toBe(true);
  expect(route.legs.length).toBeGreaterThan(0);
  expect(typeof route.totalDurationSec).toBe('number');
  expect(typeof route.totalDistanceM).toBe('number');
  for (const leg of route.legs) {
    expect(leg.start).toHaveProperty('lat');
    expect(leg.start).toHaveProperty('lng');
    expect(leg.end).toHaveProperty('lat');
    expect(Array.isArray(leg.coords)).toBe(true);
  }
}

// ── 카카오모빌리티 (차, 한국) ──────────────────────────────────────────────
describe('normalizeKakaoMobility', () => {
  it('경유지 응답 → 2 leg (section 분할)', () => {
    const route = normalizeKakaoMobility(KAKAO_MOBILITY_WAYPOINT_RAW);
    expectValidRoute(route);
    expect(route.legs).toHaveLength(2);
    expect(route.legs.every((l) => l.mode === 'car')).toBe(true);
  });

  it('vertexes [lng,lat] 평면배열 → {lat,lng} 좌표쌍', () => {
    const route = normalizeKakaoMobility(KAKAO_MOBILITY_WAYPOINT_RAW);
    const first = route.legs[0]!.coords[0]!;
    expect(first.lng).toBeCloseTo(126.9723);
    expect(first.lat).toBeCloseTo(37.5563);
  });

  it('summary.distance/duration을 총합으로 사용', () => {
    const route = normalizeKakaoMobility(KAKAO_MOBILITY_WAYPOINT_RAW);
    expect(route.totalDistanceM).toBe(4500);
    expect(route.totalDurationSec).toBe(780);
  });

  it('경유지 없는 단순 경로 → 1 leg', () => {
    const route = normalizeKakaoMobility(KAKAO_MOBILITY_SIMPLE_RAW);
    expect(route.legs).toHaveLength(1);
  });

  it('result_code != 0 → throw', () => {
    expect(() => normalizeKakaoMobility(KAKAO_MOBILITY_FAIL_RAW)).toThrow();
  });

  it('빈 응답 → throw', () => {
    expect(() => normalizeKakaoMobility({ routes: [] })).toThrow();
  });
});

// ── TMAP 보행자 (도보, 한국) ────────────────────────────────────────────────
describe('normalizeTmapPedestrian', () => {
  it('GeoJSON → 단일 walk leg', () => {
    const route = normalizeTmapPedestrian(TMAP_PEDESTRIAN_RAW);
    expectValidRoute(route);
    expect(route.legs).toHaveLength(1);
    expect(route.legs[0]!.mode).toBe('walk');
  });

  it('Point feature totalDistance/totalTime을 합계로 사용', () => {
    const route = normalizeTmapPedestrian(TMAP_PEDESTRIAN_RAW);
    expect(route.totalDistanceM).toBe(1100);
    expect(route.totalDurationSec).toBe(900);
  });

  it('coordinates [lng,lat] → {lat,lng}', () => {
    const route = normalizeTmapPedestrian(TMAP_PEDESTRIAN_RAW);
    const c = route.legs[0]!.coords[0]!;
    expect(c.lng).toBeCloseTo(126.9723);
    expect(c.lat).toBeCloseTo(37.5563);
  });

  it('경유지(LineString 2개) coords가 이어진다', () => {
    const route = normalizeTmapPedestrian(TMAP_PEDESTRIAN_WAYPOINT_RAW);
    // LineString1(2점) + LineString2(2점) = 4점
    expect(route.legs[0]!.coords).toHaveLength(4);
    expect(route.totalDistanceM).toBe(1600);
  });

  it('빈 features → throw', () => {
    expect(() => normalizeTmapPedestrian({ features: [] })).toThrow();
  });
});

// ── TMAP 자전거 (자전거, 한국) ──────────────────────────────────────────────
describe('normalizeTmapBike', () => {
  it('GeoJSON → 단일 bike leg', () => {
    const route = normalizeTmapBike(TMAP_BIKE_RAW);
    expectValidRoute(route);
    expect(route.legs[0]!.mode).toBe('bike');
    expect(route.totalDistanceM).toBe(1900);
    expect(route.totalDurationSec).toBe(480);
  });
});

// ── Google Routes (글로벌 차/도보/자전거) ───────────────────────────────────
describe('normalizeGoogleRoutes', () => {
  it('경유지 응답 → 2 leg', () => {
    const route = normalizeGoogleRoutes(GOOGLE_ROUTES_WAYPOINT_RAW, 'car');
    expectValidRoute(route);
    expect(route.legs).toHaveLength(2);
    expect(route.legs.every((l) => l.mode === 'car')).toBe(true);
  });

  it("duration '780s' 문자열 → 780 초", () => {
    const route = normalizeGoogleRoutes(GOOGLE_ROUTES_WAYPOINT_RAW, 'car');
    expect(route.totalDurationSec).toBe(780);
    expect(route.legs[0]!.durationSec).toBe(420);
  });

  it('encodedPolyline → LatLng[] 디코드 (코덱 1회)', () => {
    const route = normalizeGoogleRoutes(GOOGLE_ROUTES_WAYPOINT_RAW, 'car');
    const first = route.legs[0]!.coords[0]!;
    // 픽스처 leg1 첫 좌표 = [37.5563, 126.9723]
    expect(first.lat).toBeCloseTo(37.5563, 3);
    expect(first.lng).toBeCloseTo(126.9723, 3);
    expect(route.legs[0]!.coords.length).toBeGreaterThan(1);
  });

  it('mode 인자가 leg.mode에 반영 (bike)', () => {
    const route = normalizeGoogleRoutes(GOOGLE_ROUTES_SIMPLE_RAW, 'bike');
    expect(route.legs[0]!.mode).toBe('bike');
  });

  it('빈 routes → throw', () => {
    expect(() => normalizeGoogleRoutes(GOOGLE_ROUTES_EMPTY_RAW, 'car')).toThrow();
  });
});

// ── Mapbox (글로벌 폴백) ────────────────────────────────────────────────────
describe('normalizeMapboxDirections', () => {
  it('경유지 응답 → 2 leg, 전체 geometry는 첫 leg', () => {
    const route = normalizeMapboxDirections(MAPBOX_WAYPOINT_RAW, 'car');
    expectValidRoute(route);
    expect(route.legs).toHaveLength(2);
    expect(route.legs[0]!.coords.length).toBe(3);
    expect(route.legs[1]!.coords.length).toBe(0);
  });

  it('geometry [lng,lat] → {lat,lng}', () => {
    const route = normalizeMapboxDirections(MAPBOX_WAYPOINT_RAW, 'car');
    const c = route.legs[0]!.coords[0]!;
    expect(c.lng).toBeCloseTo(-74.006);
    expect(c.lat).toBeCloseTo(40.7128);
  });

  it('distance/duration 총합', () => {
    const route = normalizeMapboxDirections(MAPBOX_WAYPOINT_RAW, 'car');
    expect(route.totalDistanceM).toBe(4500);
    expect(route.totalDurationSec).toBe(780);
  });

  it('단순 도보 → 1 leg, mode=walk', () => {
    const route = normalizeMapboxDirections(MAPBOX_SIMPLE_RAW, 'walk');
    expect(route.legs).toHaveLength(1);
    expect(route.legs[0]!.mode).toBe('walk');
  });

  it("code != 'Ok' → throw", () => {
    expect(() => normalizeMapboxDirections(MAPBOX_NO_ROUTE_RAW, 'car')).toThrow();
  });
});
