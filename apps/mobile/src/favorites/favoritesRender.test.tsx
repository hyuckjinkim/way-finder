import { describe, it, expect } from 'vitest';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { SEOUL_CAFE, PLACE_DETAILS } from '@wayfinder/shared/mocks';
import { PlaceDetailSheet } from '../screens/PlaceDetailSheet.js';

describe('PlaceDetailSheet 저장 (SSR)', () => {
  it('저장 토글을 접근성 이름과 함께 렌더하고, 공유 수단이 없으면 공유 버튼을 숨긴다', () => {
    const html = renderToStaticMarkup(<PlaceDetailSheet detail={PLACE_DETAILS[SEOUL_CAFE.id]!} />);
    expect(html).toContain('aria-label="장소 저장"');
    expect(html).toContain('☆ 저장');
    expect(html).not.toContain('aria-label="장소 공유"');
  });
});
