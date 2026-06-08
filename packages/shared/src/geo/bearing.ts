/**
 * 지오 방위 — initial bearing (P3 §4 A1). 단일 소유(중복 0).
 *
 * 턴 안내 방위·진행 방향 비교의 입력. forward azimuth(출발점에서 목적점을 향하는
 * 초기 방위), 0..360도(북=0, 동=90).
 */
import type { LatLng } from '../types/geo.js';
import { toRadians } from './distance.js';

/**
 * `from`에서 `to`를 향하는 initial bearing(도, 0..360, 북=0 시계방향).
 * 동일 좌표는 0 반환(방향 미정의 — 방어적).
 */
export function initialBearingDeg(from: LatLng, to: LatLng): number {
  const lat1 = toRadians(from.lat);
  const lat2 = toRadians(to.lat);
  const dLng = toRadians(to.lng - from.lng);
  const y = Math.sin(dLng) * Math.cos(lat2);
  const x =
    Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLng);
  const deg = (Math.atan2(y, x) * 180) / Math.PI;
  return (deg + 360) % 360;
}
