/**
 * A1 — Valhalla `/route` 응답 → Route 정규화 (P4, 한국 커스텀 도보).
 *
 * Valhalla `trip.legs[]`의 각 leg = 하나의 RouteLeg (경유지 사이 구간).
 * - `leg.shape` = encoded polyline **precision 6** → `_shared` 통합 디코더(F2)로 디코드.
 *   (Google=5와 달리 Valhalla=6 — precision 미파라미터화 시 좌표 10× 오차.)
 * - `leg.summary.time`(초) → durationSec, `leg.summary.length`(km) ×1000 → distanceM.
 * - 총합은 `trip.summary.time`(초)·`trip.summary.length`(km ×1000).
 * - mode 기본 'walk'(커스텀 도보 경로). 국내 자전거는 'bike'로 호출(fetchValhallaBike).
 *
 * 앱은 폴리라인을 디코드하지 않는다 — 정규화 레이어에서 1회 수행(C1 계승).
 * 빈 응답/형식 이상은 throw (silent 금지 — 핸들러 장애 격리가 명시적 502 처리).
 */
import type { LatLng, ManeuverKind, Route, RouteLeg, RouteStep } from '@wayfinder/shared';
import { decodePolyline } from './_shared/polyline.js';

/**
 * Valhalla numeric maneuver `type` → provider-agnostic `ManeuverKind` (P5 F1 §1.2).
 *
 * 골든 픽스처에 실존하는 코드만 보수적으로 매핑(2·4·8·10·15 — 문서 표). 미매핑 코드는
 * `'unknown'`(폴백 시 instruction 원문). 전체 Valhalla 코드표 충실도는 실 응답 후 보강
 * (open-questions §P5 — 추측 매핑으로 잠재 버그를 만들지 않는다). `type` raw는 별도 보존.
 */
const VALHALLA_MANEUVER_KIND: Readonly<Record<number, ManeuverKind>> = {
  2: 'depart', // 출발/직진 시작
  4: 'arrive', // 도착
  8: 'straight', // 직진
  10: 'turn-right', // 우회전
  15: 'turn-left', // 좌회전
};

/** Valhalla numeric `type` → `ManeuverKind`. 미매핑·undefined → `'unknown'`. */
function valhallaManeuverKind(type: number | undefined): ManeuverKind {
  return (type !== undefined && VALHALLA_MANEUVER_KIND[type]) || 'unknown';
}

/** Valhalla leg summary (필요 필드만). time=초, length=km. */
interface ValhallaLegSummary {
  readonly time?: number;
  readonly length?: number;
}
/**
 * Valhalla maneuver (필요 필드만). `begin_shape_index`는 leg `shape` 디코드 좌표의
 * 인덱스 — 턴 시작 좌표 도출. `length`=km. 도착 maneuver(type 4)는 length 0·
 * street_names 부재 — 추출기가 throw하지 않아야 한다.
 */
interface ValhallaManeuver {
  readonly type?: number;
  readonly instruction?: string;
  readonly begin_shape_index?: number;
  readonly end_shape_index?: number;
  readonly street_names?: readonly string[];
  readonly length?: number;
}
interface ValhallaLeg {
  readonly shape?: string;
  readonly summary?: ValhallaLegSummary;
  readonly maneuvers?: readonly ValhallaManeuver[];
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
 * maneuvers[] → RouteStep[] (P3 F2). 이미 디코드된 leg `coords`를 재사용한다
 * (재디코드 금지). step `location` = `coords[begin_shape_index]`.
 *
 * `begin_shape_index`가 coords 범위 내임을 단언(off-by-one 방지) — 도착
 * maneuver(type 4)는 begin_shape_index = 마지막 coords 인덱스이므로 `< length`로
 * 유효. 도착 maneuver는 length 0(distanceM 0)·street_names 부재여도 throw 금지.
 *
 * @throws begin_shape_index가 coords 범위 밖일 때 (정규화 오류 — silent 금지).
 */
function extractSteps(
  maneuvers: readonly ValhallaManeuver[],
  coords: readonly LatLng[],
  legIndex: number,
): RouteStep[] {
  return maneuvers.map((m, j) => {
    const idx = m.begin_shape_index ?? 0;
    if (idx < 0 || idx >= coords.length) {
      throw new Error(
        `valhalla: leg ${legIndex} maneuver ${j} begin_shape_index ${idx} out of coords range [0, ${coords.length})`,
      );
    }
    const step: RouteStep = {
      location: coords[idx]!,
      instruction: m.instruction ?? '',
      maneuver: valhallaManeuverKind(m.type), // 정규화 enum (소비자 키)
      type: m.type ?? 0, // raw 보존 (디버그)
      distanceM: Math.round((m.length ?? 0) * KM_TO_M),
      shapeIndex: idx,
    };
    if (m.street_names && m.street_names.length > 0) {
      step.streetNames = [...m.street_names];
    }
    return step;
  });
}

/**
 * Valhalla `/route` 응답 → Route. 각 trip.leg를 단일 walk RouteLeg로 매핑.
 * @throws trip/legs 누락 또는 leg shape 디코드 결과가 비면 (silent 금지).
 */
export function normalizeValhalla(raw: ValhallaRouteRaw, mode: 'walk' | 'bike' = 'walk'): Route {
  const trip = raw.trip;
  const rawLegs = trip?.legs ?? [];
  if (rawLegs.length === 0) throw new Error('valhalla: no legs in response');

  const legs: RouteLeg[] = rawLegs.map((leg, i) => {
    const coords: LatLng[] = decodePolyline(leg.shape, VALHALLA_POLYLINE_PRECISION);
    if (coords.length === 0) {
      throw new Error(`valhalla: leg ${i} has no shape geometry`);
    }
    const routeLeg: RouteLeg = {
      start: coords[0]!,
      end: coords[coords.length - 1]!,
      mode,
      durationSec: Math.round(leg.summary?.time ?? 0),
      distanceM: Math.round((leg.summary?.length ?? 0) * KM_TO_M),
      coords,
    };
    // 하위호환: maneuvers 보유 시에만 steps 부착 (미부착=기존 P4 폴리라인 동작).
    if (leg.maneuvers && leg.maneuvers.length > 0) {
      routeLeg.steps = extractSteps(leg.maneuvers, coords, i);
    }
    return routeLeg;
  });

  return {
    legs,
    totalDurationSec: Math.round(trip?.summary?.time ?? 0),
    totalDistanceM: Math.round((trip?.summary?.length ?? 0) * KM_TO_M),
  };
}
