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
import {
  KAKAO_CAR_GUIDES_RAW,
  KAKAO_CAR_NO_GUIDES_RAW,
} from '../../test/fixtures/kakaoCarGuides.js';
import {
  GOOGLE_CAR_STEPS_RAW,
  GOOGLE_CAR_NO_STEPS_RAW,
} from '../../test/fixtures/googleCarSteps.js';
import {
  TMAP_BIKE_GUIDES_RAW,
  TMAP_BIKE_NO_GUIDES_RAW,
} from '../../test/fixtures/tmapBikeGuides.js';

/** 서울 대략 bbox — kakao car step location 검증. */
function inSeoul(p: { lat: number; lng: number }): boolean {
  return p.lat > 37.3 && p.lat < 37.8 && p.lng > 126.6 && p.lng < 127.4;
}

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

// ── P5 F2: 자동차/자전거 maneuvers → RouteStep 추출 (정규화만, 라우팅 불변) ──────
describe('P5 F2 — kakao car guides → RouteStep', () => {
  it('guides 보유 → steps 부착 (location·instruction·maneuver·type raw·distanceM)', () => {
    const route = normalizeKakaoMobility(KAKAO_CAR_GUIDES_RAW);
    const steps = route.legs[0]!.steps!;
    expect(steps).toHaveLength(3);
    expect(steps[0]!.maneuver).toBe('depart'); // type 100
    expect(steps[1]!.maneuver).toBe('turn-left'); // type 2
    expect(steps[1]!.type).toBe(2); // raw 보존
    expect(steps[1]!.instruction).toBe('무교로 방면 좌회전');
    expect(steps[1]!.distanceM).toBe(1500);
    expect(steps[2]!.maneuver).toBe('arrive'); // type 101
  });

  it('step location이 x/y → {lat,lng}, 서울 bbox 내 (off-by-one 0)', () => {
    const route = normalizeKakaoMobility(KAKAO_CAR_GUIDES_RAW);
    for (const step of route.legs[0]!.steps!) {
      expect(inSeoul(step.location)).toBe(true);
    }
    // guide1 x=126.98, y=37.561 → location {37.561, 126.98}.
    expect(route.legs[0]!.steps![1]!.location).toEqual({ lat: 37.561, lng: 126.98 });
  });

  it('하위호환: guides 부재(빈 배열) → steps 미부착 (폴리라인 동작 불변)', () => {
    const route = normalizeKakaoMobility(KAKAO_CAR_NO_GUIDES_RAW);
    expect(route.legs[0]!.steps).toBeUndefined();
    expect(route.legs[0]!.coords.length).toBeGreaterThan(1); // 폴리라인 보존
  });
});

describe('P5 F2 — Google navigationInstruction → RouteStep', () => {
  it('navigationInstruction 보유 → steps 부착 (maneuver 문자열 enum 직매핑, type 부재)', () => {
    const route = normalizeGoogleRoutes(GOOGLE_CAR_STEPS_RAW, 'car');
    const steps = route.legs[0]!.steps!;
    expect(steps).toHaveLength(3);
    expect(steps[0]!.maneuver).toBe('depart'); // DEPART
    expect(steps[1]!.maneuver).toBe('turn-left'); // TURN_LEFT
    expect(steps[1]!.instruction).toBe('Turn left');
    expect(steps[1]!.distanceM).toBe(1000);
    expect(steps[1]!.type).toBeUndefined(); // Google은 numeric 코드 없음
    expect(steps[2]!.maneuver).toBe('turn-right'); // TURN_RIGHT
  });

  it('step location이 startLocation → leg coords 위 (디코드 폴리라인 점)', () => {
    const route = normalizeGoogleRoutes(GOOGLE_CAR_STEPS_RAW, 'car');
    const leg = route.legs[0]!;
    for (const step of leg.steps!) {
      const onPath = leg.coords.some(
        (c) =>
          Math.abs(c.lat - step.location.lat) < 1e-4 &&
          Math.abs(c.lng - step.location.lng) < 1e-4,
      );
      expect(onPath).toBe(true);
    }
  });

  it('bike 모드도 step 추출 (글로벌 자전거 best-effort)', () => {
    const route = normalizeGoogleRoutes(GOOGLE_CAR_STEPS_RAW, 'bike');
    expect(route.legs[0]!.mode).toBe('bike');
    expect(route.legs[0]!.steps).toHaveLength(3);
  });

  it('하위호환: navigationInstruction 부재 → steps 미부착 (폴리라인 동작 불변)', () => {
    const route = normalizeGoogleRoutes(GOOGLE_CAR_NO_STEPS_RAW, 'car');
    expect(route.legs[0]!.steps).toBeUndefined();
    expect(route.legs[0]!.coords.length).toBeGreaterThan(1);
  });
});

describe('P5 F2 — tmap bike best-effort steps', () => {
  it('turnType 보유 → steps 부착 (best-effort)', () => {
    const route = normalizeTmapBike(TMAP_BIKE_GUIDES_RAW);
    const steps = route.legs[0]!.steps!;
    expect(steps).toHaveLength(3);
    expect(steps[0]!.maneuver).toBe('depart'); // turnType 200
    expect(steps[1]!.maneuver).toBe('turn-left'); // turnType 11
    expect(steps[1]!.type).toBe(11); // raw 보존
    expect(steps[2]!.maneuver).toBe('arrive'); // turnType 201
    for (const s of steps) expect(inSeoul(s.location)).toBe(true);
  });

  it('하위호환: turnType 부재 → steps 미부착 (폴리라인 추종 graceful)', () => {
    const route = normalizeTmapBike(TMAP_BIKE_NO_GUIDES_RAW);
    expect(route.legs[0]!.steps).toBeUndefined();
    expect(route.legs[0]!.coords.length).toBeGreaterThan(1);
  });
});

describe('P5 F2 — maneuver 코드스페이스 정규화 수렴 (§1.2 load-bearing)', () => {
  it('kakao numeric type 2 · Google TURN_LEFT가 동일 ManeuverKind로 수렴', () => {
    const kakao = normalizeKakaoMobility(KAKAO_CAR_GUIDES_RAW);
    const google = normalizeGoogleRoutes(GOOGLE_CAR_STEPS_RAW, 'car');
    const kakaoLeft = kakao.legs[0]!.steps!.find((s) => s.type === 2)!;
    const googleLeft = google.legs[0]!.steps![1]!; // TURN_LEFT
    // 서로 다른 코드스페이스(numeric 2 vs 문자열 TURN_LEFT)가 같은 enum으로 수렴.
    expect(kakaoLeft.maneuver).toBe('turn-left');
    expect(googleLeft.maneuver).toBe('turn-left');
    expect(kakaoLeft.maneuver).toBe(googleLeft.maneuver);
  });
});
