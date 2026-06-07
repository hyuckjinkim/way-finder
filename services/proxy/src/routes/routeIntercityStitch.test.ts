/**
 * B3 — 시외 3단 스티칭 단위 테스트.
 * 도시간 판정·구간 승격(train)·3단 leg 순서·F2 시외 픽스처 산술 정합을 검증한다.
 */
import { describe, it, expect } from 'vitest';
import { TRANSFER_BUFFER_SEC } from '@wayfinder/shared';
import type { RouteLeg } from '@wayfinder/shared';
import { ROUTE_FIXTURE_COORDS, INTERCITY_STITCH } from '@wayfinder/shared/mocks';
import { normalizeOdsayTransit } from '../normalize/odsayTransit.js';
import { ODSAY_INTERCITY_RAW } from '../fixtures/odsayTransit.js';
import {
  isIntercity,
  promoteIntercityLeg,
  stitchIntercity,
  INTERCITY_LAT_THRESHOLD,
} from './routeIntercityStitch.js';

const {
  SEOUL_A,
  SEOUL_STATION,
  BUSAN_STATION,
  BUSAN_DEST,
} = ROUTE_FIXTURE_COORDS;

function transitLeg(
  start: { lat: number; lng: number },
  end: { lat: number; lng: number },
  durationSec: number,
  distanceM: number,
  lineName: string,
): RouteLeg {
  return {
    start,
    end,
    mode: 'transit',
    durationSec,
    distanceM,
    coords: [start, end],
    transit: { lineName, lineType: 'subway' },
  };
}

describe('isIntercity', () => {
  it('서울→부산(위도 차 > 1.5°)은 도시간', () => {
    expect(isIntercity([SEOUL_A, BUSAN_DEST])).toBe(true);
  });

  it('서울 시내(위도 차 작음)는 도시간 아님', () => {
    expect(isIntercity([SEOUL_A, SEOUL_STATION])).toBe(false);
  });

  it('임계값은 1.5°', () => {
    expect(INTERCITY_LAT_THRESHOLD).toBe(1.5);
  });
});

describe('promoteIntercityLeg — 도시간 구간 승격', () => {
  it('시내 정규화(subway)된 KTX 구간을 train으로 승격, lineName 유지', () => {
    const legs = normalizeOdsayTransit(ODSAY_INTERCITY_RAW);
    expect(legs).toHaveLength(1);
    // 시내 정규화는 subway로 떨어뜨림 (도시간 lineType 미생성 — F1 동결).
    expect(legs[0]!.transit?.lineType).toBe('subway');
    const promoted = promoteIntercityLeg(legs[0]!, 'train');
    expect(promoted.transit?.lineType).toBe('train');
    expect(promoted.transit?.lineName).toBe('KTX');
    expect(promoted.mode).toBe('transit');
  });

  it("express·air로도 승격 가능 (도시간 전용 lineType)", () => {
    const legs = normalizeOdsayTransit(ODSAY_INTERCITY_RAW);
    expect(promoteIntercityLeg(legs[0]!, 'express').transit?.lineType).toBe('express');
    expect(promoteIntercityLeg(legs[0]!, 'air').transit?.lineType).toBe('air');
  });
});

describe('stitchIntercity — 3단 합성', () => {
  // 1) 서울 출발지 → 서울역 (시내)
  const access = [transitLeg(SEOUL_A, SEOUL_STATION, 420, 1800, '1호선')];
  // 2) 서울역 → 부산역 (도시간, 승격)
  const intercity = [
    promoteIntercityLeg(
      transitLeg(SEOUL_STATION, BUSAN_STATION, 9600, 325000, 'KTX'),
      'train',
    ),
  ];
  // 3) 부산역 → 부산 목적지 (시내)
  const egress = [transitLeg(BUSAN_STATION, BUSAN_DEST, 780, 6200, '1호선')];

  const route = stitchIntercity(access, intercity, egress);

  it('3단 leg 순서: 출발역접근 → 도시간 → 도착역이탈', () => {
    expect(route.legs).toHaveLength(3);
    expect(route.legs[0]!.start).toEqual(SEOUL_A);
    expect(route.legs[1]!.transit?.lineType).toBe('train');
    expect(route.legs[2]!.end).toEqual(BUSAN_DEST);
  });

  it('역/터미널 좌표가 연결된다 (구간 경계 일치)', () => {
    expect(route.legs[0]!.end).toEqual(SEOUL_STATION);
    expect(route.legs[1]!.start).toEqual(SEOUL_STATION);
    expect(route.legs[1]!.end).toEqual(BUSAN_STATION);
    expect(route.legs[2]!.start).toEqual(BUSAN_STATION);
  });

  it('총 소요 = Σleg + TRANSFER_BUFFER_SEC × 2 (3 leg)', () => {
    expect(route.totalDurationSec).toBe(420 + 9600 + 780 + TRANSFER_BUFFER_SEC * 2);
  });

  it('F2 INTERCITY_STITCH 픽스처 산술(11400)과 정합', () => {
    expect(route.totalDurationSec).toBe(INTERCITY_STITCH.totalDurationSec);
    expect(route.totalDurationSec).toBe(11400);
    expect(route.totalDistanceM).toBe(INTERCITY_STITCH.totalDistanceM);
  });
});
