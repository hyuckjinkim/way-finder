/**
 * A2 — GET /v1/places/:id?provider=kakao|google
 *
 * 기본정보(카카오 or 구글) + lazy 구글 평점·리뷰 병합 + 블로그 스니펫 포함.
 * id 형식: "kakao:12345" | "google:ChIJ..."
 *
 * graceful degradation:
 * - 구글 fetch 실패 → 200 + reviews:[] + rating 없음 + 에러 로깅
 * - 블로그 fetch 실패 → 200 + blogs:{naver:[], kakao:[]} + 에러 로깅
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
import { normalizeNaverBlogResponse, type NaverBlogResponse } from '../normalize/naverBlog.js';
import { normalizeKakaoBlogResponse, type KakaoBlogResponse } from '../normalize/kakaoBlog.js';
import { cacheGet, cachePut, cacheGetOrSet } from '../cache/kv.js';
import { fetchWithFallback } from '../middleware/degradation.js';
import type { PlaceDetail, Review, Rating, BlogPost } from '@wayfinder/shared';

const KAKAO_SEARCH_URL = 'https://dapi.kakao.com/v2/local/search/keyword.json';
const GOOGLE_PLACE_URL = 'https://places.googleapis.com/v1/places';
const NAVER_BLOG_URL = 'https://openapi.naver.com/v1/search/blog';
const KAKAO_BLOG_URL = 'https://dapi.kakao.com/v2/search/blog';

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
): Promise<{ reviews: Review[]; rating: Rating | undefined }> {
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

async function fetchNaverBlogs(q: string, env: Env): Promise<BlogPost[]> {
  const url = new URL(NAVER_BLOG_URL);
  url.searchParams.set('query', q);
  url.searchParams.set('display', '5');
  url.searchParams.set('sort', 'sim');

  const res = await fetch(url.toString(), {
    headers: {
      'X-Naver-Client-Id': env.NAVER_CLIENT_ID,
      'X-Naver-Client-Secret': env.NAVER_CLIENT_SECRET,
    },
  });
  if (!res.ok) throw new Error(`Naver blog failed: ${res.status}`);

  const data = (await res.json()) as NaverBlogResponse;
  return normalizeNaverBlogResponse(data);
}

async function fetchKakaoBlogs(q: string, key: string): Promise<BlogPost[]> {
  const url = new URL(KAKAO_BLOG_URL);
  url.searchParams.set('query', q);
  url.searchParams.set('size', '5');
  url.searchParams.set('sort', 'accuracy');

  const res = await fetch(url.toString(), {
    headers: { Authorization: `KakaoAK ${key}` },
  });
  if (!res.ok) throw new Error(`Kakao blog failed: ${res.status}`);

  const data = (await res.json()) as KakaoBlogResponse;
  return normalizeKakaoBlogResponse(data);
}

export async function handlePlaceDetail(c: Context<{ Bindings: Env }>): Promise<Response> {
  const rawId = c.req.param('id') ?? '';

  if (!rawId) {
    return c.json({ error: 'id parameter is required' }, 400);
  }

  // 데모 모드
  if (isDemoMode(c.env)) {
    const detail = await mockPlaceProvider.getDetail(rawId).catch(() => null);
    if (!detail) return c.json({ error: 'Place not found' }, 404);
    return c.json(detail);
  }

  // id 파싱: "kakao:12345" 또는 "google:ChIJ..."
  const colonIdx = rawId.indexOf(':');
  if (colonIdx === -1) {
    return c.json({ error: 'Invalid id format. Expected "kakao:<id>" or "google:<id>"' }, 400);
  }
  const provider = rawId.slice(0, colonIdx) as 'kakao' | 'google';
  const nativeId = rawId.slice(colonIdx + 1);

  // 기본 장소 정보 (캐시: 24h)
  let base: PlaceDetail;

  if (provider === 'kakao') {
    const doc = await cacheGetOrSet(
      c.env.CACHE,
      'place',
      `kakao-detail:${nativeId}`,
      () => fetchKakaoDetail(nativeId, c.env.KAKAO_REST_KEY),
    );
    if (!doc) return c.json({ error: 'Place not found' }, 404);
    base = normalizeKakaoPlaceDetail(doc);
  } else {
    // google provider: 기본 구글 정보 fetch (지도 검색 경로는 구글 ID로 바로 조회)
    const googleData = await fetchWithFallback(
      () => fetchGoogleReviews(nativeId, c.env.GOOGLE_PLACES_KEY),
      { reviews: [] as Review[], rating: undefined as Rating | undefined },
      'google-detail-base',
    );
    base = {
      id: rawId,
      name: nativeId,
      coord: { lat: 0, lng: 0 },
      category: 'Place',
      address: '',
      reviews: googleData.reviews,
      rating: googleData.rating,
      blogs: { naver: [], kakao: [] },
      links: { googleMaps: `https://maps.google.com/?cid=${nativeId}` },
    };
  }

  // 구글 평점·리뷰 (lazy 병합 — 캐시: 30일 TTL)
  const googleCacheKey = `google:${provider === 'google' ? nativeId : base.name}`;
  const cachedGoogle = await cacheGet<{ reviews: Review[]; rating: Rating | undefined }>(
    c.env.CACHE,
    'google',
    googleCacheKey,
  );

  let reviews: Review[];
  let rating: Rating | undefined;

  if (cachedGoogle) {
    reviews = cachedGoogle.reviews;
    rating = cachedGoogle.rating;
  } else if (provider === 'kakao') {
    // 카카오 장소는 이름으로 구글 검색해 reviews 병합
    const googleResult = await fetchWithFallback(
      async () => {
        // 장소 이름으로 Google Text Search → 첫 번째 결과의 리뷰
        const searchRes = await fetch('https://places.googleapis.com/v1/places:searchText', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Goog-Api-Key': c.env.GOOGLE_PLACES_KEY,
            'X-Goog-FieldMask': 'places.id',
          },
          body: JSON.stringify({ textQuery: `${base.name} ${base.address}`, maxResultCount: 1 }),
        });
        if (!searchRes.ok) throw new Error(`Google text search failed: ${searchRes.status}`);
        const searchData = (await searchRes.json()) as { places?: Array<{ id: string }> };
        const googlePlaceId = searchData.places?.[0]?.id;
        if (!googlePlaceId) return { reviews: [] as Review[], rating: undefined as Rating | undefined };
        return fetchGoogleReviews(googlePlaceId, c.env.GOOGLE_PLACES_KEY);
      },
      { reviews: [] as Review[], rating: undefined as Rating | undefined },
      'google-reviews-merge',
    );
    reviews = googleResult.reviews;
    rating = googleResult.rating;
    if (reviews.length > 0 || rating) {
      await cachePut(c.env.CACHE, 'google', googleCacheKey, { reviews, rating });
    }
  } else {
    reviews = base.reviews;
    rating = base.rating;
  }

  // 블로그 (캐시: 6h)
  const blogCacheKey = `blog:${base.name}`;
  const [naverBlogs, kakaoBlogs] = await Promise.all([
    cacheGetOrSet(
      c.env.CACHE,
      'blog',
      `naver:${blogCacheKey}`,
      () =>
        fetchWithFallback(
          () => fetchNaverBlogs(base.name, c.env),
          [] as BlogPost[],
          'naver-blog',
        ),
    ),
    cacheGetOrSet(
      c.env.CACHE,
      'blog',
      `kakao:${blogCacheKey}`,
      () =>
        fetchWithFallback(
          () => fetchKakaoBlogs(base.name, c.env.KAKAO_REST_KEY),
          [] as BlogPost[],
          'kakao-blog',
        ),
    ),
  ]);

  const detail: PlaceDetail = {
    ...base,
    reviews,
    rating: rating ?? base.rating,
    blogs: { naver: naverBlogs, kakao: kakaoBlogs },
  };

  return c.json(detail);
}
