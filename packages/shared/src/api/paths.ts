/**
 * 프록시 API 경로의 단일 진실 소스 (§7·§11).
 *
 * 모바일 클라이언트(PlaceService)와 프록시 통합 테스트가 동일한 빌더를 사용해
 * 경로 드리프트(클라이언트가 호출하는 경로 ≠ 프록시가 등록한 경로)를 방지한다.
 *
 * 쿼리스트링이 필요한 경로는 호출자가 별도로 덧붙인다 (예: search).
 */

/** 장소 검색 경로 (쿼리스트링은 호출자가 부착: `?q=...`). */
export const placesSearchPath = '/v1/places/search';

/** 장소 상세 — 기본정보 + 블로그 (구글 평점·리뷰 미포함, lazy). */
export function placeDetailPath(id: string): string {
  return `/v1/places/${encodeURIComponent(id)}`;
}

/** 구글 평점·리뷰 (구글 탭 활성화 시 lazy load — §11 과금 방어선). */
export function placeGooglePath(id: string): string {
  return `/v1/places/${encodeURIComponent(id)}/google`;
}

/** 블로그 검색 경로 (쿼리스트링은 호출자가 부착: `?q=...`). */
export const blogsPath = '/v1/blogs';
