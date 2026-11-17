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
export function placeDetailPath(id: string, hint?: PlaceHint): string {
  const base = `/v1/places/${encodeURIComponent(id)}`;
  if (!hint) return base;
  const qs = new URLSearchParams({ name: hint.name, lat: String(hint.coord.lat), lng: String(hint.coord.lng) });
  return `${base}?${qs}`;
}

/**
 * 카카오는 id 단건 조회 API가 없다 → 상세 요청에 검색 결과의 이름·좌표를 실어 보내고
 * 프록시가 그 근처를 키워드 검색해 id로 매칭한다.
 */
export interface PlaceHint {
  name: string;
  coord: { lat: number; lng: number };
}

/** 구글 평점·리뷰 (구글 탭 활성화 시 lazy load — §11 과금 방어선). */
export function placeGooglePath(id: string): string {
  return `/v1/places/${encodeURIComponent(id)}/google`;
}

/** 블로그 검색 경로 (쿼리스트링은 호출자가 부착: `?q=...`). */
export const blogsPath = '/v1/blogs';

/** 경로 탐색 (§8). `POST` — body `RouteRequest { stops, mode }`. */
export const routesPath = '/v1/routes';
