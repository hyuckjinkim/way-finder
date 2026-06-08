/**
 * F3 — 합성 GPS 시퀀스 픽스처 단위 테스트.
 *
 * 검증: (1) 타입 정합(LocationSample[]), (2) 결정론(고정 좌표·타임스탬프),
 * (3) on-route·off-route·도착·경계 각 ≥1, (4) 좌표가 WALK_SIMPLE 골든 경로 정합
 * (REFERENCE_PATH=골든 leg coords 복사), (5) 경계 오프셋이 OFF_ROUTE_THRESHOLD_M=30
 * 을 직전/직후로 straddle.
 *
 * REFERENCE_PATH는 winding 실 경로이므로 임계 판정은 단순 위도차가 아니라 점→폴리라인
 * **최근접 세그먼트 거리**로 확인한다. 아래 minDistToRouteM은 테스트 전용 헬퍼(A1의
 * projection 산물이 아님 — 미래 geo-math와 충돌하지 않는다).
 */
import { describe, it, expect } from 'vitest';
import type { LatLng, LocationSample } from '@wayfinder/shared';
import { OFF_ROUTE_THRESHOLD_M, ARRIVAL_RADIUS_M } from '@wayfinder/shared';
import {
  REFERENCE_PATH,
  DESTINATION,
  M_PER_DEG_LAT,
  ON_ROUTE_SEQUENCE,
  OFF_ROUTE_SEQUENCE,
  BOUNDARY_JUST_UNDER_SEQUENCE,
  BOUNDARY_JUST_OVER_SEQUENCE,
  ARRIVAL_SEQUENCE,
  POOR_ACCURACY_SEQUENCE,
} from './gpsSequences.js';

const R = 6_371_000;
const rad = (d: number): number => (d * Math.PI) / 180;

/** 수도권 bbox. */
function inKoreaMetro(p: LatLng): boolean {
  return p.lat > 37.3 && p.lat < 37.8 && p.lng > 126.6 && p.lng < 127.4;
}

/** 점→세그먼트(a,b) 수직 거리(m). 국소 equirectangular 근사 — 테스트 전용. */
function distToSegmentM(p: LatLng, a: LatLng, b: LatLng): number {
  const latRef = rad((a.lat + b.lat) / 2);
  const x = (l: LatLng): number => rad(l.lng) * Math.cos(latRef) * R;
  const y = (l: LatLng): number => rad(l.lat) * R;
  const px = x(p);
  const py = y(p);
  const ax = x(a);
  const ay = y(a);
  const dx = x(b) - ax;
  const dy = y(b) - ay;
  const len2 = dx * dx + dy * dy;
  let t = len2 ? ((px - ax) * dx + (py - ay) * dy) / len2 : 0;
  t = Math.max(0, Math.min(1, t));
  return Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
}

/** 점→REFERENCE_PATH 폴리라인 최근접 거리(m). */
function minDistToRouteM(p: LatLng): number {
  let m = Infinity;
  for (let i = 0; i < REFERENCE_PATH.length - 1; i++) {
    m = Math.min(m, distToSegmentM(p, REFERENCE_PATH[i]!, REFERENCE_PATH[i + 1]!));
  }
  return m;
}

const ALL_SEQUENCES: Record<string, readonly LocationSample[]> = {
  ON_ROUTE_SEQUENCE,
  OFF_ROUTE_SEQUENCE,
  BOUNDARY_JUST_UNDER_SEQUENCE,
  BOUNDARY_JUST_OVER_SEQUENCE,
  ARRIVAL_SEQUENCE,
  POOR_ACCURACY_SEQUENCE,
};

describe('gpsSequences — 공통 불변식 (타입·결정론·bbox·골든 정합)', () => {
  it('REFERENCE_PATH = WALK_SIMPLE 골든 leg coords (55점·한국 bbox)', () => {
    expect(REFERENCE_PATH).toHaveLength(55);
    for (const p of REFERENCE_PATH) expect(inKoreaMetro(p)).toBe(true);
    expect(DESTINATION).toEqual(REFERENCE_PATH[REFERENCE_PATH.length - 1]);
  });

  it('모든 시퀀스가 LocationSample[] 타입 정합·한국 bbox·단조 타임스탬프', () => {
    for (const [name, seq] of Object.entries(ALL_SEQUENCES)) {
      expect(seq.length, name).toBeGreaterThan(0);
      seq.forEach((s, i) => {
        expect(typeof s.timestampMs).toBe('number');
        expect(inKoreaMetro(s.coord)).toBe(true);
        if (i > 0) expect(s.timestampMs).toBeGreaterThan(seq[i - 1]!.timestampMs);
      });
    }
  });
});

describe('gpsSequences — on-route 추종 (골든 경로 정합)', () => {
  it('모든 샘플이 골든 경로 위(최근접 거리 ≈0 ≪ 임계)', () => {
    for (const s of ON_ROUTE_SEQUENCE) {
      expect(minDistToRouteM(s.coord)).toBeLessThan(OFF_ROUTE_THRESHOLD_M);
    }
  });

  it('샘플 좌표가 REFERENCE_PATH 정점과 1:1 (같은 경로 추종 — A2 짝지음 가능)', () => {
    expect(ON_ROUTE_SEQUENCE).toHaveLength(REFERENCE_PATH.length);
    ON_ROUTE_SEQUENCE.forEach((s, i) => expect(s.coord).toEqual(REFERENCE_PATH[i]));
  });
});

describe('gpsSequences — off-route 이탈', () => {
  it('이탈 샘플의 최근접 거리가 임계 초과', () => {
    for (const s of OFF_ROUTE_SEQUENCE.slice(2)) {
      expect(minDistToRouteM(s.coord)).toBeGreaterThan(OFF_ROUTE_THRESHOLD_M);
    }
  });

  it('초기 샘플은 on-route(임계 내)', () => {
    expect(minDistToRouteM(OFF_ROUTE_SEQUENCE[0]!.coord)).toBeLessThan(OFF_ROUTE_THRESHOLD_M);
  });
});

describe('gpsSequences — 경계 케이스 (임계 straddle)', () => {
  it('직전 시퀀스 마지막 샘플 < 30m (이탈 아님)', () => {
    const d = minDistToRouteM(
      BOUNDARY_JUST_UNDER_SEQUENCE[BOUNDARY_JUST_UNDER_SEQUENCE.length - 1]!.coord,
    );
    expect(d).toBeLessThan(OFF_ROUTE_THRESHOLD_M);
    expect(d).toBeGreaterThan(25); // 임계 근처(자명한 0 아님)
  });

  it('직후 시퀀스 마지막 샘플 > 30m (이탈)', () => {
    const d = minDistToRouteM(
      BOUNDARY_JUST_OVER_SEQUENCE[BOUNDARY_JUST_OVER_SEQUENCE.length - 1]!.coord,
    );
    expect(d).toBeGreaterThan(OFF_ROUTE_THRESHOLD_M);
    expect(d).toBeLessThan(35); // 임계 근처
  });

  it('직전/직후가 임계 30m를 사이에 두고 straddle', () => {
    const under = minDistToRouteM(
      BOUNDARY_JUST_UNDER_SEQUENCE[BOUNDARY_JUST_UNDER_SEQUENCE.length - 1]!.coord,
    );
    const over = minDistToRouteM(
      BOUNDARY_JUST_OVER_SEQUENCE[BOUNDARY_JUST_OVER_SEQUENCE.length - 1]!.coord,
    );
    expect(under).toBeLessThan(OFF_ROUTE_THRESHOLD_M);
    expect(over).toBeGreaterThan(OFF_ROUTE_THRESHOLD_M);
  });
});

describe('gpsSequences — 도착 반경 진입', () => {
  it('마지막 샘플이 목적지 정확·직전 샘플이 ARRIVAL_RADIUS_M 내', () => {
    const last = ARRIVAL_SEQUENCE[ARRIVAL_SEQUENCE.length - 1]!;
    expect(last.coord).toEqual(DESTINATION);
    const prev = ARRIVAL_SEQUENCE[ARRIVAL_SEQUENCE.length - 2]!;
    const dPrev = Math.abs(prev.coord.lat - DESTINATION.lat) * M_PER_DEG_LAT;
    expect(dPrev).toBeLessThan(ARRIVAL_RADIUS_M);
  });
});

describe('gpsSequences — GPS 정확도 나쁜 샘플', () => {
  it('큰 accuracyM 샘플 ≥1 존재(필터링 입력)', () => {
    const poor = POOR_ACCURACY_SEQUENCE.filter((s) => (s.accuracyM ?? 0) > 50);
    expect(poor.length).toBeGreaterThanOrEqual(1);
  });
});
