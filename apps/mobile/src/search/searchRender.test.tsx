import { describe, it, expect } from 'vitest';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { SearchScreen, SEARCH_PLACEHOLDER } from '../screens/SearchScreen.js';

describe('SearchScreen 렌더 (SSR)', () => {
  it('통일된 placeholder로 렌더되고 빈 입력에선 최근 검색 영역을 보인다', () => {
    const html = renderToStaticMarkup(<SearchScreen onCancel={() => {}} />);
    expect(SEARCH_PLACEHOLDER).toBe('장소·주소 검색');
    expect(html).toContain('placeholder="장소·주소 검색"');
    expect(html).toContain('최근 검색 기록이 없어요.');
  });
});

describe('SearchScreen 저장한 장소 (SSR)', () => {
  it('SSR은 저장 목록 없이 굽는다(하이드레이션 후 채움) — 저장 섹션 제목 없음', () => {
    const html = renderToStaticMarkup(<SearchScreen onCancel={() => {}} />);
    expect(html).not.toContain('저장한 장소');
  });
});
