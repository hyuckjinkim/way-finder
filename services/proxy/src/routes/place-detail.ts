/**
 * A2 — GET /v1/places/:id?provider=kakao|google
 *
 * 기본정보(카카오 or 구글) + 블로그 스니펫 포함.
 * 구글 평점·리뷰는 포함하지 않는다 — lazy load (§11 과금 방어선). 구글 탭 활성화 시
 * GET /v1/places/:id/google 으로 별도 조회한다.
 * id 형식: "kakao:12345" | "google:ChIJ..."
 *
 * graceful degradation:
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
import { normalizeNaverBlogResponse, type NaverBlogResponse } from '../normalize/naverBlog.js';
import { normalizeKakaoBlogResponse, type KakaoBlogResponse } from '../normalize/kakaoBlog.js';
import { cacheGetOrSet } from '../cache/kv.js';
import { fetchWithFallback } from '../middleware/degradation.js';
import type { PlaceDetail, BlogPost } from '@wayfinder/shared';

const KAKAO_SEARCH_URL = 'https://dapi.kakao.com/v2/local/search/keyword.json';
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
    // google provider: 기본정보만 구성 (구글 평점·리뷰는 /google 라우트에서 lazy 조회)
    base = {
      id: rawId,
      name: nativeId,
      coord: { lat: 0, lng: 0 },
      category: 'Place',
      address: '',
      reviews: [],
      rating: undefined,
      blogs: { naver: [], kakao: [] },
      links: { googleMaps: `https://maps.google.com/?cid=${nativeId}` },
    };
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
    blogs: { naver: naverBlogs, kakao: kakaoBlogs },
  };

  return c.json(detail);
}
