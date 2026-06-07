import { describe, it, expect } from 'vitest';
import {
  SEOUL_CAFE,
  TOKYO_PLACE,
  SEARCH_RESULTS,
  PLACE_DETAILS,
} from './fixtures.js';
import { mockPlaceProvider, PlaceNotFoundError } from './provider.js';

describe('fixtures — 타입/구조 만족', () => {
  it('한국 장소(SEOUL_CAFE)는 평점·리뷰5·네이버/카카오 블로그·로드뷰 포함', () => {
    expect(SEOUL_CAFE.id.startsWith('kakao:')).toBe(true);
    expect(SEOUL_CAFE.rating?.source).toBe('google');
    expect(SEOUL_CAFE.reviews).toHaveLength(5);
    expect(SEOUL_CAFE.blogs.naver.length).toBeGreaterThan(0);
    expect(SEOUL_CAFE.blogs.kakao.length).toBeGreaterThan(0);
    expect(SEOUL_CAFE.roadview).toBeDefined();
  });

  it('글로벌 장소(TOKYO_PLACE)는 로드뷰 없음, 블로그 비어 있음', () => {
    expect(TOKYO_PLACE.id.startsWith('google:')).toBe(true);
    expect(TOKYO_PLACE.roadview).toBeUndefined();
    expect(TOKYO_PLACE.blogs.naver).toHaveLength(0);
    expect(TOKYO_PLACE.blogs.kakao).toHaveLength(0);
  });

  it('검색 결과 리스트는 한국 + 글로벌을 모두 포함', () => {
    expect(SEARCH_RESULTS.length).toBeGreaterThanOrEqual(2);
    expect(SEARCH_RESULTS.some((p) => p.id.startsWith('kakao:'))).toBe(true);
    expect(SEARCH_RESULTS.some((p) => p.id.startsWith('google:'))).toBe(true);
  });

  it('PLACE_DETAILS 색인은 검색 가능한 상세를 포함', () => {
    expect(PLACE_DETAILS[SEOUL_CAFE.id]).toBe(SEOUL_CAFE);
    expect(PLACE_DETAILS[TOKYO_PLACE.id]).toBe(TOKYO_PLACE);
  });
});

describe('mockPlaceProvider — PlaceProvider 계약', () => {
  it('한국어 질의로 검색', async () => {
    const results = await mockPlaceProvider.search('카페');
    expect(results.length).toBeGreaterThan(0);
    expect(results.every((p) => p.category.includes('카페'))).toBe(true);
  });

  it('영어 질의로 검색', async () => {
    const results = await mockPlaceProvider.search('Cafe');
    expect(results.some((p) => p.id === TOKYO_PLACE.id)).toBe(true);
  });

  it('빈 질의는 빈 결과', async () => {
    expect(await mockPlaceProvider.search('   ')).toHaveLength(0);
  });

  it('getDetail은 id로 상세 반환', async () => {
    const detail = await mockPlaceProvider.getDetail(SEOUL_CAFE.id);
    expect(detail.name).toBe(SEOUL_CAFE.name);
  });

  it('없는 id는 PlaceNotFoundError', async () => {
    await expect(mockPlaceProvider.getDetail('kakao:000')).rejects.toBeInstanceOf(
      PlaceNotFoundError,
    );
  });
});
