/**
 * A2 — GET /v1/places/search?q=&lat=&lng=
 *
 * 지역에 따라 카카오(한국) / 구글(글로벌)로 라우팅.
 * 한국 판정: @wayfinder/shared/region koreaBbox 함수 사용.
 * 데모 모드: F3 mock provider로 응답 (실 fetch 없음).
 */
import type { Context } from 'hono';
import type { Env } from '../config.js';
import { isDemoMode } from '../config.js';
import { selectRenderer } from '@wayfinder/shared/region';
import { mockPlaceProvider } from '@wayfinder/shared/mocks';
import { normalizeKakaoPlace, type KakaoLocalDocument } from '../normalize/kakaoPlace.js';
import { normalizeGooglePlace, type GooglePlaceRaw } from '../normalize/googlePlace.js';
import { cacheGetOrSet } from '../cache/kv.js';
import { fetchWithFallback } from '../middleware/degradation.js';
import type { Place } from '@wayfinder/shared';

const KAKAO_SEARCH_URL = 'https://dapi.kakao.com/v2/local/search/keyword.json';
const GOOGLE_SEARCH_URL = 'https://places.googleapis.com/v1/places:searchText';

async function searchKakao(q: string, lat: number, lng: number, key: string): Promise<Place[]> {
  const url = new URL(KAKAO_SEARCH_URL);
  url.searchParams.set('query', q);
  url.searchParams.set('x', String(lng));
  url.searchParams.set('y', String(lat));
  url.searchParams.set('size', '10');

  const res = await fetch(url.toString(), {
    headers: { Authorization: `KakaoAK ${key}` },
  });
  if (!res.ok) throw new Error(`Kakao search failed: ${res.status}`);

  const data = (await res.json()) as { documents: KakaoLocalDocument[] };
  return data.documents.map(normalizeKakaoPlace);
}

async function searchGoogle(q: string, lat: number, lng: number, key: string): Promise<Place[]> {
  if (!key) return []; // 구글 키 선택(유료 가능) — 미설정 시 글로벌 검색만 빈 결과
  const res = await fetch(GOOGLE_SEARCH_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Goog-Api-Key': key,
      'X-Goog-FieldMask': 'places.id,places.displayName,places.formattedAddress,places.location',
    },
    body: JSON.stringify({
      textQuery: q,
      locationBias: {
        circle: { center: { latitude: lat, longitude: lng }, radius: 5000 },
      },
      maxResultCount: 10,
    }),
  });
  if (!res.ok) throw new Error(`Google search failed: ${res.status}`);

  const data = (await res.json()) as { places?: GooglePlaceRaw[] };
  return (data.places ?? []).map(normalizeGooglePlace);
}

export async function handlePlacesSearch(c: Context<{ Bindings: Env }>): Promise<Response> {
  const q = c.req.query('q') ?? '';
  const latStr = c.req.query('lat');
  const lngStr = c.req.query('lng');

  if (!q.trim()) {
    return c.json({ error: 'q parameter is required' }, 400);
  }

  // 데모 모드
  if (isDemoMode(c.env)) {
    const places = await mockPlaceProvider.search(q);
    return c.json(places);
  }

  const lat = latStr ? parseFloat(latStr) : 37.5665; // 기본: 서울
  const lng = lngStr ? parseFloat(lngStr) : 126.9780;

  const useKakao = selectRenderer({ lat, lng }, 10) === 'korea';
  const cacheKey = `search:${useKakao ? 'kakao' : 'google'}:${q}:${Math.round(lat * 10)}:${Math.round(lng * 10)}`;

  const places = await cacheGetOrSet(
    c.env.CACHE,
    'place',
    cacheKey,
    () =>
      fetchWithFallback(
        () =>
          useKakao
            ? searchKakao(q, lat, lng, c.env.KAKAO_REST_KEY)
            : searchGoogle(q, lat, lng, c.env.GOOGLE_PLACES_KEY),
        [] as Place[],
        useKakao ? 'kakao-search' : 'google-search',
      ),
  );

  return c.json(places);
}
