/**
 * 지오 거리 — haversine 대권 거리 (P3 §4 A1). 단일 소유(중복 0).
 *
 * 역할 분리(plan §0 교훈): `_shared/coords.ts`는 공급자 좌표열 *변환*(평면/쌍→LatLng)
 * 담당. 이 모듈은 거리/방위/투영 *계산* 담당 — 서로 의존하지 않는다.
 *
 * 검증 무게중심(§8): 알려진 서울 좌표쌍으로 ±오차 단위 테스트(완전 검증 가능).
 */
import type { LatLng } from '../types/geo.js';

/** 지구 평균 반지름(m) — WGS84 mean radius. */
export const EARTH_RADIUS_M = 6_371_000;

/** 도 → 라디안. */
export function toRadians(deg: number): number {
  return (deg * Math.PI) / 180;
}

/**
 * 두 WGS84 좌표 사이 haversine 대권 거리(미터).
 * 도보 스케일(수 km)에서 충분히 정확 — 타원체 보정 미적용(§9 한계 무관).
 */
export function haversineDistanceM(a: LatLng, b: LatLng): number {
  const dLat = toRadians(b.lat - a.lat);
  const dLng = toRadians(b.lng - a.lng);
  const lat1 = toRadians(a.lat);
  const lat2 = toRadians(b.lat);
  const sinDLat = Math.sin(dLat / 2);
  const sinDLng = Math.sin(dLng / 2);
  const h = sinDLat * sinDLat + Math.cos(lat1) * Math.cos(lat2) * sinDLng * sinDLng;
  return 2 * EARTH_RADIUS_M * Math.asin(Math.min(1, Math.sqrt(h)));
}
