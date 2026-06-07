/**
 * C1 — 경유지 리스트 순수 함수 (immutable).
 *
 * 상태 관리 없음. 모든 함수는 입력을 변경하지 않고 새 배열을 반환한다.
 * - 경유지(waypoints)는 출발·도착 사이의 중간 정거장.
 * - 경유지 최대 5개 (stops 최대 7 = 출발1 + 경유지5 + 도착1).
 * - 출발/도착은 별도 필드로 관리하고, 이 모듈은 경유지 배열만 담당한다.
 */
import type { LatLng } from '@wayfinder/shared';

/** 경유지 엔트리 — UI 표시용 레이블 + 좌표. */
export interface WaypointEntry {
  /** 사람이 읽을 수 있는 장소 이름 (검색 결과 name). */
  label: string;
  /** 좌표 (RouteRequest.stops에 그대로 들어간다). */
  coord: LatLng;
}

/** 경유지 최대 개수. stops = [출발, ...경유지, 도착], 경유지만 ≤5. */
export const MAX_WAYPOINTS = 5;

/**
 * 경유지 추가. 이미 MAX_WAYPOINTS개면 변경 없이 원본 반환.
 */
export function addWaypoint(
  waypoints: readonly WaypointEntry[],
  entry: WaypointEntry,
): WaypointEntry[] {
  if (waypoints.length >= MAX_WAYPOINTS) {
    return [...waypoints];
  }
  return [...waypoints, entry];
}

/**
 * 경유지 삭제. index 범위 밖이면 변경 없이 원본 반환.
 */
export function removeWaypoint(
  waypoints: readonly WaypointEntry[],
  index: number,
): WaypointEntry[] {
  if (index < 0 || index >= waypoints.length) {
    return [...waypoints];
  }
  return [...waypoints.slice(0, index), ...waypoints.slice(index + 1)];
}

/**
 * 경유지를 한 칸 위로 이동 (index와 index-1을 교환).
 * index가 0이거나 범위 밖이면 변경 없이 원본 반환.
 */
export function moveWaypointUp(
  waypoints: readonly WaypointEntry[],
  index: number,
): WaypointEntry[] {
  if (index <= 0 || index >= waypoints.length) {
    return [...waypoints];
  }
  const result = [...waypoints];
  // non-null assertion safe: bounds checked above
  const prev = result[index - 1]!;
  const curr = result[index]!;
  result[index - 1] = curr;
  result[index] = prev;
  return result;
}

/**
 * 경유지를 한 칸 아래로 이동 (index와 index+1을 교환).
 * index가 마지막이거나 범위 밖이면 변경 없이 원본 반환.
 */
export function moveWaypointDown(
  waypoints: readonly WaypointEntry[],
  index: number,
): WaypointEntry[] {
  if (index < 0 || index >= waypoints.length - 1) {
    return [...waypoints];
  }
  const result = [...waypoints];
  const curr = result[index]!;
  const next = result[index + 1]!;
  result[index] = next;
  result[index + 1] = curr;
  return result;
}

/**
 * 경유지 배열을 경로 정지점 stops 배열로 변환.
 * stops = [origin, ...waypoints.map(w => w.coord), destination].
 * origin/destination이 null이면 포함하지 않는다(불완전 입력 방어).
 */
export function toStops(
  origin: LatLng | null,
  waypoints: readonly WaypointEntry[],
  destination: LatLng | null,
): LatLng[] {
  const stops: LatLng[] = [];
  if (origin) stops.push(origin);
  for (const w of waypoints) {
    stops.push(w.coord);
  }
  if (destination) stops.push(destination);
  return stops;
}
