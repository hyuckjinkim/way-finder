/**
 * A1 정규화 함수 단위 테스트.
 * 각 공급자 raw 픽스처 → Place/PlaceDetail/BlogPost 변환 검증.
 */
import { describe, it, expect } from 'vitest';

import {
  normalizeKakaoPlace,
  normalizeKakaoPlaceDetail,
} from './kakaoPlace.js';
import {
  normalizeGoogleReview,
  normalizeGoogleRating,
  normalizeGooglePlace,
  normalizeGooglePlaceDetail,
} from './googlePlace.js';
import {
  normalizeNaverBlogItem,
  normalizeNaverBlogResponse,
} from './naverBlog.js';
import {
  normalizeKakaoBlogDocument,
  normalizeKakaoBlogResponse,
} from './kakaoBlog.js';

import { KAKAO_LOCAL_SEARCH_RAW } from '../fixtures/kakaoLocal.js';
import { GOOGLE_PLACE_DETAIL_RAW, GOOGLE_PLACE_NO_REVIEWS_RAW } from '../fixtures/googlePlaces.js';
import { NAVER_BLOG_SEARCH_RAW, NAVER_BLOG_EMPTY_RAW } from '../fixtures/naverBlog.js';
import { KAKAO_BLOG_SEARCH_RAW, KAKAO_BLOG_EMPTY_RAW } from '../fixtures/kakaoBlog.js';

// ─── 카카오 Local ────────────────────────────────────────────────────────────

describe('normalizeKakaoPlace', () => {
  const doc = KAKAO_LOCAL_SEARCH_RAW.documents[0]!;

  it('id에 "kakao:" 프리픽스가 붙는다', () => {
    const place = normalizeKakaoPlace(doc);
    expect(place.id).toBe('kakao:26338954');
  });

  it('x=lng, y=lat 좌표 스왑 — lat/lng 값이 올바르게 매핑된다', () => {
    const place = normalizeKakaoPlace(doc);
    expect(place.coord.lat).toBeCloseTo(37.5563);
    expect(place.coord.lng).toBeCloseTo(126.9723);
  });

  it('category_name 마지막 세그먼트를 category로 쓴다 ("음식점 > 카페 > 커피전문점" → "커피전문점")', () => {
    const place = normalizeKakaoPlace(doc);
    expect(place.category).toBe('커피전문점');
  });

  it('road_address_name이 있으면 address에 사용한다', () => {
    const place = normalizeKakaoPlace(doc);
    expect(place.address).toBe('서울특별시 중구 통일로 1');
  });

  it('name이 place_name과 일치한다', () => {
    const place = normalizeKakaoPlace(doc);
    expect(place.name).toBe('안목해변 커피거리 서울점');
  });
});

describe('normalizeKakaoPlaceDetail', () => {
  const doc = KAKAO_LOCAL_SEARCH_RAW.documents[0]!;

  it('PlaceDetail 기본 구조를 반환한다', () => {
    const detail = normalizeKakaoPlaceDetail(doc);
    expect(detail.id).toBe('kakao:26338954');
    expect(detail.reviews).toEqual([]);
    expect(detail.blogs).toEqual({ naver: [], kakao: [] });
    expect(detail.rating).toBeUndefined();
  });

  it('phone 필드를 포함한다', () => {
    const detail = normalizeKakaoPlaceDetail(doc);
    expect(detail.phone).toBe('02-1234-5678');
  });

  it('links.kakaoMap을 포함한다', () => {
    const detail = normalizeKakaoPlaceDetail(doc);
    expect(detail.links.kakaoMap).toBeDefined();
  });

  it('한국 장소이므로 roadview 좌표가 존재한다', () => {
    const detail = normalizeKakaoPlaceDetail(doc);
    expect(detail.roadview).toBeDefined();
    expect(detail.roadview?.lat).toBeCloseTo(37.5563);
  });
});

// ─── Google Places ───────────────────────────────────────────────────────────

describe('normalizeGoogleReview', () => {
  const raw = GOOGLE_PLACE_DETAIL_RAW.reviews[0]!;

  it('text.text에서 리뷰 본문을 추출한다', () => {
    const review = normalizeGoogleReview(raw);
    expect(review.text).toBe('Great view of the crossing. Coffee is decent.');
  });

  it('authorAttribution.displayName을 author로 쓴다', () => {
    const review = normalizeGoogleReview(raw);
    expect(review.author).toBe('Akira T.');
  });

  it('publishTime을 time으로 그대로 복사한다', () => {
    const review = normalizeGoogleReview(raw);
    expect(review.time).toBe('2026-05-20T03:15:00Z');
  });

  it('rating을 숫자로 복사한다', () => {
    const review = normalizeGoogleReview(raw);
    expect(review.rating).toBe(4);
  });

  it('authorAttribution.uri를 authorUrl로 쓴다', () => {
    const review = normalizeGoogleReview(raw);
    expect(review.authorUrl).toBe('https://maps.google.com/maps/contrib/1001');
  });
});

describe('normalizeGoogleRating', () => {
  it('rating과 userRatingCount가 있으면 Rating을 반환한다', () => {
    const rating = normalizeGoogleRating(GOOGLE_PLACE_DETAIL_RAW);
    expect(rating).toEqual({ score: 4.2, count: 856, source: 'google' });
  });

  it('rating이 0이면 undefined를 반환한다', () => {
    const rating = normalizeGoogleRating(GOOGLE_PLACE_NO_REVIEWS_RAW);
    expect(rating).toBeUndefined();
  });
});

describe('normalizeGooglePlace', () => {
  it('id에 "google:" 프리픽스가 붙는다', () => {
    const place = normalizeGooglePlace(GOOGLE_PLACE_DETAIL_RAW);
    expect(place.id).toBe('google:ChIJ51cu8IcbXWARiRtXIothAS4');
  });

  it('location.latitude/longitude가 coord.lat/lng로 매핑된다', () => {
    const place = normalizeGooglePlace(GOOGLE_PLACE_DETAIL_RAW);
    expect(place.coord.lat).toBeCloseTo(35.6595);
    expect(place.coord.lng).toBeCloseTo(139.7005);
  });

  it('displayName.text를 name으로 쓴다', () => {
    const place = normalizeGooglePlace(GOOGLE_PLACE_DETAIL_RAW);
    expect(place.name).toBe('Shibuya Crossing Cafe');
  });
});

describe('normalizeGooglePlaceDetail', () => {
  it('리뷰를 최대 5개로 제한한다', () => {
    const detail = normalizeGooglePlaceDetail(GOOGLE_PLACE_DETAIL_RAW);
    expect(detail.reviews.length).toBeLessThanOrEqual(5);
    expect(detail.reviews.length).toBe(3);
  });

  it('리뷰가 없는 장소는 빈 배열을 반환한다', () => {
    const detail = normalizeGooglePlaceDetail(GOOGLE_PLACE_NO_REVIEWS_RAW);
    expect(detail.reviews).toEqual([]);
    expect(detail.rating).toBeUndefined();
  });

  it('links.googleMaps를 포함한다', () => {
    const detail = normalizeGooglePlaceDetail(GOOGLE_PLACE_DETAIL_RAW);
    expect(detail.links.googleMaps).toContain('ChIJ51cu8IcbXWARiRtXIothAS4');
  });
});

// ─── 네이버 블로그 ───────────────────────────────────────────────────────────

describe('normalizeNaverBlogItem', () => {
  const item = NAVER_BLOG_SEARCH_RAW.items[0]!;

  it('<b> HTML 태그를 제거한다', () => {
    const post = normalizeNaverBlogItem(item);
    expect(post.title).not.toContain('<b>');
    expect(post.title).not.toContain('</b>');
    expect(post.snippet).not.toContain('<b>');
  });

  it('title에서 태그 제거 후 텍스트가 남는다', () => {
    const post = normalizeNaverBlogItem(item);
    expect(post.title).toBe('서울 중구 분위기 좋은 카페 다녀왔어요');
  });

  it('postdate "YYYYMMDD" → "YYYY-MM-DD" 변환', () => {
    const post = normalizeNaverBlogItem(item);
    expect(post.postDate).toBe('2026-05-01');
  });

  it('bloggername을 bloggerName으로 쓴다', () => {
    const post = normalizeNaverBlogItem(item);
    expect(post.bloggerName).toBe('커피러버');
  });

  it('link를 url로 복사한다', () => {
    const post = normalizeNaverBlogItem(item);
    expect(post.url).toBe('https://blog.naver.com/example/223456789');
  });
});

describe('normalizeNaverBlogResponse', () => {
  it('items 전체를 변환한다', () => {
    const posts = normalizeNaverBlogResponse(NAVER_BLOG_SEARCH_RAW);
    expect(posts).toHaveLength(2);
  });

  it('빈 items → 빈 배열', () => {
    const posts = normalizeNaverBlogResponse(NAVER_BLOG_EMPTY_RAW);
    expect(posts).toEqual([]);
  });
});

// ─── 카카오 블로그 ───────────────────────────────────────────────────────────

describe('normalizeKakaoBlogDocument', () => {
  const doc = KAKAO_BLOG_SEARCH_RAW.documents[0]!;

  it('<b> HTML 태그를 제거한다', () => {
    const post = normalizeKakaoBlogDocument(doc);
    expect(post.title).not.toContain('<b>');
    expect(post.snippet).not.toContain('<b>');
  });

  it('title에서 태그 제거 후 텍스트가 남는다', () => {
    const post = normalizeKakaoBlogDocument(doc);
    expect(post.title).toBe('[서울카페] 작업하기 좋은 조용한 카페 추천');
  });

  it('ISO 8601 datetime → "YYYY-MM-DD" 날짜 추출', () => {
    const post = normalizeKakaoBlogDocument(doc);
    expect(post.postDate).toBe('2026-04-30');
  });

  it('blogname을 bloggerName으로 쓴다', () => {
    const post = normalizeKakaoBlogDocument(doc);
    expect(post.bloggerName).toBe('디지털노마드김씨');
  });

  it('url을 그대로 복사한다', () => {
    const post = normalizeKakaoBlogDocument(doc);
    expect(post.url).toBe('https://example.tistory.com/142');
  });
});

describe('normalizeKakaoBlogResponse', () => {
  it('documents 전체를 변환한다', () => {
    const posts = normalizeKakaoBlogResponse(KAKAO_BLOG_SEARCH_RAW);
    expect(posts).toHaveLength(2);
  });

  it('빈 documents → 빈 배열', () => {
    const posts = normalizeKakaoBlogResponse(KAKAO_BLOG_EMPTY_RAW);
    expect(posts).toEqual([]);
  });
});
