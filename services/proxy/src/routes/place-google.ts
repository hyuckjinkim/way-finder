/**
 * A2 — GET /v1/places/:id/google
 *
 * 구글 평점·리뷰만 반환 (lazy load — §11 과금 방어선).
 * 구글 탭이 활성화될 때만 호출되므로, 상세 1회당 구글 과금 호출이 발생하지 않는다.
 * id 형식: "kakao:12345" | "google:ChIJ..."
 *
 * 응답 스키마: { rating?: Rating; reviews: Review[] }  (D의 GooglePlaceData와 일치)
 *
 * graceful degradation:
 * - 구글 fetch 실패 → 200 + { reviews: [], rating undefined } + 에러 로깅
 *
 * 캐싱: 구글 데이터 30일 TTL (약관 §6). 캐시 키는 place-detail.ts와 동일 규칙.
 * 카카오 장소: 이름으로 구글 Text Search → place id → 리뷰. 장소 이름은
 * place-detail.ts가 채운 `place:kakao-detail:{id}` 캐시에서 복구한다(구글 탭은
 * 상세 로드 후 열리므로 캐시 히트 — 추가 카카오 과금 없음).
 */
import type { Context } from 'hono';
import type { Env } from '../config.js';
import { isDemoMode } from '../config.js';
import { mockPlaceProvider } from '@wayfinder/shared/mocks';
import {
  normalizeKakaoPlaceDetail,
  type KakaoLocalDocument,
} from '../normalize/kakaoPlace.js';
import {
  normalizeGoogleReview,
  normalizeGoogleRating,
  type GooglePlaceRaw,
  type GoogleReviewRaw,
} from '../normalize/googlePlace.js';
import { cacheGet, cachePut, cacheGetOrSet } from '../cache/kv.js';
import { fetchWithFallback } from '../middleware/degradation.js';
import type { Review, Rating } from '@wayfinder/shared';

const KAKAO_SEARCH_URL = 'https://dapi.kakao.com/v2/local/search/keyword.json';
const GOOGLE_PLACE_URL = 'https://places.googleapis.com/v1/places';

/** 구글 탭 응답 페이로드. */
interface GooglePlaceData {
  rating?: Rating;
  reviews: Review[];
}

async function fetchKakaoDetail(kakaoId: string, key: string): Promise<KakaoLocalDocument | null> {
  const url = new URL(KAKAO_SEARCH_URL);
  url.searchParams.set('query', kakaoId);
  url.searchParams.set('size', '1');

  const res = await fetch(url.toString(), {
    headers: { Authorization: `KakaoAK ${key}` },
  });
  if (!res.ok) throw new Error(`Kakao detail failed: ${res.status}`);

  const data = (await res.json()) as { documents: KakaoLocalDocument[] };
  return data.documents[0] ?? null;
}

async function fetchGoogleReviews(
  googleId: string,
  key: string,
): Promise<GooglePlaceData> {
  const url = `${GOOGLE_PLACE_URL}/${googleId}`;
  const res = await fetch(url, {
    headers: {
      'X-Goog-Api-Key': key,
      'X-Goog-FieldMask': 'id,rating,userRatingCount,reviews',
    },
  });
  if (!res.ok) throw new Error(`Google place detail failed: ${res.status}`);

  const data = (await res.json()) as GooglePlaceRaw & { reviews?: GoogleReviewRaw[] };
  const reviews = (data.reviews ?? []).slice(0, 5).map(normalizeGoogleReview);
  const rating = normalizeGoogleRating(data);
  return { reviews, rating };
}

/** 카카오 장소 이름으로 구글 Text Search → 첫 결과의 리뷰. */
async function fetchGoogleReviewsByName(
  name: string,
  address: string,
  key: string,
): Promise<GooglePlaceData> {
  const searchRes = await fetch('https://places.googleapis.com/v1/places:searchText', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Goog-Api-Key': key,
      'X-Goog-FieldMask': 'places.id',
    },
    body: JSON.stringify({ textQuery: `${name} ${address}`, maxResultCount: 1 }),
  });
  if (!searchRes.ok) throw new Error(`Google text search failed: ${searchRes.status}`);
  const searchData = (await searchRes.json()) as { places?: Array<{ id: string }> };
  const googlePlaceId = searchData.places?.[0]?.id;
  if (!googlePlaceId) return { reviews: [], rating: undefined };
  return fetchGoogleReviews(googlePlaceId, key);
}

export async function handlePlaceGoogle(c: Context<{ Bindings: Env }>): Promise<Response> {
  const rawId = c.req.param('id') ?? '';

  if (!rawId) {
    return c.json({ error: 'id parameter is required' }, 400);
  }

  // 데모 모드: fixture의 rating/reviews 추출
  if (isDemoMode(c.env)) {
    const detail = await mockPlaceProvider.getDetail(rawId).catch(() => null);
    if (!detail) return c.json({ error: 'Place not found' }, 404);
    const payload: GooglePlaceData = { rating: detail.rating, reviews: detail.reviews };
    return c.json(payload);
  }

  // id 파싱: "kakao:12345" 또는 "google:ChIJ..."
  const colonIdx = rawId.indexOf(':');
  if (colonIdx === -1) {
    return c.json({ error: 'Invalid id format. Expected "kakao:<id>" or "google:<id>"' }, 400);
  }
  const provider = rawId.slice(0, colonIdx) as 'kakao' | 'google';
  const nativeId = rawId.slice(colonIdx + 1);

  // 캐시 키는 place-detail.ts와 동일 규칙: google:{nativeId(google)} | google:{name(kakao)}
  // 캐시 히트 시 추가 구글 호출 없음.
  let googleCacheKey: string;
  let fetchFromGoogle: () => Promise<GooglePlaceData>;

  if (provider === 'google') {
    googleCacheKey = `google:${nativeId}`;
    fetchFromGoogle = () => fetchGoogleReviews(nativeId, c.env.GOOGLE_PLACES_KEY);
  } else {
    // 카카오: 장소 이름을 캐시에서 복구 (상세 로드 시 채워진 place:kakao-detail:{id})
    const doc = await cacheGetOrSet(
      c.env.CACHE,
      'place',
      `kakao-detail:${nativeId}`,
      () => fetchKakaoDetail(nativeId, c.env.KAKAO_REST_KEY),
    );
    if (!doc) return c.json({ error: 'Place not found' }, 404);
    const base = normalizeKakaoPlaceDetail(doc);
    googleCacheKey = `google:${base.name}`;
    fetchFromGoogle = () =>
      fetchGoogleReviewsByName(base.name, base.address, c.env.GOOGLE_PLACES_KEY);
  }

  const cached = await cacheGet<GooglePlaceData>(c.env.CACHE, 'google', googleCacheKey);
  if (cached) {
    return c.json(cached);
  }

  const result = await fetchWithFallback(
    fetchFromGoogle,
    { reviews: [] as Review[], rating: undefined as Rating | undefined },
    'google-lazy',
  );

  if (result.reviews.length > 0 || result.rating) {
    await cachePut(c.env.CACHE, 'google', googleCacheKey, result);
  }

  return c.json(result);
}
