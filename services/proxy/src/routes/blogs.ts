/**
 * A2 — GET /v1/blogs?q=&region=kr
 *
 * 네이버 + 카카오(Daum) 블로그 병합 결과 반환.
 * region=kr이면 네이버+카카오, 그 외에도 동일 (Phase 1은 한국 블로그만).
 * 데모 모드: mock 블로그 데이터 반환.
 */
import type { Context } from 'hono';
import type { Env } from '../config.js';
import { isDemoMode } from '../config.js';
import { SEOUL_CAFE } from '@wayfinder/shared/mocks';
import { normalizeNaverBlogResponse, type NaverBlogResponse } from '../normalize/naverBlog.js';
import { normalizeKakaoBlogResponse, type KakaoBlogResponse } from '../normalize/kakaoBlog.js';
import { cacheGetOrSet } from '../cache/kv.js';
import { fetchWithFallback } from '../middleware/degradation.js';
import type { BlogPost } from '@wayfinder/shared';

// 네이버 검색 API는 2026-07-31 개발자센터 신규 신청 종료 → NAVER API HUB(네이버 클라우드)로 이관.
// 헤더도 X-Naver-Client-* → X-NCP-APIGW-API-KEY(-ID). 응답 구조(total/items)는 동일.
const NAVER_BLOG_URL = 'https://naverapihub.apigw.ntruss.com/search/v1/blog';
const KAKAO_BLOG_URL = 'https://dapi.kakao.com/v2/search/blog';

/** 네이버 블로그 검색 (blogs·place-detail 공용). 키 미설정이면 호출 없이 빈 결과 — 네이버는 선택 키. */
export async function fetchNaverBlogs(q: string, env: Env): Promise<BlogPost[]> {
  if (!env.NAVER_CLIENT_ID || !env.NAVER_CLIENT_SECRET) return [];
  const url = new URL(NAVER_BLOG_URL);
  url.searchParams.set('query', q);
  url.searchParams.set('display', '5');
  url.searchParams.set('sort', 'sim');
  url.searchParams.set('format', 'json');

  const res = await fetch(url.toString(), {
    headers: {
      'X-NCP-APIGW-API-KEY-ID': env.NAVER_CLIENT_ID,
      'X-NCP-APIGW-API-KEY': env.NAVER_CLIENT_SECRET,
    },
  });
  if (!res.ok) throw new Error(`Naver blog search failed: ${res.status}`);

  return normalizeNaverBlogResponse((await res.json()) as NaverBlogResponse);
}

async function fetchKakao(q: string, key: string): Promise<BlogPost[]> {
  const url = new URL(KAKAO_BLOG_URL);
  url.searchParams.set('query', q);
  url.searchParams.set('size', '5');
  url.searchParams.set('sort', 'accuracy');

  const res = await fetch(url.toString(), {
    headers: { Authorization: `KakaoAK ${key}` },
  });
  if (!res.ok) throw new Error(`Kakao blog search failed: ${res.status}`);

  return normalizeKakaoBlogResponse((await res.json()) as KakaoBlogResponse);
}

export async function handleBlogs(c: Context<{ Bindings: Env }>): Promise<Response> {
  const q = c.req.query('q') ?? '';

  if (!q.trim()) {
    return c.json({ error: 'q parameter is required' }, 400);
  }

  // 데모 모드: 고정 픽스처 반환
  if (isDemoMode(c.env)) {
    return c.json({
      naver: SEOUL_CAFE.blogs.naver,
      kakao: SEOUL_CAFE.blogs.kakao,
    });
  }

  const [naver, kakao] = await Promise.all([
    cacheGetOrSet(
      c.env.CACHE,
      'blog',
      `naver-search:${q}`,
      () =>
        fetchWithFallback(
          () => fetchNaverBlogs(q, c.env),
          [] as BlogPost[],
          'naver-blog-search',
        ),
    ),
    cacheGetOrSet(
      c.env.CACHE,
      'blog',
      `kakao-search:${q}`,
      () =>
        fetchWithFallback(
          () => fetchKakao(q, c.env.KAKAO_REST_KEY),
          [] as BlogPost[],
          'kakao-blog-search',
        ),
    ),
  ]);

  return c.json({ naver, kakao });
}
