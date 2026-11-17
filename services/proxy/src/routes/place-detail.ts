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
import { isDemoMode, UPSTREAM_TIMEOUT_MS } from '../config.js';
import { mockPlaceProvider } from '@wayfinder/shared/mocks';
import {
  normalizeKakaoPlaceDetail,
  type KakaoLocalDocument,
} from '../normalize/kakaoPlace.js';
import { fetchNaverBlogs } from './blogs.js';
import { normalizeKakaoBlogResponse, type KakaoBlogResponse } from '../normalize/kakaoBlog.js';
import { cacheGetOrSet, deferFrom } from '../cache/kv.js';
import { fetchWithFallback } from '../middleware/degradation.js';
import type { PlaceDetail, BlogPost } from '@wayfinder/shared';

const KAKAO_SEARCH_URL = 'https://dapi.kakao.com/v2/local/search/keyword.json';
const KAKAO_BLOG_URL = 'https://dapi.kakao.com/v2/search/blog';

/** 상세 요청의 검색 힌트 (placeDetailPath의 ?name&lat&lng). */
export interface DetailHint {
  name: string;
  lat: number;
  lng: number;
}

const MAX_HINT_NAME = 100;

/**
 * 쿼리에서 힌트를 읽는다. 셋 다 없으면 undefined, 일부만 있거나 값이 잘못되면 'invalid'.
 */
export function parseDetailHint(
  q: (k: string) => string | undefined,
): DetailHint | undefined | 'invalid' {
  const name = q('name')?.trim();
  const latStr = q('lat');
  const lngStr = q('lng');
  if (name === undefined && latStr === undefined && lngStr === undefined) return undefined;
  const lat = latStr?.trim() ? Number(latStr) : NaN;
  const lng = lngStr?.trim() ? Number(lngStr) : NaN;
  if (!name || name.length > MAX_HINT_NAME) return 'invalid';
  if (!Number.isFinite(lat) || lat < -90 || lat > 90) return 'invalid';
  if (!Number.isFinite(lng) || lng < -180 || lng > 180) return 'invalid';
  return { name, lat, lng };
}

/**
 * 카카오 장소 단건 조회. 카카오엔 id 조회 API가 없고 keyword.json의 query에 숫자 id를 넣으면
 * 항상 빈 결과라, 힌트(이름·좌표)로 그 근처(500m)를 거리순 검색해 id로 매칭한다.
 * 매칭 순서: id 일치 → 같은 이름 중 가장 가까운 문서 → null(404).
 * 힌트가 없으면 예전 방식(id를 query로)으로 시도 — 사실상 404.
 * place-google.ts도 사용한다.
 */
export async function fetchKakaoDetail(
  kakaoId: string,
  key: string,
  hint?: DetailHint,
): Promise<KakaoLocalDocument | null> {
  const url = new URL(KAKAO_SEARCH_URL);
  url.searchParams.set('query', hint?.name ?? kakaoId);
  if (hint) {
    url.searchParams.set('x', String(hint.lng));
    url.searchParams.set('y', String(hint.lat));
    url.searchParams.set('radius', '500');
    url.searchParams.set('sort', 'distance');
    url.searchParams.set('size', '15');
  } else {
    url.searchParams.set('size', '1');
  }

  const res = await fetch(url.toString(), {
    signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS),
    headers: { Authorization: `KakaoAK ${key}` },
  });
  if (!res.ok) throw new Error(`Kakao detail failed: ${res.status}`);

  const { documents } = (await res.json()) as { documents: KakaoLocalDocument[] };
  // id 정확 일치만 인정 — 결과가 `kakao-detail:<id>` 공유 키로 캐시되므로, hint(클라이언트 입력)로
  // 고른 다른 장소를 받으면 캐시 오염이 된다.
  return documents.find((d) => d.id === kakaoId) ?? null;
}

async function fetchKakaoBlogs(q: string, key: string): Promise<BlogPost[]> {
  const url = new URL(KAKAO_BLOG_URL);
  url.searchParams.set('query', q);
  url.searchParams.set('size', '5');
  url.searchParams.set('sort', 'accuracy');

  const res = await fetch(url.toString(), {

    signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS),
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

  const hint = parseDetailHint((k) => c.req.query(k));
  if (hint === 'invalid') {
    return c.json({ error: 'Invalid hint: name (<=100 chars), lat, lng must be given together and in range' }, 400);
  }
  const defer = deferFrom(c);

  // id 파싱: "kakao:12345" 또는 "google:ChIJ..."
  const colonIdx = rawId.indexOf(':');
  if (colonIdx === -1) {
    return c.json({ error: 'Invalid id format. Expected "kakao:<id>" or "google:<id>"' }, 400);
  }
  const provider = rawId.slice(0, colonIdx) as 'kakao' | 'kakao-addr' | 'google';
  const nativeId = rawId.slice(colonIdx + 1);

  // 기본 장소 정보 (캐시: 24h)
  let base: PlaceDetail;

  if (provider === 'kakao-addr') {
    // 주소 검색 결과("kakao-addr:<x>,<y>") — 장소 레코드가 없으니 좌표만으로 구성, 블로그 없음.
    const [lng = NaN, lat = NaN] = nativeId.split(',').map(Number);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
      return c.json({ error: 'Invalid kakao-addr id. Expected "kakao-addr:<x>,<y>"' }, 400);
    }
    return c.json({
      id: rawId,
      name: hint?.name ?? rawId,
      coord: { lat, lng },
      category: '주소',
      address: hint?.name ?? '',
      reviews: [],
      blogs: { naver: [], kakao: [] },
      links: {},
    } satisfies PlaceDetail);
  }

  if (provider === 'kakao') {
    const doc = await cacheGetOrSet(
      c.env.CACHE,
      'place',
      `kakao-detail:${nativeId}`,
      () => fetchKakaoDetail(nativeId, c.env.KAKAO_REST_KEY, hint),
      defer,
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
      defer,
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
      defer,
    ),
  ]);

  const detail: PlaceDetail = {
    ...base,
    blogs: { naver: naverBlogs, kakao: kakaoBlogs },
  };

  return c.json(detail);
}
