/**
 * D4 — TanStack Query 훅 + queryOptions 팩토리.
 *
 * 캐시 키 상수와 queryOptions 팩토리를 별도로 export하여
 * 렌더러(QueryClientProvider) 없이 순수 로직 단위 테스트가 가능하도록 한다.
 *
 * lazy-google 설계:
 *   - useSearchQuery: 검색어로 장소 목록 조회
 *   - usePlaceDetailQuery: 장소 기본 정보 + 블로그 (구글 미포함)
 *   - useGoogleDataQuery: 구글 평점·리뷰 — enabled=isGoogleTabActive일 때만 fetch
 *
 * 화면 컴포넌트를 import하지 않는다.
 */
import {
  useQuery,
  type UseQueryOptions,
  type UseQueryResult,
} from '@tanstack/react-query';
import type { BBox, LatLng, Place, PlaceDetail } from '@wayfinder/shared';
import type { PlaceCategoryCode, PlaceHint } from '@wayfinder/shared/api';
import { search, getDetail, getGoogleData, searchCategory, reverseGeocode } from '../services/PlaceService.js';
import type { GooglePlaceData } from '../services/PlaceService.js';
import { ApiError } from '../services/apiClient.js';

// ─── 캐시 키 팩토리 ────────────────────────────────────────────────────────────

export const queryKeys = {
  search: (query: string) => ['places', 'search', query] as const,
  detail: (id: string) => ['places', 'detail', id] as const,
  googleData: (id: string) => ['places', 'google', id] as const,
  category: (code: string, bounds: BBox | null) =>
    ['places', 'category', code, bounds && [bounds.sw.lat, bounds.sw.lng, bounds.ne.lat, bounds.ne.lng]] as const,
  reverse: (coord: LatLng | null) => ['geo', 'reverse', coord?.lat, coord?.lng] as const,
} as const;

// ─── queryOptions 팩토리 (렌더러 없이 테스트 가능) ─────────────────────────────

export function searchQueryOptions(
  query: string,
): UseQueryOptions<Place[], Error> {
  return {
    queryKey: queryKeys.search(query),
    queryFn: () => search(query),
    enabled: query.trim().length > 0,
    staleTime: 30_000, // 30초
    // 프록시는 공급자 실패를 502로 알린다 — 한 번만 더 해 보고 에러 상태를 보인다(기본 3회는 공급자를 두드림).
    retry: 1,
  };
}

/** 404는 다시 해도 같다 — 즉시 에러 UI(다시 시도/닫기)로. 그 외는 최대 2번 재시도. */
export function shouldRetryPlaceDetail(failureCount: number, error: Error): boolean {
  if (error instanceof ApiError && error.status === 404) return false;
  return failureCount < 2;
}

export function placeDetailQueryOptions(
  id: string | null,
  hint?: PlaceHint,
): UseQueryOptions<PlaceDetail, Error> {
  return {
    queryKey: queryKeys.detail(id ?? ''),
    queryFn: () => getDetail(id!, hint),
    enabled: id !== null,
    staleTime: 60_000, // 1분
    retry: shouldRetryPlaceDetail,
  };
}

/**
 * 구글 데이터 queryOptions.
 * `enabled`를 호출자가 `isGoogleTabActive`로 게이트하여 lazy 동작을 보장한다.
 */
export function googleDataQueryOptions(
  id: string | null,
  isGoogleTabActive: boolean,
): UseQueryOptions<GooglePlaceData, Error> {
  return {
    queryKey: queryKeys.googleData(id ?? ''),
    queryFn: () => getGoogleData(id!),
    enabled: id !== null && isGoogleTabActive,
    staleTime: 5 * 60_000, // 5분
  };
}

/** 카테고리 칩(F5) — 칩을 고르거나 '이 지역 재검색'을 눌렀을 때의 영역으로만(자동 재검색 없음). */
export function categoryQueryOptions(
  req: { code: PlaceCategoryCode; bounds: BBox } | null,
): UseQueryOptions<Place[], Error> {
  return {
    queryKey: queryKeys.category(req?.code ?? '', req?.bounds ?? null),
    queryFn: () => searchCategory(req!.code, req!.bounds),
    enabled: req !== null,
    staleTime: 60_000,
    retry: 1,
  };
}

/** 길게 누른 좌표의 주소(F6). 실패해도 팝업은 좌표로 동작하므로 재시도 안 함. */
export function reverseGeocodeQueryOptions(coord: LatLng | null): UseQueryOptions<string | null, Error> {
  return {
    queryKey: queryKeys.reverse(coord),
    queryFn: () => reverseGeocode(coord!),
    enabled: coord !== null,
    staleTime: Infinity,
    retry: false,
  };
}

// ─── React Query 훅 ────────────────────────────────────────────────────────────

/** 검색어로 장소 목록을 조회한다. */
export function useSearchQuery(
  query: string,
): UseQueryResult<Place[], Error> {
  return useQuery(searchQueryOptions(query));
}

/** 장소 기본 정보 + 블로그를 조회한다 (구글 데이터 미포함). */
export function usePlaceDetailQuery(
  id: string | null,
  hint?: PlaceHint,
): UseQueryResult<PlaceDetail, Error> {
  return useQuery(placeDetailQueryOptions(id, hint));
}

/**
 * 구글 평점·리뷰를 조회한다.
 * `isGoogleTabActive`가 true일 때만 fetch — lazy 방어선.
 */
export function useGoogleDataQuery(
  id: string | null,
  isGoogleTabActive: boolean,
): UseQueryResult<GooglePlaceData, Error> {
  return useQuery(googleDataQueryOptions(id, isGoogleTabActive));
}

export function useCategoryQuery(
  req: { code: PlaceCategoryCode; bounds: BBox } | null,
): UseQueryResult<Place[], Error> {
  return useQuery(categoryQueryOptions(req));
}

export function useReverseGeocodeQuery(coord: LatLng | null): UseQueryResult<string | null, Error> {
  return useQuery(reverseGeocodeQueryOptions(coord));
}
