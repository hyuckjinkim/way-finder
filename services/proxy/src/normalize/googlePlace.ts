/**
 * Google Places API v1 (New) 응답 → 정규화 Review / Rating 변환.
 *
 * 주요 특징:
 * - text는 LocalizedText: { text: string; languageCode: string }
 * - authorAttribution.displayName 이 저자명, .uri 가 저자 URL
 * - publishTime은 RFC 3339 (ISO 8601)
 * - location: { latitude, longitude }
 * - id 프리픽스: "google:{id}"
 */
import type { Place, PlaceDetail, Rating, Review } from '@wayfinder/shared';

/** Google Places v1 LocalizedText */
interface LocalizedText {
  text: string;
  languageCode: string;
}

/** Google Places v1 AuthorAttribution */
interface AuthorAttribution {
  displayName: string;
  uri: string;
  photoUri: string;
}

/** Google Places v1 Review 원시 타입 */
export interface GoogleReviewRaw {
  name?: string;
  relativePublishTimeDescription?: string;
  text: LocalizedText;
  originalText?: LocalizedText;
  rating: number;
  authorAttribution: AuthorAttribution;
  publishTime: string;
}

/** Google Places v1 Place 원시 타입 (필요 필드만) */
export interface GooglePlaceRaw {
  name: string;        // "places/{id}"
  id: string;
  displayName: LocalizedText;
  formattedAddress: string;
  location: { latitude: number; longitude: number };
  rating?: number;
  userRatingCount?: number;
  reviews?: GoogleReviewRaw[];
}

/** Google Review raw → 정규화 Review */
export function normalizeGoogleReview(raw: GoogleReviewRaw): Review {
  return {
    author: raw.authorAttribution.displayName,
    rating: raw.rating,
    text: raw.text.text,
    time: raw.publishTime,
    authorUrl: raw.authorAttribution.uri || undefined,
  };
}

/** Google Place raw → 정규화 Rating (없으면 undefined) */
export function normalizeGoogleRating(raw: GooglePlaceRaw): Rating | undefined {
  if (!raw.rating || !raw.userRatingCount) return undefined;
  return { score: raw.rating, count: raw.userRatingCount, source: 'google' };
}

/**
 * Google Place raw → 정규화 Place (검색 결과용).
 * 구글 검색 결과를 Place 타입으로 변환. id 프리픽스 "google:{id}".
 */
export function normalizeGooglePlace(raw: GooglePlaceRaw): Place {
  return {
    id: `google:${raw.id}`,
    name: raw.displayName.text,
    coord: { lat: raw.location.latitude, lng: raw.location.longitude },
    category: 'Place',
    address: raw.formattedAddress,
  };
}

/**
 * Google Place raw → 정규화 PlaceDetail (리뷰 최대 5개).
 * googleMaps 딥링크는 place_id 기반.
 */
export function normalizeGooglePlaceDetail(raw: GooglePlaceRaw): PlaceDetail {
  const reviews = (raw.reviews ?? []).slice(0, 5).map(normalizeGoogleReview);
  return {
    ...normalizeGooglePlace(raw),
    reviews,
    rating: normalizeGoogleRating(raw),
    blogs: { naver: [], kakao: [] },
    links: {
      googleMaps: `https://maps.google.com/?cid=${raw.id}`,
    },
  };
}
