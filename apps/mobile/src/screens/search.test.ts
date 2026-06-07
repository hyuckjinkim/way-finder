import { describe, it, expect } from 'vitest';
import { mockPlaceProvider, SEOUL_CAFE } from '@wayfinder/shared/mocks';
import { cameraForPlace, SELECTED_PLACE_ZOOM } from './searchCamera.js';

/**
 * SearchScreen 로직 검증 (컴포넌트는 react-native 의존 → node 렌더 불가,
 * 검색 공급자 계약 + 카메라 계산 순수 로직으로 대체 검증).
 */
describe('검색 — 한국어/영어 입력 모두 결과 표시', () => {
  it('한국어 질의로 한국 장소를 찾는다', async () => {
    const results = await mockPlaceProvider.search('카페');
    expect(results.length).toBeGreaterThan(0);
    expect(results.some((p) => p.name === SEOUL_CAFE.name)).toBe(true);
  });

  it('영어 질의로 글로벌 장소를 찾는다', async () => {
    const results = await mockPlaceProvider.search('Shibuya');
    expect(results.length).toBeGreaterThan(0);
    expect(results.every((p) => p.id.length > 0)).toBe(true);
  });

  it('빈 질의는 빈 결과', async () => {
    expect(await mockPlaceProvider.search('   ')).toEqual([]);
  });
});

describe('cameraForPlace — 선택 시 핀 + 카메라 이동 타깃', () => {
  it('선택 장소 좌표 + 상세 근접 줌으로 카메라를 만든다', () => {
    const camera = cameraForPlace(SEOUL_CAFE);
    expect(camera.center).toEqual(SEOUL_CAFE.coord);
    expect(camera.zoom).toBe(SELECTED_PLACE_ZOOM);
  });
});
