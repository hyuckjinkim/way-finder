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
import type { Place, PlaceDetail, Rating, Review } from '@wayfinder/shared';
import { mockPlaceProvider } from '@wayfinder/shared/mocks';
import { apiFetch, isDemoMode } from './apiClient.js';

/** 구글 탭 데이터 — 평점 + 리뷰 (lazy load 대상). */
export interface GooglePlaceData {
  rating?: Rating;
  reviews: Review[];
}

/** 검색 결과 반환. */
export async function search(query: string): Promise<Place[]> {
  if (isDemoMode) {
    return mockPlaceProvider.search(query);
  }
  const encoded = encodeURIComponent(query);
  const data = await apiFetch(`/v1/places/search?q=${encoded}`);
  return data as Place[];
}

/**
 * 장소 기본 정보 + 블로그를 반환한다.
 * 실 모드에서 구글 평점·리뷰는 포함하지 않는다(lazy — getGoogleData 별도 호출).
 * 데모 모드에서는 fixture 전체 반환(테스트·UI 확인용 — 구글 데이터 포함).
 */
export async function getDetail(id: string): Promise<PlaceDetail> {
  if (isDemoMode) {
    return mockPlaceProvider.getDetail(id);
  }
  const data = await apiFetch(`/v1/places/${encodeURIComponent(id)}`);
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
  const data = await apiFetch(
    `/v1/places/${encodeURIComponent(id)}/google`,
  );
  return data as GooglePlaceData;
}
