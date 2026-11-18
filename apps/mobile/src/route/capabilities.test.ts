import { describe, it, expect } from 'vitest';
import { availableModes, showWalkPreferences } from './capabilities.js';

const CAPS = { modes: { kr: ['walk', 'transit'], global: ['walk'] }, walkPreferences: false };

describe('availableModes', () => {
  it('capabilities 없음(조회 실패) → 전 모드', () => {
    expect(availableModes(undefined, 'kr')).toEqual(['walk', 'transit', 'car', 'bike']);
  });
  it('지역별로 지원 모드만', () => {
    expect(availableModes(CAPS, 'kr')).toEqual(['walk', 'transit']);
    expect(availableModes(CAPS, 'global')).toEqual(['walk']);
  });
  it('지역 미정 → 합집합', () => {
    expect(availableModes(CAPS, undefined)).toEqual(['walk', 'transit']);
  });
  it('지원 모드가 비어 있으면 탭을 비우지 않고 전 모드', () => {
    expect(availableModes({ modes: { kr: [], global: [] }, walkPreferences: false }, 'kr')).toHaveLength(4);
  });
});

describe('showWalkPreferences', () => {
  it('도보 + walkPreferences일 때만', () => {
    expect(showWalkPreferences({ ...CAPS, walkPreferences: true }, 'walk')).toBe(true);
    expect(showWalkPreferences({ ...CAPS, walkPreferences: true }, 'transit')).toBe(false);
    expect(showWalkPreferences(CAPS, 'walk')).toBe(false);
    expect(showWalkPreferences(undefined, 'walk')).toBe(false);
  });
});
