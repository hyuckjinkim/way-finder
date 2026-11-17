/**
 * A2 — GET /v1/places/search?q=&lat=&lng=
 *
 * 지역에 따라 카카오(한국) / 구글(글로벌)로 라우팅.
 * 한국 판정: @wayfinder/shared/region koreaBbox 함수 사용.
 * 데모 모드: F3 mock provider로 응답 (실 fetch 없음).
 */
import type { Context } from 'hono';
import type { Env } from '../config.js';
import { isDemoMode, UPSTREAM_TIMEOUT_MS } from '../config.js';
import { selectRenderer } from '@wayfinder/shared/region';
import { mockPlaceProvider } from '@wayfinder/shared/mocks';
import { normalizeKakaoPlace, type KakaoLocalDocument } from '../normalize/kakaoPlace.js';
import { normalizeGooglePlace, type GooglePlaceRaw } from '../normalize/googlePlace.js';
import { cacheGetOrSet, deferFrom, normalizeKey } from '../cache/kv.js';
import { fetchWithFallback } from '../middleware/degradation.js';
import type { Place } from '@wayfinder/shared';

const KAKAO_SEARCH_URL = 'https://dapi.kakao.com/v2/local/search/keyword.json';
const KAKAO_ADDRESS_URL = 'https://dapi.kakao.com/v2/local/search/address.json';

/** address.json 문서 (필요한 필드만). */
interface KakaoAddressDocument {
  address_name: string;
  x: string;
  y: string;
  road_address?: { address_name?: string } | null;
}
const GOOGLE_SEARCH_URL = 'https://places.googleapis.com/v1/places:searchText';

async function keywordKakao(q: string, lat: number, lng: number, key: string): Promise<KakaoLocalDocument[]> {
  const url = new URL(KAKAO_SEARCH_URL);
  url.searchParams.set('query', q);
  url.searchParams.set('x', String(lng));
  url.searchParams.set('y', String(lat));
  url.searchParams.set('size', '10');

  const res = await fetch(url.toString(), {
    signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS),
    headers: { Authorization: `KakaoAK ${key}` },
  });
  if (!res.ok) throw new Error(`Kakao search failed: ${res.status}`);

  const data = (await res.json()) as { documents: KakaoLocalDocument[] };
  return data.documents;
}

/** "강남" 같은 짧은 한글 지명 — 카카오 키워드 검색은 역보다 상호가 먼저 나오므로 "강남역"도 함께 찾는다. */
const isShortHangul = (q: string) => /^[가-힣]{1,4}$/.test(q) && !q.endsWith('역');
const MAX_PROMOTED_STATIONS = 2;

/** 주소로 보이는 질의 (로/길/동/번지 + 숫자). */
const looksLikeAddress = (q: string) => /(로|길|동|번지)/.test(q) && /\d/.test(q);

async function searchAddress(q: string, key: string): Promise<Place[]> {
  const url = new URL(KAKAO_ADDRESS_URL);
  url.searchParams.set('query', q);
  url.searchParams.set('size', '5');

  const res = await fetch(url.toString(), {
    signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS),
    headers: { Authorization: `KakaoAK ${key}` },
  });
  if (!res.ok) throw new Error(`Kakao address failed: ${res.status}`);

  const data = (await res.json()) as { documents: KakaoAddressDocument[] };
  return data.documents.map((d) => ({
    id: `kakao-addr:${d.x},${d.y}`,
    name: d.address_name,
    coord: { lat: parseFloat(d.y), lng: parseFloat(d.x) },
    category: '주소',
    address: d.road_address?.address_name || d.address_name,
  }));
}

async function searchKakao(q: string, lat: number, lng: number, key: string): Promise<Place[]> {
  const term = q.trim();
  const [docs, stationDocs, addrFirst] = await Promise.all([
    keywordKakao(term, lat, lng, key),
    isShortHangul(term)
      ? fetchWithFallback(() => keywordKakao(`${term}역`, lat, lng, key), [] as KakaoLocalDocument[], 'kakao-station-search')
      : Promise.resolve([] as KakaoLocalDocument[]),
    looksLikeAddress(term)
      ? fetchWithFallback(() => searchAddress(term, key), [] as Place[], 'kakao-address')
      : Promise.resolve(null),
  ]);

  const stations = stationDocs
    .filter((d) => d.category_group_code === 'SW8' && d.place_name.includes(term))
    .slice(0, MAX_PROMOTED_STATIONS);
  const seen = new Set<string>();
  const places = [...stations, ...docs]
    .filter((d) => !seen.has(d.id) && seen.add(d.id))
    .map(normalizeKakaoPlace);

  // 주소형 질의는 항상, 그 외엔 키워드 결과가 없을 때만 주소 검색.
  const addr =
    addrFirst ??
    (places.length === 0
      ? await fetchWithFallback(() => searchAddress(term, key), [] as Place[], 'kakao-address')
      : []);
  return [...addr, ...places];
}

async function searchGoogle(q: string, lat: number, lng: number, key: string): Promise<Place[]> {
  if (!key) return []; // 구글 키 선택(유료 가능) — 미설정 시 글로벌 검색만 빈 결과
  const res = await fetch(GOOGLE_SEARCH_URL, {
    signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS),
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
  // 좌표는 소수 2자리(≈1km)로 반올림 — 같은 동네 검색이 같은 키로 수렴 (q는 normalizeKey로 정규화).
  const cacheKey = `search:${useKakao ? 'kakao' : 'google'}:${normalizeKey(q)}:${lat.toFixed(2)}:${lng.toFixed(2)}`;

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
    deferFrom(c),
  );

  return c.json(places);
}
