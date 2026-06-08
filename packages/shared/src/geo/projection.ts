/**
 * 지오 투영 — 점→폴리라인 최근접점 투영 + 누적 진행률 (P3 §4 A1). 단일 소유(중복 0).
 *
 * 네비 상태 머신(A2)·진행률(A3) 공통 입력. 한 번 투영하면:
 *  - `perpDistanceM` → A2 이탈 감지(최근접점 거리 > OFF_ROUTE_THRESHOLD_M).
 *  - `alongDistanceM` → A3 남은 거리/진행률(전체 길이 − along) · A2 step 전진.
 * 두 소비자가 한 산출을 공유하므로 재계산 0(advisor 지적).
 *
 * 좌표계: 국소 equirectangular 근사(세그먼트 중점 위도 기준 평면화). 도보 스케일
 * 세그먼트에서 충분 — F3 픽스처 테스트 헬퍼와 동일 수학이라 보정값(29/31m straddle)이
 * 일치한다.
 */
import type { LatLng } from '../types/geo.js';
import { toRadians, haversineDistanceM, EARTH_RADIUS_M } from './distance.js';

/**
 * 점→폴리라인 최근접점 투영 산물. A2(perp)·A3(along)의 단일 입력.
 */
export interface RouteProjection {
  /** 폴리라인 위 최근접점 좌표. */
  point: LatLng;
  /** 점→최근접점 수직 거리(m) — 이탈 판정 입력(A2). */
  perpDistanceM: number;
  /** 경로 시작점부터 최근접점까지 누적 진행 거리(m) — 진행률·step 전진 입력(A3·A2). */
  alongDistanceM: number;
  /** 최근접 세그먼트 인덱스 (coords[i]↔coords[i+1]). */
  segmentIndex: number;
}

/** 평면 좌표 (국소 equirectangular, 미터). */
interface PlanarPoint {
  x: number;
  y: number;
}

/** 위도 기준점으로 LatLng → 평면(m) 투영. */
function toPlanar(p: LatLng, latRefRad: number): PlanarPoint {
  return {
    x: toRadians(p.lng) * Math.cos(latRefRad) * EARTH_RADIUS_M,
    y: toRadians(p.lat) * EARTH_RADIUS_M,
  };
}

/**
 * 점→세그먼트(a,b) 투영. 수직 거리 + 세그먼트 내 진행 비율(0..1) 반환.
 * 국소 평면화는 세그먼트 중점 위도 기준 — 짧은 도보 세그먼트에서 정확.
 */
function projectOntoSegment(
  p: LatLng,
  a: LatLng,
  b: LatLng,
): { perpDistanceM: number; t: number } {
  const latRefRad = toRadians((a.lat + b.lat) / 2);
  const pp = toPlanar(p, latRefRad);
  const pa = toPlanar(a, latRefRad);
  const pb = toPlanar(b, latRefRad);
  const dx = pb.x - pa.x;
  const dy = pb.y - pa.y;
  const len2 = dx * dx + dy * dy;
  let t = len2 ? ((pp.x - pa.x) * dx + (pp.y - pa.y) * dy) / len2 : 0;
  t = Math.max(0, Math.min(1, t));
  const perpDistanceM = Math.hypot(pp.x - (pa.x + t * dx), pp.y - (pa.y + t * dy));
  return { perpDistanceM, t };
}

/**
 * 점을 폴리라인(`path`)에 투영해 최근접점·수직 거리·누적 진행 거리를 산출한다.
 *
 * 누적 진행 거리는 시작점부터 최근접 세그먼트의 시작 정점까지 haversine 합 +
 * 세그먼트 내 부분 거리(t × 세그먼트 길이). 빈/단일 점 path는 방어적으로 처리한다.
 */
export function projectToPath(point: LatLng, path: readonly LatLng[]): RouteProjection {
  if (path.length === 0) {
    return { point, perpDistanceM: 0, alongDistanceM: 0, segmentIndex: 0 };
  }
  if (path.length === 1) {
    return {
      point: path[0]!,
      perpDistanceM: haversineDistanceM(point, path[0]!),
      alongDistanceM: 0,
      segmentIndex: 0,
    };
  }

  let bestPerp = Infinity;
  let bestSegment = 0;
  let bestT = 0;
  // 각 세그먼트 시작 정점까지의 누적 거리를 진행하며 최근접 세그먼트를 찾는다.
  const cumulativeAt: number[] = new Array(path.length).fill(0);
  for (let i = 1; i < path.length; i++) {
    cumulativeAt[i] = cumulativeAt[i - 1]! + haversineDistanceM(path[i - 1]!, path[i]!);
  }

  for (let i = 0; i < path.length - 1; i++) {
    const { perpDistanceM, t } = projectOntoSegment(point, path[i]!, path[i + 1]!);
    if (perpDistanceM < bestPerp) {
      bestPerp = perpDistanceM;
      bestSegment = i;
      bestT = t;
    }
  }

  const segLength = haversineDistanceM(path[bestSegment]!, path[bestSegment + 1]!);
  const alongDistanceM = cumulativeAt[bestSegment]! + bestT * segLength;

  // 최근접점 좌표 — 세그먼트 위 t 선형 보간(LatLng 도 단위 보간, 짧은 세그먼트 충분).
  const a = path[bestSegment]!;
  const b = path[bestSegment + 1]!;
  const nearest: LatLng = {
    lat: a.lat + bestT * (b.lat - a.lat),
    lng: a.lng + bestT * (b.lng - a.lng),
  };

  return {
    point: nearest,
    perpDistanceM: bestPerp,
    alongDistanceM,
    segmentIndex: bestSegment,
  };
}

/** 폴리라인 전체 길이(m) — haversine 세그먼트 합. 진행률 분모(A3). */
export function pathLengthM(path: readonly LatLng[]): number {
  let total = 0;
  for (let i = 1; i < path.length; i++) {
    total += haversineDistanceM(path[i - 1]!, path[i]!);
  }
  return total;
}
