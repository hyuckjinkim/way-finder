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

describe('normalizeValhalla — maneuvers → steps 추출 (F2)', () => {
  const route = normalizeValhalla(WALK_SIMPLE_RAW);
  const leg = route.legs[0]!;
  const maneuvers = WALK_SIMPLE_RAW.trip.legs[0]!.maneuvers;

  it('maneuver 수만큼 step 생성', () => {
    expect(leg.steps).toBeDefined();
    expect(leg.steps).toHaveLength(maneuvers.length);
  });

  it('step location이 begin_shape_index → leg coords[index] (begin, not end)', () => {
    leg.steps!.forEach((step, j) => {
      const beginIdx = maneuvers[j]!.begin_shape_index;
      expect(step.shapeIndex).toBe(beginIdx);
      expect(step.location).toEqual(leg.coords[beginIdx]!);
    });
  });

  it('모든 begin_shape_index가 coords 범위 내 [0, length) (off-by-one 방지)', () => {
    // 오라클: 정규화된 coords 길이로 카운트 — 하드코딩 길이 아님.
    const n = leg.coords.length;
    for (const m of maneuvers) {
      expect(m.begin_shape_index).toBeGreaterThanOrEqual(0);
      expect(m.begin_shape_index).toBeLessThan(n);
    }
    // 도착 maneuver(type 4, begin=54)가 마지막 유효 인덱스 — coords[54] 존재.
    const arrival = maneuvers[maneuvers.length - 1]!;
    expect(arrival.type).toBe(4);
    expect(leg.coords[arrival.begin_shape_index]).toBeDefined();
    expect(leg.steps![leg.steps!.length - 1]!.location).toEqual(
      leg.coords[arrival.begin_shape_index]!,
    );
  });

  it('모든 step location이 leg coords 위·한국 bbox 내', () => {
    for (const step of leg.steps!) {
      expect(inKoreaMetro(step.location)).toBe(true);
    }
  });

  it('instruction·distanceM(length km×1000)·streetNames 추출', () => {
    const left = leg.steps![1]!; // type 15, "Turn left onto 무교로.", length 0.073
    expect(left.instruction).toBe('Turn left onto 무교로.');
    expect(left.type).toBe(15);
    expect(left.distanceM).toBe(Math.round(0.073 * 1000));
    expect(left.streetNames).toEqual(['무교로']);
  });

  it('도착 maneuver(type 4, length 0, street_names 부재)가 throw 없이 추출', () => {
    const arrival = leg.steps![leg.steps!.length - 1]!;
    expect(arrival.type).toBe(4);
    expect(arrival.distanceM).toBe(0);
    expect(arrival.streetNames).toBeUndefined();
    expect(arrival.instruction).toMatch(/arrived/i);
  });

  it('하위호환: maneuvers 부재 leg는 steps 미부착 (기존 P4 폴리라인 동작)', () => {
    // 기존 throw 테스트와 동일하게 인라인 raw 구성 — 모든 골든 픽스처는
    // maneuvers를 보유하므로 부재 분기는 직접 만들어야 증명된다.
    const r = normalizeValhalla({
      trip: {
        legs: [{ shape: WALK_SIMPLE_RAW.trip.legs[0]!.shape, summary: { time: 10, length: 0.1 } }],
        summary: { time: 10, length: 0.1 },
      },
    });
    expect(r.legs[0]!.steps).toBeUndefined();
  });

  it('begin_shape_index가 coords 범위 밖이면 throw (off-by-one 가드)', () => {
    expect(() =>
      normalizeValhalla({
        trip: {
          legs: [
            {
              shape: WALK_SIMPLE_RAW.trip.legs[0]!.shape,
              summary: { time: 10, length: 0.1 },
              maneuvers: [{ type: 8, instruction: 'x', begin_shape_index: 99999, length: 0.1 }],
            },
          ],
          summary: { time: 10, length: 0.1 },
        },
      }),
    ).toThrow(/out of coords range/);
  });

  it('다른 프로필 응답(safe/waypoints)도 steps 추출 (가산적)', () => {
    const safe = normalizeValhalla(SAFE_PROFILE_RAW);
    expect(safe.legs[0]!.steps!.length).toBeGreaterThan(0);
    const wp = normalizeValhalla(WALK_WAYPOINTS_RAW);
    for (const l of wp.legs) {
      expect(l.steps!.length).toBeGreaterThan(0);
      for (const s of l.steps!) expect(s.shapeIndex!).toBeLessThan(l.coords.length);
    }
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
