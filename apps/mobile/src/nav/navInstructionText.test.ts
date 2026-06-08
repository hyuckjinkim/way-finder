/**
 * S1 — navInstructionText 단위 테스트 (T1 검증 핵심 · 디바이스 무관).
 *
 * 단언:
 *  (1) maneuver enum + distanceM → 합성 문장("200m 앞에서 좌회전"),
 *  (2) 모드별 어휘 차이(자동차/자전거=차량 어휘 vs 도보/대중교통=보행 어휘),
 *  (3) depart/arrive·거리 ≈0 → 거리 접두 없음,
 *  (4) 거리 ≥1km → km 접두,
 *  (5) maneuver 미존재·'unknown' → instruction 원문 폴백,
 *  (6) instruction도 없으면 일반 문구.
 */
import { describe, it, expect } from 'vitest';
import type { RouteStep, TravelMode } from '@wayfinder/shared';
import { navInstructionText } from './navInstructionText.js';

/** RouteStep 합성기 — 테스트 대상 필드만 채운다. */
function step(over: Partial<RouteStep> = {}): RouteStep {
  return {
    location: { lat: 37.5665, lng: 126.978 },
    instruction: '',
    distanceM: 200,
    ...over,
  };
}

describe('navInstructionText — maneuver enum 기반 합성', () => {
  it('distanceM + 좌회전 maneuver를 "200m 앞에서 좌회전"으로 합성한다(자동차)', () => {
    const text = navInstructionText(step({ maneuver: 'turn-left', distanceM: 200 }), 'car');
    expect(text).toBe('200m 앞에서 좌회전');
  });

  it('거리 ≥1km는 km 접두로 합성한다', () => {
    const text = navInstructionText(step({ maneuver: 'turn-right', distanceM: 1200 }), 'car');
    expect(text).toBe('1.2km 앞에서 우회전');
  });

  it('depart는 거리 접두 없이 발화한다', () => {
    const text = navInstructionText(step({ maneuver: 'depart', distanceM: 0 }), 'car');
    expect(text).toBe('출발합니다');
  });

  it('arrive는 거리 접두 없이 도착 문구로 발화한다', () => {
    const text = navInstructionText(step({ maneuver: 'arrive', distanceM: 0 }), 'car');
    expect(text).toBe('목적지에 도착했습니다');
  });

  it('거리 ≈0(1m 미만) maneuver는 거리 접두를 붙이지 않는다', () => {
    const text = navInstructionText(step({ maneuver: 'turn-left', distanceM: 0 }), 'car');
    expect(text).toBe('좌회전');
  });
});

describe('navInstructionText — 모드별 어휘 차이', () => {
  it('자동차와 도보는 같은 turn-left에 다른 어휘를 쓴다', () => {
    const s = step({ maneuver: 'turn-left', distanceM: 100 });
    const car = navInstructionText(s, 'car');
    const walk = navInstructionText(s, 'walk');
    expect(car).toBe('100m 앞에서 좌회전');
    expect(walk).toBe('100m 앞에서 왼쪽으로 이동');
    expect(car).not.toBe(walk);
  });

  it('자전거는 차량 어휘(자동차와 동일)를 쓴다', () => {
    const s = step({ maneuver: 'turn-right', distanceM: 50 });
    const bike = navInstructionText(s, 'bike');
    const car = navInstructionText(s, 'car');
    expect(bike).toBe(car);
  });

  it('대중교통은 보행 어휘(도보와 동일)를 쓴다', () => {
    const s = step({ maneuver: 'turn-left', distanceM: 50 });
    const transit = navInstructionText(s, 'transit');
    const walk = navInstructionText(s, 'walk');
    expect(transit).toBe(walk);
  });

  it('전 모드에서 빈 문자열을 반환하지 않는다(maneuver 보유 step)', () => {
    const modes: TravelMode[] = ['walk', 'transit', 'car', 'bike'];
    for (const mode of modes) {
      const text = navInstructionText(step({ maneuver: 'straight', distanceM: 100 }), mode);
      expect(text.length).toBeGreaterThan(0);
    }
  });
});

describe('navInstructionText — instruction 폴백', () => {
  it('maneuver 미존재 시 instruction 원문으로 폴백한다', () => {
    const text = navInstructionText(
      step({ instruction: '무교로를 따라 직진하세요.', distanceM: 300 }),
      'car',
    );
    expect(text).toBe('무교로를 따라 직진하세요.');
  });

  it("maneuver가 'unknown'이면 instruction 원문으로 폴백한다", () => {
    const text = navInstructionText(
      step({ maneuver: 'unknown', instruction: '계속 진행', distanceM: 300 }),
      'car',
    );
    expect(text).toBe('계속 진행');
  });

  it('maneuver도 instruction도 없으면 일반 문구를 반환한다', () => {
    const text = navInstructionText(step({ instruction: '', distanceM: 300 }), 'walk');
    expect(text).toBe('경로를 따라 계속 이동합니다');
  });
});
