/**
 * C3 — 이동 수단 탭 순수 로직 단위 테스트.
 */
import { describe, it, expect } from 'vitest';
import {
  MODE_TAB_ORDER,
  MODE_TAB_LABELS,
  DEFAULT_MODE_TAB,
  tabToMode,
} from './modeTabs.js';

describe('MODE_TAB_ORDER', () => {
  it('4개 모드를 모두 포함한다', () => {
    expect(MODE_TAB_ORDER).toHaveLength(4);
  });

  it('walk·transit·car·bike를 포함한다', () => {
    expect(MODE_TAB_ORDER).toContain('walk');
    expect(MODE_TAB_ORDER).toContain('transit');
    expect(MODE_TAB_ORDER).toContain('car');
    expect(MODE_TAB_ORDER).toContain('bike');
  });
});

describe('MODE_TAB_LABELS', () => {
  it('4개 모드 모두 라벨이 있다', () => {
    for (const tab of MODE_TAB_ORDER) {
      expect(MODE_TAB_LABELS[tab]).toBeTruthy();
    }
  });

  it('각 모드별 한국어 라벨을 반환한다', () => {
    expect(MODE_TAB_LABELS['walk']).toBe('도보');
    expect(MODE_TAB_LABELS['transit']).toBe('대중교통');
    expect(MODE_TAB_LABELS['car']).toBe('자동차');
    expect(MODE_TAB_LABELS['bike']).toBe('자전거');
  });
});

describe('tabToMode — 4모드 매핑', () => {
  it('walk 탭은 walk 모드로 매핑된다', () => {
    expect(tabToMode('walk')).toBe('walk');
  });

  it('transit 탭은 transit 모드로 매핑된다', () => {
    expect(tabToMode('transit')).toBe('transit');
  });

  it('car 탭은 car 모드로 매핑된다', () => {
    expect(tabToMode('car')).toBe('car');
  });

  it('bike 탭은 bike 모드로 매핑된다', () => {
    expect(tabToMode('bike')).toBe('bike');
  });

  it('모든 탭이 RouteRequest.mode로 매핑된다(MODE_TAB_ORDER 전체)', () => {
    for (const tab of MODE_TAB_ORDER) {
      expect(tabToMode(tab)).toBe(tab);
    }
  });
});

describe('DEFAULT_MODE_TAB', () => {
  it('MODE_TAB_ORDER에 포함된 유효한 탭이다', () => {
    expect(MODE_TAB_ORDER).toContain(DEFAULT_MODE_TAB);
  });
});
