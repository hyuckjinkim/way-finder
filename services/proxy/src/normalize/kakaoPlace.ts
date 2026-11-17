/**
 * 카카오 Local API 응답 → 정규화 Place / PlaceDetail 변환.
 *
 * 주의사항:
 * - x = longitude(경도), y = latitude(위도) — 일반적 순서와 반대
 * - category_name은 "음식점 > 카페 > 커피전문점" 형태, 마지막 세그먼트를 category로 사용
 * - id 프리픽스: "kakao:{id}"
 */
import type { Place, PlaceDetail } from '@wayfinder/shared';

/** 카카오 Local 문서 한 건의 raw 타입 */
export interface KakaoLocalDocument {
  id: string;
  place_name: string;
  category_name: string;
  phone: string;
  address_name: string;
  road_address_name: string;
  x: string; // longitude
  y: string; // latitude
  place_url: string;
  distance?: string;
  category_group_code?: string;
  category_group_name?: string;
}

/** category_name에서 마지막 세그먼트 추출 ("음식점 > 카페" → "카페") */
function extractCategory(categoryName: string): string {
  const parts = categoryName.split('>').map((s) => s.trim());
  return parts[parts.length - 1] ?? categoryName;
}

/** 카카오 Local 문서 한 건 → Place */
export function normalizeKakaoPlace(doc: KakaoLocalDocument): Place {
  // distance는 좌표(x,y)를 보낸 검색에만 오고, 아니면 ''.
  const distanceM = doc.distance ? Number(doc.distance) : NaN;
  return {
    id: `kakao:${doc.id}`,
    name: doc.place_name,
    coord: {
      lat: parseFloat(doc.y), // y = latitude
      lng: parseFloat(doc.x), // x = longitude
    },
    category: extractCategory(doc.category_name),
    address: doc.road_address_name || doc.address_name,
    ...(Number.isFinite(distanceM) && { distanceM }),
    ...(doc.category_group_name && { categoryGroup: doc.category_group_name }),
  };
}

/**
 * 카카오 Local 문서 한 건 → PlaceDetail (기본정보만).
 * reviews·rating·blogs는 각각 구글/블로그 API에서 병합 — 여기선 빈 값.
 */
export function normalizeKakaoPlaceDetail(doc: KakaoLocalDocument): PlaceDetail {
  return {
    ...normalizeKakaoPlace(doc),
    distanceM: undefined, // 상세 조회용 검색 기준점은 사용자 위치가 아니라 힌트 좌표 — 거리 무의미
    phone: doc.phone || undefined,
    rating: undefined,
    reviews: [],
    blogs: { naver: [], kakao: [] },
    links: {
      kakaoMap: doc.place_url || `https://place.map.kakao.com/${doc.id}`,
    },
    roadview: {
      lat: parseFloat(doc.y),
      lng: parseFloat(doc.x),
    },
  };
}
