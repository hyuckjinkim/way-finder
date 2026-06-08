/**
 * F2 — encoded polyline 디코드 공용 유틸 (중복 통합 + precision 파라미터화).
 *
 * 통합 전: googleRoutes.ts·googleTransit.ts 각각 `decodePolyline` 정의(2곳 중복).
 * 통합 후: 이 단일 정의만 사용.
 *
 * **precision 인자 필수 (P4 핵심 함정 — load-bearing):**
 * - Google encoded polyline = **precision 5** (`@googlemaps/polyline-codec` 기본).
 * - Valhalla encoded polyline = **precision 6**.
 * 미파라미터화 시 좌표 10× 오차 → 항상 명시 전달한다.
 *
 * 디코드 실패는 throw(삼키지 않음 — 장애 격리 미들웨어가 명시적 502 처리).
 * 누락(빈 문자열/undefined)은 빈 배열.
 */
import { decode } from '@googlemaps/polyline-codec';
import type { LatLng } from '@wayfinder/shared';

/**
 * encoded polyline → LatLng[]. `decode`는 [lat,lng] 튜플 반환.
 * @param encoded   인코딩 폴리라인 문자열 (누락이면 빈 배열).
 * @param precision 좌표 정밀도 (Google=5, Valhalla=6). **필수**.
 */
export function decodePolyline(
  encoded: string | undefined,
  precision: number,
): LatLng[] {
  if (!encoded) return [];
  return decode(encoded, precision).map(([lat, lng]) => ({ lat, lng }));
}
