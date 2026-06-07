import { describe, it, expect } from 'vitest';
import {
  selectRenderer,
  KOREA_BBOX,
  HYSTERESIS_DEG,
  GLOBAL_ZOOM_THRESHOLD,
} from './koreaBbox.js';
import type { LatLng } from '../types/geo.js';

const SEOUL: LatLng = { lat: 37.5665, lng: 126.978 };
const TOKYO: LatLng = { lat: 35.6762, lng: 139.6503 };
const HIGH_ZOOM = 12;

describe('selectRenderer — core bbox', () => {
  it('서울(코어 내부)은 한국', () => {
    expect(selectRenderer(SEOUL, HIGH_ZOOM, 'global')).toBe('korea');
  });

  it('도쿄(코어 외부)는 글로벌', () => {
    expect(selectRenderer(TOKYO, HIGH_ZOOM, 'global')).toBe('global');
  });

  it('current 미지정 시 코어 기준 초기 판정', () => {
    expect(selectRenderer(SEOUL, HIGH_ZOOM)).toBe('korea');
    expect(selectRenderer(TOKYO, HIGH_ZOOM)).toBe('global');
  });
});

describe('selectRenderer — 경계', () => {
  it('코어 bbox 모서리(포함)는 한국', () => {
    const corner: LatLng = { lat: KOREA_BBOX.maxLat, lng: KOREA_BBOX.maxLng };
    expect(selectRenderer(corner, HIGH_ZOOM, 'global')).toBe('korea');
  });

  it('코어 bbox 바로 바깥(완충 진입 전, global 상태)은 글로벌', () => {
    // 코어를 막 벗어났지만 완충지대 안 — global 상태에서는 아직 한국 아님.
    const justOutside: LatLng = {
      lat: KOREA_BBOX.maxLat + HYSTERESIS_DEG / 2,
      lng: 128.0,
    };
    expect(selectRenderer(justOutside, HIGH_ZOOM, 'global')).toBe('global');
  });
});

describe('selectRenderer — 히스테리시스 완충지대', () => {
  it('한국 상태에서 완충지대 내부면 한국 유지(깜빡임 방지)', () => {
    const inBuffer: LatLng = {
      lat: KOREA_BBOX.maxLat + HYSTERESIS_DEG / 2,
      lng: 128.0,
    };
    expect(selectRenderer(inBuffer, HIGH_ZOOM, 'korea')).toBe('korea');
  });

  it('한국 상태에서 완충지대를 완전히 벗어나면 글로벌로 전환', () => {
    const outsideBuffer: LatLng = {
      lat: KOREA_BBOX.maxLat + HYSTERESIS_DEG + 0.1,
      lng: 128.0,
    };
    expect(selectRenderer(outsideBuffer, HIGH_ZOOM, 'korea')).toBe('global');
  });

  it('완충지대 동일 좌표가 직전 상태에 따라 다르게 판정(히스테리시스)', () => {
    const inBuffer: LatLng = {
      lat: KOREA_BBOX.maxLat + HYSTERESIS_DEG / 2,
      lng: 128.0,
    };
    // 한국에서 진입 → 유지, 글로벌에서 진입 → 글로벌 (코어 미진입).
    expect(selectRenderer(inBuffer, HIGH_ZOOM, 'korea')).toBe('korea');
    expect(selectRenderer(inBuffer, HIGH_ZOOM, 'global')).toBe('global');
  });
});

describe('selectRenderer — 저줌 강제 글로벌', () => {
  it('줌 < 6이면 서울이라도 글로벌', () => {
    expect(selectRenderer(SEOUL, GLOBAL_ZOOM_THRESHOLD - 1, 'korea')).toBe(
      'global',
    );
    expect(selectRenderer(SEOUL, 0, 'korea')).toBe('global');
  });

  it('줌 == 6(임계값)이면 정상 판정(서울=한국)', () => {
    expect(selectRenderer(SEOUL, GLOBAL_ZOOM_THRESHOLD, 'global')).toBe('korea');
  });
});
