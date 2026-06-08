/**
 * A1 — Valhalla `/route` 응답 → Route 정규화 (P4, 한국 커스텀 도보).
 *
 * Valhalla `trip.legs[]`의 각 leg = 하나의 RouteLeg (경유지 사이 구간).
 * - `leg.shape` = encoded polyline **precision 6** → `_shared` 통합 디코더(F2)로 디코드.
 *   (Google=5와 달리 Valhalla=6 — precision 미파라미터화 시 좌표 10× 오차.)
 * - `leg.summary.time`(초) → durationSec, `leg.summary.length`(km) ×1000 → distanceM.
 * - 총합은 `trip.summary.time`(초)·`trip.summary.length`(km ×1000).
 * - mode는 항상 'walk' (Valhalla 커스텀 경로 = 한국·도보 전용, §8 명시적 한계).
 *
 * 앱은 폴리라인을 디코드하지 않는다 — 정규화 레이어에서 1회 수행(C1 계승).
 * 빈 응답/형식 이상은 throw (silent 금지 — 핸들러 장애 격리가 명시적 502 처리).
 */
import type { LatLng, Route, RouteLeg } from '@wayfinder/shared';
import { decodePolyline } from './_shared/polyline.js';

/** Valhalla leg summary (필요 필드만). time=초, length=km. */
interface ValhallaLegSummary {
  readonly time?: number;
  readonly length?: number;
}
interface ValhallaLeg {
  readonly shape?: string;
  readonly summary?: ValhallaLegSummary;
}
interface ValhallaTrip {
  readonly legs?: readonly ValhallaLeg[];
  readonly summary?: ValhallaLegSummary;
  readonly status?: number;
}
/**
 * Valhalla `/route` 응답 (필요 필드만). 골든 픽스처(`as const`, readonly)와 실 fetch
 * 응답을 모두 받기 위해 readonly로 둔다 — 정규화는 새 mutable 객체를 생성한다.
 */
export interface ValhallaRouteRaw {
  readonly trip?: ValhallaTrip;
}

/** Valhalla shape는 precision 6 (§1 검증). 좌표 10× 오차 방지 — 상수화. */
const VALHALLA_POLYLINE_PRECISION = 6;
/** km → m 변환 (Valhalla units=kilometers). */
const KM_TO_M = 1000;

/**
 * Valhalla `/route` 응답 → Route. 각 trip.leg를 단일 walk RouteLeg로 매핑.
 * @throws trip/legs 누락 또는 leg shape 디코드 결과가 비면 (silent 금지).
 */
export function normalizeValhalla(raw: ValhallaRouteRaw): Route {
  const trip = raw.trip;
  const rawLegs = trip?.legs ?? [];
  if (rawLegs.length === 0) throw new Error('valhalla: no legs in response');

  const legs: RouteLeg[] = rawLegs.map((leg, i) => {
    const coords: LatLng[] = decodePolyline(leg.shape, VALHALLA_POLYLINE_PRECISION);
    if (coords.length === 0) {
      throw new Error(`valhalla: leg ${i} has no shape geometry`);
    }
    return {
      start: coords[0]!,
      end: coords[coords.length - 1]!,
      mode: 'walk',
      durationSec: Math.round(leg.summary?.time ?? 0),
      distanceM: Math.round((leg.summary?.length ?? 0) * KM_TO_M),
      coords,
    };
  });

  return {
    legs,
    totalDurationSec: Math.round(trip?.summary?.time ?? 0),
    totalDistanceM: Math.round((trip?.summary?.length ?? 0) * KM_TO_M),
  };
}
