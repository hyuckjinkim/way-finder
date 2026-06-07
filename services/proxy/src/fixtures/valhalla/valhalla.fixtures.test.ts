/**
 * P4 F4 — 골든 픽스처 결정론·정밀도 가드.
 *
 * 게이트(§3 F4 완료 기준): 각 프로필/경유지 케이스 실 응답 ≥1개 + polyline precision 6
 * 실증(좌표가 한국 bbox 내) + 결정론(좌표 고정). 픽스처가 추측 아닌 실 데이터임을 단언.
 */
import { describe, it, expect } from 'vitest';
import { decode } from '@googlemaps/polyline-codec';
import {
  WALK_SIMPLE_RAW,
  WALK_WAYPOINTS_RAW,
  SAFE_PROFILE_RAW,
  WALKABLE_PROFILE_RAW,
} from './index.js';

/** 수도권(서울+경기) 대략 bbox — 정밀도 6 디코드 검증. */
function inKoreaMetro(lat: number, lng: number): boolean {
  return lat > 37.3 && lat < 37.8 && lng > 126.6 && lng < 127.4;
}

const FIXTURES = {
  walkSimple: WALK_SIMPLE_RAW,
  walkWaypoints: WALK_WAYPOINTS_RAW,
  safeProfile: SAFE_PROFILE_RAW,
  walkableProfile: WALKABLE_PROFILE_RAW,
} as const;

describe('Valhalla 골든 픽스처 — 실 응답 + precision 6', () => {
  for (const [name, raw] of Object.entries(FIXTURES)) {
    describe(name, () => {
      it('trip.status === 0 (Found route — 실 컨테이너 성공 응답)', () => {
        expect(raw.trip.status).toBe(0);
        expect(raw.trip.legs.length).toBeGreaterThanOrEqual(1);
      });

      it('shape가 precision 6으로 한국 수도권 bbox 내 디코드 (10× 오차 방지)', () => {
        for (const leg of raw.trip.legs) {
          const coords6 = decode(leg.shape, 6);
          expect(coords6.length).toBeGreaterThanOrEqual(2);
          const [lat, lng] = coords6[0]!;
          expect(inKoreaMetro(lat, lng)).toBe(true);
          // precision 5로 디코드하면 bbox 밖(≈10×) — 정밀도 인자 필수 실증.
          const [wrongLat, wrongLng] = decode(leg.shape, 5)[0]!;
          expect(inKoreaMetro(wrongLat, wrongLng)).toBe(false);
        }
      });

      it('summary.time(초)·length(km)가 양수 (결정론적 실측값)', () => {
        expect(raw.trip.summary.time).toBeGreaterThan(0);
        expect(raw.trip.summary.length).toBeGreaterThan(0);
      });
    });
  }

  it('safe 프로필이 fastest보다 소요 큼 (costing 효과 실증)', () => {
    // 동일 좌표쌍(시청→종로)에서 safe(소로 회피)가 더 오래 — costing이 실제로 작동.
    expect(SAFE_PROFILE_RAW.trip.summary.time).toBeGreaterThan(
      WALK_SIMPLE_RAW.trip.summary.time,
    );
  });

  it('walkWaypoints는 2 leg (경유지 케이스 캡처됨)', () => {
    expect(WALK_WAYPOINTS_RAW.trip.legs).toHaveLength(2);
  });
});
