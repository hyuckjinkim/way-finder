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

/** 지원 이동수단 — 프록시가 보유 키로 판정. 앱은 미지원 모드 탭을 숨긴다. */
export const capabilitiesPath = '/v1/capabilities';

/** `GET capabilitiesPath` 응답. 지역별 실제 경로를 낼 수 있는 모드 목록. */
export interface Capabilities {
  modes: { kr: string[]; global: string[] };
  /** 도보 선호(걷기 좋은·안전·한적) — Valhalla가 있어야 동작. */
  walkPreferences: boolean;
}

/**
 * 카테고리 장소 검색 (F5) — `?code=CE7&rect=minX,minY,maxX,maxY[&x=&y=]` 또는 `?code=CE7&x=&y=&radius=`.
 * x=경도, y=위도(카카오 순서). 응답은 `Place[]`.
 */
export const placesCategoryPath = '/v1/places/category';

/** 카카오 category_group_code → 이름 (공식 18종). 프록시가 이 목록으로 code를 검증한다. */
export const PLACE_CATEGORY_CODES = {
  MT1: '대형마트',
  CS2: '편의점',
  PS3: '어린이집, 유치원',
  SC4: '학교',
  AC5: '학원',
  PK6: '주차장',
  OL7: '주유소, 충전소',
  SW8: '지하철역',
  BK9: '은행',
  CT1: '문화시설',
  AG2: '중개업소',
  PO3: '공공기관',
  AT4: '관광명소',
  AD5: '숙박',
  FD6: '음식점',
  CE7: '카페',
  HP8: '병원',
  PM9: '약국',
} as const;
export type PlaceCategoryCode = keyof typeof PLACE_CATEGORY_CODES;

/** 좌표 → 주소 (F6 길게 누르기) — `?lat=&lng=`. 응답 `ReverseGeocode`. */
export const geoReversePath = '/v1/geo/reverse';

/** `GET geoReversePath` 응답. 주소가 없으면(바다·해외) label=null. */
export interface ReverseGeocode {
  label: string | null;
}
