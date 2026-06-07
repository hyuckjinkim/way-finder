/**
 * D3 — routeToPolylines / boundsForRoute / routeSummary 단위 테스트.
 *
 * 검증 항목:
 * 1. coords는 leg.coords 그대로 (디코드 없음)
 * 2. 모드/노선별 색상 구분
 * 3. MapPolyline 적합성 — 다구간·대중교통 라인별 색상이 {id,coords,color?,width?}로 표현
 * 4. boundsForRoute — 전체 좌표 BBox 계산
 * 5. routeSummary — 환승 수·노선명·시간·거리
 */
import { describe, it, expect } from 'vitest';
import {
  WALK_SIMPLE,
  CAR_WAYPOINT,
  TRANSIT_CHAIN,
  INTERCITY_STITCH,
  BIKE_SIMPLE,
} from '@wayfinder/shared/mocks';
import { routeToPolylines, boundsForRoute } from './routeToPolylines.js';
import { routeSummary } from './routeSummary.js';

// ─── routeToPolylines ─────────────────────────────────────────────────────────

describe('routeToPolylines — 기본', () => {
  it('leg 수만큼 MapPolyline 반환', () => {
    const polylines = routeToPolylines(WALK_SIMPLE);
    expect(polylines).toHaveLength(WALK_SIMPLE.legs.length);
  });

  it('coords는 leg.coords 그대로 (디코드 없음)', () => {
    const polylines = routeToPolylines(WALK_SIMPLE);
    expect(polylines[0]?.coords).toBe(WALK_SIMPLE.legs[0]?.coords);
  });

  it('id는 leg-{index} 형태', () => {
    const polylines = routeToPolylines(CAR_WAYPOINT);
    expect(polylines[0]?.id).toBe('leg-0');
    expect(polylines[1]?.id).toBe('leg-1');
  });

  it('MapPolyline 인터페이스 적합성 — 필수 필드(id, coords) 존재', () => {
    const polylines = routeToPolylines(TRANSIT_CHAIN);
    for (const p of polylines) {
      expect(typeof p.id).toBe('string');
      expect(Array.isArray(p.coords)).toBe(true);
      // color, width는 선택 — 존재하면 string/number
      if (p.color !== undefined) expect(typeof p.color).toBe('string');
      if (p.width !== undefined) expect(typeof p.width).toBe('number');
    }
  });
});

describe('routeToPolylines — 모드·노선별 색상', () => {
  it('walk leg는 도보 색상', () => {
    const polylines = routeToPolylines(WALK_SIMPLE);
    expect(polylines[0]?.color).toBe('#888888');
  });

  it('bike leg는 자전거 색상', () => {
    const polylines = routeToPolylines(BIKE_SIMPLE);
    expect(polylines[0]?.color).toBe('#4CAF50');
  });

  it('car leg는 자동차 색상', () => {
    const polylines = routeToPolylines(CAR_WAYPOINT);
    expect(polylines[0]?.color).toBe('#1a73e8');
    expect(polylines[1]?.color).toBe('#1a73e8');
  });

  it('transit 지하철 leg는 지하철 색상', () => {
    const polylines = routeToPolylines(TRANSIT_CHAIN);
    // leg-0: 4호선(subway)
    expect(polylines[0]?.color).toBe('#3949AB');
  });

  it('transit 버스 leg는 버스 색상', () => {
    const polylines = routeToPolylines(TRANSIT_CHAIN);
    // leg-2: 402번(bus)
    expect(polylines[2]?.color).toBe('#F57C00');
  });

  it('transit KTX leg는 기차 색상', () => {
    const polylines = routeToPolylines(INTERCITY_STITCH);
    // leg-1: KTX(train)
    expect(polylines[1]?.color).toBe('#6D4C41');
  });

  it('다구간 경로: 각 leg가 서로 다른 색상을 가질 수 있다 (MapPolyline 적합성 단언)', () => {
    const polylines = routeToPolylines(TRANSIT_CHAIN);
    // 3개 leg — transit subway / walk / transit bus → 색상이 전부 다름
    const colors = polylines.map((p) => p.color);
    expect(new Set(colors).size).toBeGreaterThan(1);
  });
});

describe('routeToPolylines — 선 두께', () => {
  it('walk는 가는 선(3)', () => {
    const polylines = routeToPolylines(WALK_SIMPLE);
    expect(polylines[0]?.width).toBe(3);
  });

  it('transit는 두꺼운 선(5)', () => {
    const polylines = routeToPolylines(TRANSIT_CHAIN);
    expect(polylines[0]?.width).toBe(5);
  });
});

// ─── boundsForRoute ───────────────────────────────────────────────────────────

describe('boundsForRoute — BBox 계산', () => {
  it('단일 leg — sw/ne 좌표가 leg coords를 포함', () => {
    const bbox = boundsForRoute(WALK_SIMPLE.legs);
    expect(bbox).not.toBeNull();
    if (!bbox) return;
    expect(bbox.sw.lat).toBeLessThanOrEqual(bbox.ne.lat);
    expect(bbox.sw.lng).toBeLessThanOrEqual(bbox.ne.lng);
  });

  it('다구간 — 전체 leg coords를 포함하는 BBox', () => {
    const bbox = boundsForRoute(INTERCITY_STITCH.legs);
    expect(bbox).not.toBeNull();
    if (!bbox) return;
    // 서울(37.5x)과 부산(35.1x) 포함 → sw.lat < ne.lat 차이가 2도 이상
    expect(bbox.ne.lat - bbox.sw.lat).toBeGreaterThan(2);
  });

  it('빈 legs — null 반환', () => {
    const bbox = boundsForRoute([]);
    expect(bbox).toBeNull();
  });
});

// ─── routeSummary ─────────────────────────────────────────────────────────────

describe('routeSummary — 도보', () => {
  it('환승 0, 노선명 없음', () => {
    const s = routeSummary(WALK_SIMPLE);
    expect(s.transfers).toBe(0);
    expect(s.lineNames).toEqual([]);
  });

  it('totalDurationSec·totalDistanceM은 Route 값 그대로', () => {
    const s = routeSummary(WALK_SIMPLE);
    expect(s.totalDurationSec).toBe(WALK_SIMPLE.totalDurationSec);
    expect(s.totalDistanceM).toBe(WALK_SIMPLE.totalDistanceM);
  });
});

describe('routeSummary — 자동차 경유지', () => {
  it('환승 0, 노선명 없음', () => {
    const s = routeSummary(CAR_WAYPOINT);
    expect(s.transfers).toBe(0);
    expect(s.lineNames).toEqual([]);
  });
});

describe('routeSummary — 대중교통 leg-chaining', () => {
  it('transit leg 수 - 1 = 환승 수 (TRANSIT_CHAIN: transit 2개 → 환승 1)', () => {
    // TRANSIT_CHAIN: transit(subway) + walk + transit(bus) → transit leg 2개 → 환승 1
    const s = routeSummary(TRANSIT_CHAIN);
    expect(s.transfers).toBe(1);
  });

  it('노선명 목록 = transit leg들의 lineName', () => {
    const s = routeSummary(TRANSIT_CHAIN);
    expect(s.lineNames).toEqual(['4호선', '402번']);
  });
});

describe('routeSummary — 시외 3단 스티칭', () => {
  it('transit leg 3개 → 환승 2', () => {
    const s = routeSummary(INTERCITY_STITCH);
    expect(s.transfers).toBe(2);
  });

  it('노선명 3개 포함', () => {
    const s = routeSummary(INTERCITY_STITCH);
    expect(s.lineNames).toEqual(['1호선', 'KTX', '1호선']);
  });
});

describe('routeSummary — 자전거', () => {
  it('환승 0, 노선명 없음', () => {
    const s = routeSummary(BIKE_SIMPLE);
    expect(s.transfers).toBe(0);
    expect(s.lineNames).toEqual([]);
  });
});
