/**
 * TMAP 자전거 경로 (GeoJSON) → Route 정규화 (A1, 한국 자전거).
 *
 * 보행자와 동일한 GeoJSON 구조를 공유 — normalizeTmapGeoJson 재사용, mode='bike'.
 * **실 형식 미검증 → open-questions 로깅 대상 (§신규 결정). 미가용 구간은
 * 도보 leg-chaining 폴백이나, 폴백 합성은 다이렉트 모드 범위 밖(B 스트림 패턴).**
 */
import type { Route } from '@wayfinder/shared';
import { normalizeTmapGeoJson, type TmapGeoJsonRaw } from './tmapPedestrian.js';

/** TMAP 자전거 응답 → Route (mode='bike'). */
export function normalizeTmapBike(raw: TmapGeoJsonRaw): Route {
  return normalizeTmapGeoJson(raw, 'bike');
}
