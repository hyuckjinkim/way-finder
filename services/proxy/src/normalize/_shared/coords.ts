/**
 * F2 — 좌표 매퍼 공용 유틸 (중복 통합).
 *
 * 통합 전: kakaoMobility `flatVertexesToCoords`([lng,lat,...] 평면) +
 *          mapbox `coordsFromGeometry`·tmap `lineStringToCoords`([[lng,lat],...] 쌍) 3곳.
 * 통합 후: 평면/쌍 두 헬퍼만 사용 — 드리프트 방지(P4 carry-forward ②).
 *
 * 공급자 좌표 규약: **[lng, lat]** 순서(GeoJSON·카카오 vertexes 공통) → {lat,lng}.
 */
import type { LatLng } from '@wayfinder/shared';

/**
 * 평면 배열 `[lng,lat,lng,lat,...]` → LatLng[]. 홀수 꼬리 요소는 무시.
 * (카카오모빌리티 road.vertexes 형식.)
 */
export function flatPairsToCoords(flat: number[]): LatLng[] {
  const coords: LatLng[] = [];
  for (let i = 0; i + 1 < flat.length; i += 2) {
    coords.push({ lng: flat[i]!, lat: flat[i + 1]! });
  }
  return coords;
}

/**
 * 쌍 배열 `[[lng,lat],...]` → LatLng[]. 길이 <2 쌍은 제외(방어적).
 * (GeoJSON coordinates 형식 — Mapbox geometry·TMAP LineString 공통.)
 */
export function pairsToCoords(pairs: number[][]): LatLng[] {
  return pairs
    .filter((pair) => pair.length >= 2)
    .map((pair) => ({ lng: pair[0]!, lat: pair[1]! }));
}
