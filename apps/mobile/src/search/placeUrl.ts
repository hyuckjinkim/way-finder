/**
 * 장소 라우트 URL — 새로고침·공유 링크에서도 프록시 힌트(이름·좌표)를 복원한다.
 * 형식: `/place/<id>?name=...&lat=...&lng=...` (카카오는 id 단건 조회가 없어 힌트가 필수).
 */
import type { BBox, LatLng } from '@wayfinder/shared';
import type { PlaceHint } from '@wayfinder/shared/api';

export function placeHref(place: { id: string; name: string; coord: LatLng }): string {
  const qs = new URLSearchParams({
    name: place.name,
    lat: String(place.coord.lat),
    lng: String(place.coord.lng),
  });
  return `/place/${encodeURIComponent(place.id)}?${qs}`;
}

/** expo-router `useLocalSearchParams()` → 힌트. 하나라도 비정상이면 undefined. */
export function parsePlaceHint(params: Record<string, string | string[] | undefined>): PlaceHint | undefined {
  const one = (k: string): string | undefined => {
    const v = params[k];
    return Array.isArray(v) ? v[0] : v;
  };
  const name = one('name');
  const latRaw = one('lat');
  const lngRaw = one('lng');
  if (!name || !latRaw || !lngRaw) return undefined;
  const lat = Number(latRaw);
  const lng = Number(lngRaw);
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180) return undefined;
  return { name, coord: { lat, lng } };
}

const METERS_PER_DEG_LAT = 111_320;

/**
 * 장소 주변 반경(m) 사각형 — fitTo용. 점 하나를 그대로 넘기면 렌더러가 최대 줌으로 붙으므로
 * 약간의 폭을 준다(반경 250m ≈ 줌 16 근처).
 */
export function placeFitBounds(coord: LatLng, radiusM = 250): BBox {
  const dLat = radiusM / METERS_PER_DEG_LAT;
  const dLng = dLat / Math.max(Math.cos((coord.lat * Math.PI) / 180), 0.01);
  return {
    sw: { lat: coord.lat - dLat, lng: coord.lng - dLng },
    ne: { lat: coord.lat + dLat, lng: coord.lng + dLng },
  };
}
