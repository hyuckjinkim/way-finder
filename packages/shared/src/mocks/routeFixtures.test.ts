/**
 * F2 — 라우팅 픽스처 + mockRouteProvider 검증.
 *
 * 핵심: leg-chaining/시외 픽스처의 totalDurationSec이
 * Σ leg.durationSec + TRANSFER_BUFFER_SEC × (환승 수) 산술을 만족하는지를
 * shared 상수(인라인 300 금지)로 단언한다.
 */
import { describe, it, expect } from 'vitest';
import { TRANSFER_BUFFER_SEC } from '../constants/routing.js';
import type { Route, RouteRequest } from '../types/route.js';
import {
  WALK_SIMPLE,
  BIKE_SIMPLE,
  CAR_WAYPOINT,
  TRANSIT_CHAIN,
  INTERCITY_STITCH,
  ROUTE_FIXTURE_COORDS,
} from './routeFixtures.js';
import { mockRouteProvider } from './routeProvider.js';

/** leg 합 + 환승 버퍼가 totalDurationSec과 일치하는지. */
function expectDurationArithmetic(route: Route, transfers: number): void {
  const legSum = route.legs.reduce((acc, leg) => acc + leg.durationSec, 0);
  expect(route.totalDurationSec).toBe(
    legSum + TRANSFER_BUFFER_SEC * transfers,
  );
}

/** leg 거리 합이 totalDistanceM과 일치하는지. */
function expectDistanceSum(route: Route): void {
  const distSum = route.legs.reduce((acc, leg) => acc + leg.distanceM, 0);
  expect(route.totalDistanceM).toBe(distSum);
}

describe('routeFixtures — 모든 픽스처가 Route 구조 + 산술 만족', () => {
  it('도보 단순: 1 leg, coords 존재, 환승 0', () => {
    expect(WALK_SIMPLE.legs).toHaveLength(1);
    expect(WALK_SIMPLE.legs[0]!.mode).toBe('walk');
    expect(WALK_SIMPLE.legs[0]!.coords.length).toBeGreaterThanOrEqual(2);
    expectDurationArithmetic(WALK_SIMPLE, 0);
    expectDistanceSum(WALK_SIMPLE);
  });

  it('자전거 단순: 1 leg, 환승 0', () => {
    expect(BIKE_SIMPLE.legs).toHaveLength(1);
    expect(BIKE_SIMPLE.legs[0]!.mode).toBe('bike');
    expectDurationArithmetic(BIKE_SIMPLE, 0);
    expectDistanceSum(BIKE_SIMPLE);
  });

  it('자동차 경유지: 2 leg(다구간), 환승 0', () => {
    expect(CAR_WAYPOINT.legs).toHaveLength(2);
    expect(CAR_WAYPOINT.legs.every((l) => l.mode === 'car')).toBe(true);
    expectDurationArithmetic(CAR_WAYPOINT, 0);
    expectDistanceSum(CAR_WAYPOINT);
  });

  it('대중교통 leg-chaining: transit 메타 채움, 환승 2회 버퍼 반영', () => {
    expect(TRANSIT_CHAIN.legs).toHaveLength(3);
    const transitLegs = TRANSIT_CHAIN.legs.filter((l) => l.mode === 'transit');
    expect(transitLegs).toHaveLength(2);
    expect(transitLegs[0]?.transit?.lineType).toBe('subway');
    expect(transitLegs[1]?.transit?.lineType).toBe('bus');
    expect(transitLegs.every((l) => !!l.transit?.lineName)).toBe(true);
    // 핵심 산술: Σ leg + TRANSFER_BUFFER_SEC × 2 (인라인 상수 금지).
    expectDurationArithmetic(TRANSIT_CHAIN, 2);
    expectDistanceSum(TRANSIT_CHAIN);
  });

  it('시외 3단 스티칭: 시내+KTX(train)+시내, 환승 2회 버퍼 반영', () => {
    expect(INTERCITY_STITCH.legs).toHaveLength(3);
    const ktx = INTERCITY_STITCH.legs[1]!;
    expect(ktx.transit?.lineType).toBe('train');
    expect(ktx.transit?.lineName).toBe('KTX');
    // 3단 leg 순서: 출발지→서울역, 서울역→부산역, 부산역→목적지.
    expect(INTERCITY_STITCH.legs[0]!.start).toEqual(
      ROUTE_FIXTURE_COORDS.SEOUL_A,
    );
    expect(INTERCITY_STITCH.legs[0]!.end).toEqual(
      ROUTE_FIXTURE_COORDS.SEOUL_STATION,
    );
    expect(ktx.end).toEqual(ROUTE_FIXTURE_COORDS.BUSAN_STATION);
    expect(INTERCITY_STITCH.legs[2]!.end).toEqual(
      ROUTE_FIXTURE_COORDS.BUSAN_DEST,
    );
    expectDurationArithmetic(INTERCITY_STITCH, 2);
    expectDistanceSum(INTERCITY_STITCH);
  });
});

describe('mockRouteProvider.getRoute — 4모드 + 경유지 + 시외', () => {
  const { SEOUL_A, SEOUL_B, SEOUL_C, BUSAN_DEST } = ROUTE_FIXTURE_COORDS;

  async function route(req: RouteRequest): Promise<Route> {
    return mockRouteProvider.getRoute(req);
  }

  it('walk → 도보 단순 픽스처', async () => {
    expect(await route({ mode: 'walk', stops: [SEOUL_A, SEOUL_C] })).toBe(
      WALK_SIMPLE,
    );
  });

  it('bike → 자전거 단순 픽스처', async () => {
    expect(await route({ mode: 'bike', stops: [SEOUL_A, SEOUL_C] })).toBe(
      BIKE_SIMPLE,
    );
  });

  it('car (경유지 포함) → 자동차 다구간 픽스처', async () => {
    const r = await route({ mode: 'car', stops: [SEOUL_A, SEOUL_B, SEOUL_C] });
    expect(r).toBe(CAR_WAYPOINT);
    expect(r.legs).toHaveLength(2);
  });

  it('transit (시내) → leg-chaining 픽스처', async () => {
    expect(
      await route({ mode: 'transit', stops: [SEOUL_A, SEOUL_B, SEOUL_C] }),
    ).toBe(TRANSIT_CHAIN);
  });

  it('transit (시외: 서울→부산) → 3단 스티칭 픽스처', async () => {
    expect(
      await route({ mode: 'transit', stops: [SEOUL_A, BUSAN_DEST] }),
    ).toBe(INTERCITY_STITCH);
  });
});
