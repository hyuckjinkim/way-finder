/**
 * A1 — Valhalla 정규화 단위 테스트.
 *
 * 입력은 F4 골든 픽스처(실 컨테이너 캡처). duration 파싱·coords(precision 6)·leg
 * 매핑·km→m 변환·장애(빈 응답) 단언. precision 6 미사용 시 좌표가 한국 bbox 밖(10× 오차).
 */
import { describe, it, expect } from 'vitest';
import type { RouteLeg, RouteStep } from '@wayfinder/shared';
import { normalizeValhalla, type ValhallaRouteRaw } from './valhalla.js';
import {
  WALK_SIMPLE_RAW,
  WALK_WAYPOINTS_RAW,
  SAFE_PROFILE_RAW,
} from '../fixtures/valhalla/index.js';

/** 수도권(서울+경기) 대략 bbox — precision 6 디코드 검증. */
function inKoreaMetro(p: { lat: number; lng: number }): boolean {
  return p.lat > 37.3 && p.lat < 37.8 && p.lng > 126.6 && p.lng < 127.4;
}

describe('normalizeValhalla — 단일 leg (walkSimple)', () => {
  const route = normalizeValhalla(WALK_SIMPLE_RAW);

  it('단일 leg, mode=walk', () => {
    expect(route.legs).toHaveLength(1);
    expect(route.legs[0]!.mode).toBe('walk');
  });

  it('durationSec = trip.summary.time(초) 반올림', () => {
    expect(route.legs[0]!.durationSec).toBe(Math.round(WALK_SIMPLE_RAW.trip.legs[0]!.summary.time));
    expect(route.totalDurationSec).toBe(Math.round(WALK_SIMPLE_RAW.trip.summary.time));
  });

  it('distanceM = length(km) × 1000 반올림', () => {
    expect(route.totalDistanceM).toBe(
      Math.round(WALK_SIMPLE_RAW.trip.summary.length * 1000),
    );
    expect(route.legs[0]!.distanceM).toBe(
      Math.round(WALK_SIMPLE_RAW.trip.legs[0]!.summary.length * 1000),
    );
  });

  it('coords가 precision 6으로 한국 수도권 bbox 내 (10× 오차 방지)', () => {
    const coords = route.legs[0]!.coords;
    expect(coords.length).toBeGreaterThan(1);
    for (const c of coords) expect(inKoreaMetro(c)).toBe(true);
  });

  it('leg.start/end = coords 양 끝점', () => {
    const coords = route.legs[0]!.coords;
    expect(route.legs[0]!.start).toEqual(coords[0]);
    expect(route.legs[0]!.end).toEqual(coords[coords.length - 1]);
  });
});

describe('normalizeValhalla — 경유지 (walkWaypoints, 2 leg)', () => {
  const route = normalizeValhalla(WALK_WAYPOINTS_RAW);

  it('trip.legs 수만큼 RouteLeg 생성 (2 leg)', () => {
    expect(route.legs).toHaveLength(2);
    expect(route.legs.every((l) => l.mode === 'walk')).toBe(true);
  });

  it('총 소요는 trip.summary.time (leg 합과 별개의 trip 총합)', () => {
    expect(route.totalDurationSec).toBe(Math.round(WALK_WAYPOINTS_RAW.trip.summary.time));
  });

  it('각 leg coords가 모두 한국 bbox 내', () => {
    for (const leg of route.legs) {
      expect(leg.coords.length).toBeGreaterThan(1);
      for (const c of leg.coords) expect(inKoreaMetro(c)).toBe(true);
    }
  });
});

describe('normalizeValhalla — 프로필 (safeProfile)', () => {
  it('safe 프로필 응답도 정규화 (mode=walk, 좌표 유효)', () => {
    const route = normalizeValhalla(SAFE_PROFILE_RAW);
    expect(route.legs[0]!.mode).toBe('walk');
    expect(route.legs[0]!.coords.length).toBeGreaterThan(1);
    expect(inKoreaMetro(route.legs[0]!.coords[0]!)).toBe(true);
  });
});

describe('RouteLeg.steps 하위호환 스키마 (F1 — 정규화 레이어 증명)', () => {
  // contract.test.ts가 아니라 여기서 스키마 하위호환을 증명한다(critic MINOR):
  // contract는 경로 등록 전용이라 steps 스키마를 검증하지 않는다.

  it('steps 미존재 RouteLeg가 타입 정합 (기존 5개 정규화기·P4 경로 불변)', () => {
    const legWithoutSteps: RouteLeg = {
      start: { lat: 37.5663, lng: 126.9779 },
      end: { lat: 37.5704, lng: 126.9921 },
      mode: 'walk',
      durationSec: 100,
      distanceM: 200,
      coords: [
        { lat: 37.5663, lng: 126.9779 },
        { lat: 37.5704, lng: 126.9921 },
      ],
    };
    expect(legWithoutSteps.steps).toBeUndefined();
  });

  it('steps 존재 RouteLeg가 타입 정합 (Valhalla 턴 경로)', () => {
    const step: RouteStep = {
      location: { lat: 37.5663, lng: 126.9779 },
      instruction: 'Turn left onto 무교로.',
      type: 15,
      distanceM: 73,
      streetNames: ['무교로'],
      shapeIndex: 10,
    };
    const legWithSteps: RouteLeg = {
      start: { lat: 37.5663, lng: 126.9779 },
      end: { lat: 37.5704, lng: 126.9921 },
      mode: 'walk',
      durationSec: 100,
      distanceM: 200,
      coords: [
        { lat: 37.5663, lng: 126.9779 },
        { lat: 37.5704, lng: 126.9921 },
      ],
      steps: [step],
    };
    expect(legWithSteps.steps).toHaveLength(1);
    expect(legWithSteps.steps![0]!.location).toEqual(step.location);
  });
});

describe('normalizeValhalla — 장애 (silent 금지)', () => {
  it('legs 누락 → throw', () => {
    expect(() => normalizeValhalla({ trip: { legs: [] } })).toThrow(/no legs/);
    expect(() => normalizeValhalla({} as ValhallaRouteRaw)).toThrow(/no legs/);
  });

  it('leg shape 누락 → throw', () => {
    expect(() =>
      normalizeValhalla({ trip: { legs: [{ summary: { time: 1, length: 1 } }] } }),
    ).toThrow(/no shape/);
  });
});
