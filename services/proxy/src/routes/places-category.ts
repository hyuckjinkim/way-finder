/**
 * F5 — GET /v1/places/category?code=CE7&rect=minX,minY,maxX,maxY[&x=&y=]  (또는 &x=&y=&radius=)
 * F6 — GET /v1/geo/reverse?lat=&lng=
 *
 * 카카오 Local category.json / coord2address.json. 좌표는 카카오 순서(x=경도, y=위도).
 * 둘 다 KV에 쓰지 않는다 — 지도 영역·길게 누른 좌표는 거의 매번 다른 키라 하루 1,000 쓰기 예산만 태운다.
 * ponytail: 짧은 Cache-Control만. 같은 영역 반복이 많아지면 isolate 메모리 캐시로.
 */
import type { Context } from 'hono';
import type { Env } from '../config.js';
import { isDemoMode, UPSTREAM_TIMEOUT_MS } from '../config.js';
import { PLACE_CATEGORY_CODES, type PlaceCategoryCode, type ReverseGeocode } from '@wayfinder/shared/api';
import { mockPlaceProvider } from '@wayfinder/shared/mocks';
import { normalizeKakaoPlace, type KakaoLocalDocument } from '../normalize/kakaoPlace.js';

const KAKAO_CATEGORY_URL = 'https://dapi.kakao.com/v2/local/search/category.json';
const KAKAO_COORD2ADDRESS_URL = 'https://dapi.kakao.com/v2/local/geo/coord2address.json';
const MAX_RADIUS_M = 20_000;
const CACHE_HEADER = { 'Cache-Control': 'public, max-age=60' };

const num = (raw: string | undefined): number => (raw === undefined || raw === '' ? NaN : Number(raw));
const isLng = (v: number) => Number.isFinite(v) && Math.abs(v) <= 180;
const isLat = (v: number) => Number.isFinite(v) && Math.abs(v) <= 90;

/** 쿼리 → 카카오 파라미터. 잘못되면 에러 문구. */
export function categoryParams(q: Record<string, string | undefined>): URLSearchParams | string {
  const code = q.code ?? '';
  if (!Object.hasOwn(PLACE_CATEGORY_CODES, code)) return 'code must be a Kakao category_group_code (e.g. CE7)';
  const params = new URLSearchParams({ category_group_code: code, size: '15' });

  const x = num(q.x);
  const y = num(q.y);
  const hasCenter = isLng(x) && isLat(y);
  if (q.rect) {
    const parts = q.rect.split(',').map((p) => num(p.trim()));
    const [minX = NaN, minY = NaN, maxX = NaN, maxY = NaN] = parts;
    const ok = isLng(minX) && isLng(maxX) && isLat(minY) && isLat(maxY);
    if (parts.length !== 4 || !ok || minX >= maxX || minY >= maxY) {
      return 'rect must be minX,minY,maxX,maxY (lng,lat,lng,lat)';
    }
    params.set('rect', parts.join(','));
  } else {
    const radius = num(q.radius);
    if (!hasCenter || !Number.isInteger(radius) || radius < 0 || radius > MAX_RADIUS_M) {
      return `rect, or x,y,radius (0~${MAX_RADIUS_M}m) is required`;
    }
    params.set('radius', String(radius));
  }
  // 중심을 주면 카카오가 distance를 채운다(rect 검색에서도).
  if (hasCenter) {
    params.set('x', String(x));
    params.set('y', String(y));
  }
  return params;
}

export async function handlePlacesCategory(c: Context<{ Bindings: Env }>): Promise<Response> {
  const params = categoryParams(c.req.query());
  if (typeof params === 'string') return c.json({ error: params }, 400);

  if (isDemoMode(c.env)) {
    const name = PLACE_CATEGORY_CODES[params.get('category_group_code') as PlaceCategoryCode];
    return c.json(await mockPlaceProvider.search(name));
  }

  try {
    const res = await fetch(`${KAKAO_CATEGORY_URL}?${params}`, {
      signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS),
      headers: { Authorization: `KakaoAK ${c.env.KAKAO_REST_KEY}` },
    });
    if (!res.ok) throw new Error(`Kakao category failed: ${res.status}`);
    const data = (await res.json()) as { documents: KakaoLocalDocument[] };
    return c.json(data.documents.map(normalizeKakaoPlace), 200, CACHE_HEADER);
  } catch (err) {
    console.error('[category] kakao failed:', err);
    return c.json({ error: 'category provider failed', code: 'upstream' }, 502);
  }
}

interface KakaoCoord2AddressDocument {
  address?: { address_name?: string } | null;
  road_address?: { address_name?: string; building_name?: string } | null;
}

/** 건물명 > 도로명 > 지번. 없으면 null(바다·해외). */
export function reverseLabel(doc: KakaoCoord2AddressDocument | undefined): string | null {
  return doc?.road_address?.building_name || doc?.road_address?.address_name || doc?.address?.address_name || null;
}

export async function handleGeoReverse(c: Context<{ Bindings: Env }>): Promise<Response> {
  const lat = num(c.req.query('lat'));
  const lng = num(c.req.query('lng'));
  if (!isLat(lat) || !isLng(lng)) return c.json({ error: 'lat/lng must be numeric coordinates' }, 400);

  if (isDemoMode(c.env)) return c.json<ReverseGeocode>({ label: null });

  try {
    const url = `${KAKAO_COORD2ADDRESS_URL}?${new URLSearchParams({ x: String(lng), y: String(lat) })}`;
    const res = await fetch(url, {
      signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS),
      headers: { Authorization: `KakaoAK ${c.env.KAKAO_REST_KEY}` },
    });
    if (!res.ok) throw new Error(`Kakao coord2address failed: ${res.status}`);
    const data = (await res.json()) as { documents: KakaoCoord2AddressDocument[] };
    return c.json<ReverseGeocode>({ label: reverseLabel(data.documents[0]) }, 200, CACHE_HEADER);
  } catch (err) {
    console.error('[reverse] kakao failed:', err);
    return c.json({ error: 'reverse geocode provider failed', code: 'upstream' }, 502);
  }
}
