/**
 * B2 — leg-chaining 합성 엔진 단위 테스트.
 * 환승 버퍼 규약(transferCount = legs.length - 1)·leg 순서·shared 상수 사용을
 * F2 픽스처 산술과 동일 기준으로 검증한다.
 */
import { describe, it, expect } from 'vitest';
import { TRANSFER_BUFFER_SEC } from '@wayfinder/shared';
import type { RouteLeg } from '@wayfinder/shared';
import {
  TRANSIT_CHAIN,
  INTERCITY_STITCH,
} from '@wayfinder/shared/mocks';
import { chainTransitLegs, buildTransitRoute } from '@wayfinder/shared/transit';

const C = { lat: 37.5, lng: 127.0 };

function transitLeg(durationSec: number, distanceM: number): RouteLeg {
  return {
    start: C,
    end: C,
    mode: 'transit',
    durationSec,
    distanceM,
    coords: [C, C],
    transit: { lineName: 'x', lineType: 'subway' },
  };
}

describe('buildTransitRoute', () => {
  it('총 소요 = Σleg + TRANSFER_BUFFER_SEC × (legs-1)', () => {
    const legs = [transitLeg(600, 1000), transitLeg(540, 800)];
    const route = buildTransitRoute(legs);
    expect(route.totalDurationSec).toBe(600 + 540 + TRANSFER_BUFFER_SEC * 1);
    expect(route.totalDistanceM).toBe(1800);
  });

  it('단일 leg면 버퍼 0', () => {
    const route = buildTransitRoute([transitLeg(600, 1000)]);
    expect(route.totalDurationSec).toBe(600);
  });

  it('빈 leg면 0 소요/거리', () => {
    const route = buildTransitRoute([]);
    expect(route).toEqual({ legs: [], totalDurationSec: 0, totalDistanceM: 0 });
  });

  it('자체 상수 아닌 shared TRANSFER_BUFFER_SEC(300)을 사용한다', () => {
    expect(TRANSFER_BUFFER_SEC).toBe(300);
    const route = buildTransitRoute([transitLeg(0, 0), transitLeg(0, 0)]);
    expect(route.totalDurationSec).toBe(300);
  });
});

describe('chainTransitLegs — 구간 배열 이어붙이기', () => {
  it('구간별 leg를 순서대로 펼쳐 합성한다', () => {
    const seg1 = [transitLeg(600, 1000)];
    const seg2 = [transitLeg(180, 200), transitLeg(540, 800)];
    const route = chainTransitLegs([seg1, seg2]);
    expect(route.legs).toHaveLength(3);
    expect(route.legs[0]).toBe(seg1[0]);
    expect(route.legs[2]).toBe(seg2[1]);
    // 3 leg → 버퍼 2회.
    expect(route.totalDurationSec).toBe(600 + 180 + 540 + TRANSFER_BUFFER_SEC * 2);
  });
});

describe('F2 픽스처 산술 정합 — 엔진이 같은 규약을 재현', () => {
  it('TRANSIT_CHAIN: 엔진 합성이 픽스처 total(1920)과 일치', () => {
    const rebuilt = buildTransitRoute(TRANSIT_CHAIN.legs);
    expect(rebuilt.totalDurationSec).toBe(TRANSIT_CHAIN.totalDurationSec);
    expect(rebuilt.totalDurationSec).toBe(1920);
    expect(rebuilt.totalDistanceM).toBe(TRANSIT_CHAIN.totalDistanceM);
  });

  it('INTERCITY_STITCH: 엔진 합성이 픽스처 total(11400)과 일치', () => {
    const rebuilt = buildTransitRoute(INTERCITY_STITCH.legs);
    expect(rebuilt.totalDurationSec).toBe(INTERCITY_STITCH.totalDurationSec);
    expect(rebuilt.totalDurationSec).toBe(11400);
    expect(rebuilt.totalDistanceM).toBe(INTERCITY_STITCH.totalDistanceM);
  });
});
