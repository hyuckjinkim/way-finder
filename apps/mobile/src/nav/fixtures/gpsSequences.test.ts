/**
 * F3 — 합성 GPS 시퀀스 픽스처 단위 테스트.
 *
 * 검증: (1) 타입 정합(LocationSample[]), (2) 결정론(고정 좌표·타임스탬프),
 * (3) on-route·off-route·도착·경계 각 ≥1, (4) 좌표가 REFERENCE_PATH 정합(같은 경로
 * 추종), (5) 경계 오프셋이 OFF_ROUTE_THRESHOLD_M=30 을 직전/직후로 straddle.
 *
 * REFERENCE_PATH가 위도 고정·정동 직선이므로 수직 이탈 거리 = |위도차| × M_PER_DEG_LAT.
 * 이 단순 환산으로 임계 판정을 픽스처 단계에서 미리 증명한다(상태 머신 A2 이전).
 */
import { describe, it, expect } from 'vitest';
import type { LocationSample } from '@wayfinder/shared';
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

/** 수도권 bbox. */
function inKoreaMetro(p: { lat: number; lng: number }): boolean {
  return p.lat > 37.3 && p.lat < 37.8 && p.lng > 126.6 && p.lng < 127.4;
}

/** REFERENCE_PATH는 위도 고정 직선 → 점의 경로 수직 이탈 = 위도차 × m/deg. */
function perpendicularOffsetM(coord: { lat: number; lng: number }): number {
  return Math.abs(coord.lat - REFERENCE_PATH[0]!.lat) * M_PER_DEG_LAT;
}

const ALL_SEQUENCES: Record<string, readonly LocationSample[]> = {
  ON_ROUTE_SEQUENCE,
  OFF_ROUTE_SEQUENCE,
  BOUNDARY_JUST_UNDER_SEQUENCE,
  BOUNDARY_JUST_OVER_SEQUENCE,
  ARRIVAL_SEQUENCE,
  POOR_ACCURACY_SEQUENCE,
};

describe('gpsSequences — 공통 불변식 (타입·결정론·bbox)', () => {
  it('REFERENCE_PATH는 위도 고정 정동 직선·한국 bbox 내', () => {
    for (const p of REFERENCE_PATH) {
      expect(inKoreaMetro(p)).toBe(true);
      expect(p.lat).toBe(REFERENCE_PATH[0]!.lat); // 위도 고정
    }
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

  it('결정론 — 같은 export를 두 번 읽어도 동일 좌표', () => {
    expect(ON_ROUTE_SEQUENCE.map((s) => s.coord)).toEqual(
      ON_ROUTE_SEQUENCE.map((s) => s.coord),
    );
  });
});

describe('gpsSequences — on-route 추종', () => {
  it('모든 샘플이 경로 위(수직 이탈 ≈0 < 임계)', () => {
    for (const s of ON_ROUTE_SEQUENCE) {
      expect(perpendicularOffsetM(s.coord)).toBeLessThan(OFF_ROUTE_THRESHOLD_M);
    }
  });

  it('경도가 단조 증가(출발→목적지 동진)', () => {
    for (let i = 1; i < ON_ROUTE_SEQUENCE.length; i++) {
      expect(ON_ROUTE_SEQUENCE[i]!.coord.lng).toBeGreaterThan(
        ON_ROUTE_SEQUENCE[i - 1]!.coord.lng,
      );
    }
  });
});

describe('gpsSequences — off-route 이탈', () => {
  it('이탈 샘플의 수직 거리가 임계 초과', () => {
    const offSamples = OFF_ROUTE_SEQUENCE.slice(2);
    for (const s of offSamples) {
      expect(perpendicularOffsetM(s.coord)).toBeGreaterThan(OFF_ROUTE_THRESHOLD_M);
    }
  });

  it('초기 샘플은 on-route(임계 내)', () => {
    expect(perpendicularOffsetM(OFF_ROUTE_SEQUENCE[0]!.coord)).toBeLessThan(
      OFF_ROUTE_THRESHOLD_M,
    );
  });
});

describe('gpsSequences — 경계 케이스 (임계 straddle)', () => {
  it('직전 시퀀스 마지막 샘플 < 30m (이탈 아님)', () => {
    const last = BOUNDARY_JUST_UNDER_SEQUENCE[BOUNDARY_JUST_UNDER_SEQUENCE.length - 1]!;
    const d = perpendicularOffsetM(last.coord);
    expect(d).toBeLessThan(OFF_ROUTE_THRESHOLD_M);
    expect(d).toBeGreaterThan(25); // 임계 근처임을 보장(자명한 0 아님)
  });

  it('직후 시퀀스 마지막 샘플 > 30m (이탈)', () => {
    const last = BOUNDARY_JUST_OVER_SEQUENCE[BOUNDARY_JUST_OVER_SEQUENCE.length - 1]!;
    const d = perpendicularOffsetM(last.coord);
    expect(d).toBeGreaterThan(OFF_ROUTE_THRESHOLD_M);
    expect(d).toBeLessThan(35); // 임계 근처임을 보장
  });

  it('직전/직후가 임계 30m를 사이에 두고 straddle', () => {
    const under = perpendicularOffsetM(
      BOUNDARY_JUST_UNDER_SEQUENCE[BOUNDARY_JUST_UNDER_SEQUENCE.length - 1]!.coord,
    );
    const over = perpendicularOffsetM(
      BOUNDARY_JUST_OVER_SEQUENCE[BOUNDARY_JUST_OVER_SEQUENCE.length - 1]!.coord,
    );
    expect(under).toBeLessThan(OFF_ROUTE_THRESHOLD_M);
    expect(over).toBeGreaterThan(OFF_ROUTE_THRESHOLD_M);
  });
});

describe('gpsSequences — 도착 반경 진입', () => {
  it('마지막 샘플이 목적지 ARRIVAL_RADIUS_M 내', () => {
    const last = ARRIVAL_SEQUENCE[ARRIVAL_SEQUENCE.length - 1]!;
    // 목적지 정확 도착 — 거리 0.
    expect(last.coord).toEqual(DESTINATION);
    // 직전 샘플도 도착 반경 내(위도 오프셋 ≈10m).
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
