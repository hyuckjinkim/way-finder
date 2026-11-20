/**
 * D2 — PlaceService.
 *
 * `PlaceProvider` 계약(`search` / `getDetail` / `getGoogleData`)을 구현한다.
 * - 데모 모드: @wayfinder/shared/mocks 의 mockPlaceProvider 위임.
 * - 실 모드: apiClient.apiFetch → 프록시 호출.
 *
 * 두 모드 모두 동일한 인터페이스를 노출하므로 호출자(queries.ts)는 모드를 신경 쓰지 않는다.
 *
 * lazy-google 설계:
 *   getDetail → 기본 정보 + 블로그 (구글 평점·리뷰 미포함)
 *   getGoogleData → 구글 평점·리뷰만 (구글 탭 활성화 시 단독 호출)
 * 이렇게 분리해야 §11 과금 방어선(구글 탭 열기 전 구글 호출 없음)이 서비스 레이어에서 보장된다.
 */
import type { BBox, LatLng, Place, PlaceDetail, Rating, Review } from '@wayfinder/shared';
import {
  placesSearchPath,
  placesCategoryPath,
  geoReversePath,
  placeDetailPath,
  placeGooglePath,
  PLACE_CATEGORY_CODES,
  type PlaceCategoryCode,
  type PlaceHint,
  type ReverseGeocode,
} from '@wayfinder/shared/api';
import { mockPlaceProvider } from '@wayfinder/shared/mocks';
import { apiFetch, isDemoMode } from './apiClient.js';

/** 구글 탭 데이터 — 평점 + 리뷰 (lazy load 대상). */
export interface GooglePlaceData {
  rating?: Rating;
  reviews: Review[];
}

/** 검색 요청 경로 — near(지도 중심·GPS)가 있으면 프록시가 거리순·거리값을 채운다. */
export function searchPath(query: string, near?: LatLng): string {
  const base = `${placesSearchPath}?q=${encodeURIComponent(query)}`;
  return near ? `${base}&lat=${near.lat}&lng=${near.lng}` : base;
}

/** 검색 결과 반환. */
export async function search(query: string, near?: LatLng): Promise<Place[]> {
  if (isDemoMode) {
    return mockPlaceProvider.search(query);
  }
  const data = await apiFetch(searchPath(query, near));
  return data as Place[];
}

/**
 * 장소 기본 정보 + 블로그를 반환한다.
 * 실 모드에서 구글 평점·리뷰는 포함하지 않는다(lazy — getGoogleData 별도 호출).
 * 데모 모드에서는 fixture 전체 반환(테스트·UI 확인용 — 구글 데이터 포함).
 */
export async function getDetail(id: string, hint?: PlaceHint): Promise<PlaceDetail> {
  if (isDemoMode) {
    return mockPlaceProvider.getDetail(id);
  }
  // 카카오는 id 단건 조회가 없어 프록시가 이름·좌표 힌트로 찾는다(힌트 없으면 캐시된 장소만).
  const data = await apiFetch(placeDetailPath(id, hint));
  return data as PlaceDetail;
}

/**
 * 구글 평점·리뷰를 반환한다 (구글 탭 활성화 시에만 호출).
 * 데모 모드에서는 fixture의 rating/reviews를 추출해 반환한다.
 */
export async function getGoogleData(id: string): Promise<GooglePlaceData> {
  if (isDemoMode) {
    const detail = await mockPlaceProvider.getDetail(id);
    return { rating: detail.rating, reviews: detail.reviews };
  }
  const data = await apiFetch(placeGooglePath(id));
  return data as GooglePlaceData;
}

const fix6 = (v: number): string => v.toFixed(6);

/** 카테고리 검색 경로 — 보이는 지도 영역(rect, 카카오 x=경도 순서) + 중심(거리값용). */
export function categoryPath(code: PlaceCategoryCode, bounds: BBox): string {
  const { sw, ne } = bounds;
  const qs = new URLSearchParams({
    code,
    rect: [sw.lng, sw.lat, ne.lng, ne.lat].map(fix6).join(','),
    x: fix6((sw.lng + ne.lng) / 2),
    y: fix6((sw.lat + ne.lat) / 2),
  });
  return `${placesCategoryPath}?${qs}`;
}

/** 지도 영역 안의 카테고리 장소(최대 15). */
export async function searchCategory(code: PlaceCategoryCode, bounds: BBox): Promise<Place[]> {
  if (isDemoMode) {
    return mockPlaceProvider.search(PLACE_CATEGORY_CODES[code]);
  }
  return (await apiFetch(categoryPath(code, bounds))) as Place[];
}

/** 좌표 → 주소 라벨(없으면 null). */
export async function reverseGeocode(coord: LatLng): Promise<string | null> {
  if (isDemoMode) return null;
  const data = (await apiFetch(`${geoReversePath}?lat=${fix6(coord.lat)}&lng=${fix6(coord.lng)}`)) as ReverseGeocode;
  return data.label;
}
