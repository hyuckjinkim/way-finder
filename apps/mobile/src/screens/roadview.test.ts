import { describe, it, expect } from 'vitest';
import { SEOUL_CAFE, TOKYO_PLACE } from '@wayfinder/shared/mocks';
import { selectRoadviewMode } from './roadview.js';

describe('selectRoadviewMode — 한국 카카오 로드뷰 vs 글로벌 스트리트뷰', () => {
  it('한국 장소(roadview 좌표 있음)는 카카오 로드뷰', () => {
    expect(selectRoadviewMode(SEOUL_CAFE)).toBe('kakao-roadview');
  });

  it('글로벌 장소(roadview 없음)는 구글 스트리트뷰 딥링크', () => {
    expect(selectRoadviewMode(TOKYO_PLACE)).toBe('google-streetview');
  });
});
