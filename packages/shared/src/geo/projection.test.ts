/**
 * A1 — 점→폴리라인 최근접점 투영 단위 테스트.
 *
 * 검증: (1) on-route 점 perp≈0, (2) 누적 along 단조 증가, (3) 세그먼트 내 투영,
 * (4) F3 경계 좌표 straddle 재현(29m<30<31m — 픽스처 헬퍼와 동일 수학 정합 확인),
 * (5) pathLengthM = haversine 세그먼트 합.
 *
 * 경계 좌표는 F3 gpsSequences의 OFFSET_BASE(REFERENCE_PATH[43]↔[44] 정동 중점)에서
 * 남쪽 위도 오프셋으로 도출 — 여기선 shared 자기완결을 위해 값을 복제한다(mobile
 * 픽스처를 패키지 경계 너머로 import하지 않는다).
 */
import { describe, it, expect } from 'vitest';
import type { LatLng } from '../types/geo.js';
import { projectToPath, pathLengthM } from './projection.js';
import { haversineDistanceM } from './distance.js';

// 단순 동서 직선 경로(정동, lat 고정) — 투영 산술 검증용.
const EW_LINE: readonly LatLng[] = [
  { lat: 37.57, lng: 126.98 },
  { lat: 37.57, lng: 126.99 },
  { lat: 37.57, lng: 127.0 },
];

describe('projectToPath — 직선 경로 투영', () => {
  it('경로 위 점은 perp≈0', () => {
    const proj = projectToPath({ lat: 37.57, lng: 126.985 }, EW_LINE);
    expect(proj.perpDistanceM).toBeLessThan(0.5);
  });

  it('경로에서 남쪽으로 벗어난 점은 perp = 위도 오프셋 거리', () => {
    const off: LatLng = { lat: 37.57 - 50 / 111_132, lng: 126.985 };
    const proj = projectToPath(off, EW_LINE);
    expect(proj.perpDistanceM).toBeGreaterThan(45);
    expect(proj.perpDistanceM).toBeLessThan(55);
  });

  it('alongDistanceM은 경로 진행에 따라 단조 증가', () => {
    const a = projectToPath({ lat: 37.57, lng: 126.982 }, EW_LINE).alongDistanceM;
    const b = projectToPath({ lat: 37.57, lng: 126.988 }, EW_LINE).alongDistanceM;
    const c = projectToPath({ lat: 37.57, lng: 126.995 }, EW_LINE).alongDistanceM;
    expect(b).toBeGreaterThan(a);
    expect(c).toBeGreaterThan(b);
  });

  it('시작점 along≈0, 끝점 along≈전체 길이', () => {
    const start = projectToPath(EW_LINE[0]!, EW_LINE);
    const end = projectToPath(EW_LINE[2]!, EW_LINE);
    expect(start.alongDistanceM).toBeLessThan(1);
    expect(end.alongDistanceM).toBeCloseTo(pathLengthM(EW_LINE), 0);
  });

  it('최근접 세그먼트 인덱스를 반환', () => {
    expect(projectToPath({ lat: 37.57, lng: 126.983 }, EW_LINE).segmentIndex).toBe(0);
    expect(projectToPath({ lat: 37.57, lng: 126.995 }, EW_LINE).segmentIndex).toBe(1);
  });
});

describe('projectToPath — 방어적 경계', () => {
  it('빈 경로는 perp 0·along 0', () => {
    const proj = projectToPath({ lat: 37.57, lng: 126.98 }, []);
    expect(proj.perpDistanceM).toBe(0);
    expect(proj.alongDistanceM).toBe(0);
  });

  it('단일 점 경로는 점까지 haversine 거리', () => {
    const single: readonly LatLng[] = [{ lat: 37.57, lng: 126.98 }];
    const proj = projectToPath({ lat: 37.571, lng: 126.98 }, single);
    expect(proj.perpDistanceM).toBeCloseTo(
      haversineDistanceM({ lat: 37.571, lng: 126.98 }, single[0]!),
      3,
    );
    expect(proj.alongDistanceM).toBe(0);
  });
});

describe('projectToPath — F3 경계 좌표 straddle 재현 (calibration cross-check)', () => {
  // F3 OFFSET_BASE = REFERENCE_PATH[43]↔[44] 정동 중점. 인근 두 정점만 있는 미니 경로로
  // 동일 기하를 재현 — 남쪽 위도 오프셋이 순수 수직 거리가 된다.
  const SEG: readonly LatLng[] = [
    { lat: 37.570172, lng: 126.986899 }, // REFERENCE_PATH[43]
    { lat: 37.570167, lng: 126.987377 }, // REFERENCE_PATH[44]
  ];
  const OFFSET_BASE: LatLng = { lat: 37.570169, lng: 126.987138 };
  const M_PER_DEG_LAT = 111_132;
  const offsetSouthM = (m: number): LatLng => ({
    lat: +(OFFSET_BASE.lat - m / M_PER_DEG_LAT).toFixed(6),
    lng: OFFSET_BASE.lng,
  });

  it('29m 오프셋은 < 30m (이탈 아님)', () => {
    expect(projectToPath(offsetSouthM(29), SEG).perpDistanceM).toBeLessThan(30);
  });

  it('31m 오프셋은 > 30m (이탈)', () => {
    expect(projectToPath(offsetSouthM(31), SEG).perpDistanceM).toBeGreaterThan(30);
  });

  it('50m 오프셋은 ≈50m', () => {
    const d = projectToPath(offsetSouthM(50), SEG).perpDistanceM;
    expect(d).toBeGreaterThan(45);
    expect(d).toBeLessThan(55);
  });
});

describe('pathLengthM', () => {
  it('직선 3점 = 두 세그먼트 haversine 합', () => {
    const expected =
      haversineDistanceM(EW_LINE[0]!, EW_LINE[1]!) +
      haversineDistanceM(EW_LINE[1]!, EW_LINE[2]!);
    expect(pathLengthM(EW_LINE)).toBeCloseTo(expected, 6);
  });

  it('빈/단일 점은 0', () => {
    expect(pathLengthM([])).toBe(0);
    expect(pathLengthM([{ lat: 37.57, lng: 126.98 }])).toBe(0);
  });
});
