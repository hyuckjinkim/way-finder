/** HomeScreen Wave C — 칩·재검색·결과 목록(F5), 길게 누르기 팝업(F6), 레이어 버튼(F7). SSR 문자열 렌더(폰 폭). */
import { describe, it, expect } from 'vitest';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { HomeScreen } from './HomeScreen.js';

const render = (el: React.ReactElement): string => renderToStaticMarkup(el);
const cafe = { id: 'kakao:1', name: '카페A', coord: { lat: 37.5, lng: 127 }, category: '카페', address: '서울 길 1', distanceM: 120 };

describe('HomeScreen — 카테고리(F5)', () => {
  it('검색바 아래 칩과 레이어 버튼을 렌더한다', () => {
    const html = render(<HomeScreen />);
    for (const label of ['카페', '편의점', '음식점', '약국', '주차장', '지하철역']) {
      expect(html).toContain(`aria-label="${label} 찾기"`);
    }
    expect(html).toContain('aria-label="지도 레이어"');
    expect(html).not.toContain('이 지역 재검색');
  });

  it('결과가 오면 목록(거리·분류)과 닫기, 지도를 옮겼으면 재검색 버튼', () => {
    const html = render(
      <HomeScreen activeCategory="CE7" categoryStatus="ready" categoryPlaces={[cafe]} canResearch />,
    );
    expect(html).toContain('카페 1곳');
    expect(html).toContain('aria-label="카페A"');
    expect(html).toContain('120m');
    expect(html).toContain('aria-label="카테고리 닫기"');
    expect(html).toContain('aria-label="이 지역 재검색"');
  });

  it('장소 시트가 떠 있으면(peek) 목록·재검색은 숨긴다', () => {
    const html = render(
      <HomeScreen panel="peek" activeCategory="CE7" categoryStatus="ready" categoryPlaces={[cafe]} canResearch />,
    );
    expect(html).not.toContain('aria-label="카페A"');
    expect(html).not.toContain('이 지역 재검색');
  });
});

describe('HomeScreen — 길게 누르기 팝업(F6)', () => {
  it('주소와 출발·도착 버튼, 주소가 없으면 좌표', () => {
    const coord = { lat: 37.56651, lng: 126.97801 };
    const withLabel = render(<HomeScreen pressed={{ coord, label: '서울특별시청', loading: false }} />);
    expect(withLabel).toContain('서울특별시청');
    expect(withLabel).toContain('aria-label="여기서 출발"');
    expect(withLabel).toContain('aria-label="여기로 도착"');
    expect(render(<HomeScreen pressed={{ coord, label: null, loading: false }} />)).toContain('37.56651, 126.97801');
    expect(render(<HomeScreen pressed={{ coord, label: null, loading: true }} />)).toContain('주소 찾는 중');
  });
});
