/**
 * B1 — 경로 선호 프로필 탭 순수 로직 단위 테스트.
 */
import { describe, it, expect } from 'vitest';
import {
  PREFERENCE_TAB_ORDER,
  PREFERENCE_TAB_LABELS,
  DEFAULT_PREFERENCE_TAB,
  ENABLE_SCENIC,
  tabToPreference,
} from './routePreference.js';

describe('PREFERENCE_TAB_ORDER', () => {
  it('ENABLE_SCENIC=false 상태에서 4개 탭을 포함한다', () => {
    if (!ENABLE_SCENIC) {
      expect(PREFERENCE_TAB_ORDER).toHaveLength(4);
    }
  });

  it('fastest·walkable·safe·quiet를 포함한다', () => {
    expect(PREFERENCE_TAB_ORDER).toContain('fastest');
    expect(PREFERENCE_TAB_ORDER).toContain('walkable');
    expect(PREFERENCE_TAB_ORDER).toContain('safe');
    expect(PREFERENCE_TAB_ORDER).toContain('quiet');
  });

  it('ENABLE_SCENIC=false 상태에서 scenic을 포함하지 않는다', () => {
    if (!ENABLE_SCENIC) {
      expect(PREFERENCE_TAB_ORDER).not.toContain('scenic');
    }
  });

  it('ENABLE_SCENIC=true 상태에서 scenic을 포함한다(flag 켜지면)', () => {
    if (ENABLE_SCENIC) {
      expect(PREFERENCE_TAB_ORDER).toContain('scenic');
    }
  });
});

describe('PREFERENCE_TAB_LABELS', () => {
  it('5개 RoutePreference 모두 라벨이 있다', () => {
    const allPreferences = ['fastest', 'walkable', 'safe', 'quiet', 'scenic'] as const;
    for (const pref of allPreferences) {
      expect(PREFERENCE_TAB_LABELS[pref]).toBeTruthy();
    }
  });

  it('각 프로필별 한국어 라벨을 반환한다', () => {
    expect(PREFERENCE_TAB_LABELS['fastest']).toBe('빠른');
    expect(PREFERENCE_TAB_LABELS['walkable']).toBe('걷기좋은');
    expect(PREFERENCE_TAB_LABELS['safe']).toBe('안전');
    expect(PREFERENCE_TAB_LABELS['quiet']).toBe('한적');
    expect(PREFERENCE_TAB_LABELS['scenic']).toBe('풍경');
  });
});

describe('tabToPreference — 5개 프로필 매핑', () => {
  it('fastest 탭은 fastest preference로 매핑된다', () => {
    expect(tabToPreference('fastest')).toBe('fastest');
  });

  it('walkable 탭은 walkable preference로 매핑된다', () => {
    expect(tabToPreference('walkable')).toBe('walkable');
  });

  it('safe 탭은 safe preference로 매핑된다', () => {
    expect(tabToPreference('safe')).toBe('safe');
  });

  it('quiet 탭은 quiet preference로 매핑된다', () => {
    expect(tabToPreference('quiet')).toBe('quiet');
  });

  it('scenic 탭은 scenic preference로 매핑된다(flag 여부 무관 — 매핑 totality)', () => {
    expect(tabToPreference('scenic')).toBe('scenic');
  });

  it('렌더 탭 전체가 RouteRequest.preference로 매핑된다(PREFERENCE_TAB_ORDER 전체)', () => {
    for (const tab of PREFERENCE_TAB_ORDER) {
      expect(tabToPreference(tab)).toBe(tab);
    }
  });
});

describe('DEFAULT_PREFERENCE_TAB', () => {
  it('fastest가 기본 탭이다', () => {
    expect(DEFAULT_PREFERENCE_TAB).toBe('fastest');
  });

  it('PREFERENCE_TAB_ORDER에 포함된 유효한 탭이다', () => {
    expect(PREFERENCE_TAB_ORDER).toContain(DEFAULT_PREFERENCE_TAB);
  });
});
