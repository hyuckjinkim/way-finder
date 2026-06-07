/**
 * C1 — 경유지 순수 함수 단위 테스트.
 */
import { describe, it, expect } from 'vitest';
import {
  addWaypoint,
  removeWaypoint,
  moveWaypointUp,
  moveWaypointDown,
  toStops,
  MAX_WAYPOINTS,
} from './waypoints.js';
import type { WaypointEntry } from './waypoints.js';

const A: WaypointEntry = { label: 'A', coord: { lat: 37.5, lng: 127.0 } };
const B: WaypointEntry = { label: 'B', coord: { lat: 37.51, lng: 127.01 } };
const C: WaypointEntry = { label: 'C', coord: { lat: 37.52, lng: 127.02 } };
const D: WaypointEntry = { label: 'D', coord: { lat: 37.53, lng: 127.03 } };
const E: WaypointEntry = { label: 'E', coord: { lat: 37.54, lng: 127.04 } };

describe('MAX_WAYPOINTS', () => {
  it('5여야 한다', () => {
    expect(MAX_WAYPOINTS).toBe(5);
  });
});

describe('addWaypoint', () => {
  it('빈 배열에 경유지를 추가한다', () => {
    const result = addWaypoint([], A);
    expect(result).toEqual([A]);
  });

  it('기존 배열을 변경하지 않는다(immutable)', () => {
    const orig: WaypointEntry[] = [A];
    const result = addWaypoint(orig, B);
    expect(orig).toHaveLength(1);
    expect(result).toHaveLength(2);
  });

  it('MAX_WAYPOINTS(5)개이면 추가하지 않는다', () => {
    const full = [A, B, C, D, E];
    const result = addWaypoint(full, { label: 'F', coord: { lat: 37.55, lng: 127.05 } });
    expect(result).toHaveLength(5);
    expect(result[4]).toEqual(E);
  });

  it('4개에서 추가하면 5개가 된다', () => {
    const result = addWaypoint([A, B, C, D], E);
    expect(result).toHaveLength(5);
  });
});

describe('removeWaypoint', () => {
  it('중간 인덱스를 삭제한다', () => {
    const result = removeWaypoint([A, B, C], 1);
    expect(result).toEqual([A, C]);
  });

  it('첫 번째 인덱스를 삭제한다', () => {
    const result = removeWaypoint([A, B, C], 0);
    expect(result).toEqual([B, C]);
  });

  it('마지막 인덱스를 삭제한다', () => {
    const result = removeWaypoint([A, B, C], 2);
    expect(result).toEqual([A, B]);
  });

  it('범위 밖 인덱스는 원본 그대로 반환', () => {
    const orig = [A, B];
    const result = removeWaypoint(orig, 5);
    expect(result).toEqual([A, B]);
  });

  it('음수 인덱스는 원본 그대로 반환', () => {
    const result = removeWaypoint([A, B], -1);
    expect(result).toEqual([A, B]);
  });

  it('기존 배열을 변경하지 않는다(immutable)', () => {
    const orig = [A, B, C];
    removeWaypoint(orig, 0);
    expect(orig).toHaveLength(3);
  });
});

describe('moveWaypointUp', () => {
  it('인덱스 1을 위로 이동하면 0과 교환된다', () => {
    const result = moveWaypointUp([A, B, C], 1);
    expect(result).toEqual([B, A, C]);
  });

  it('인덱스 2를 위로 이동하면 1과 교환된다', () => {
    const result = moveWaypointUp([A, B, C], 2);
    expect(result).toEqual([A, C, B]);
  });

  it('인덱스 0은 위로 이동 불가 — 원본 반환', () => {
    const result = moveWaypointUp([A, B, C], 0);
    expect(result).toEqual([A, B, C]);
  });

  it('범위 밖 인덱스는 원본 반환', () => {
    const result = moveWaypointUp([A, B], 5);
    expect(result).toEqual([A, B]);
  });

  it('기존 배열을 변경하지 않는다(immutable)', () => {
    const orig = [A, B, C];
    moveWaypointUp(orig, 1);
    expect(orig[0]).toEqual(A);
    expect(orig[1]).toEqual(B);
  });
});

describe('moveWaypointDown', () => {
  it('인덱스 0을 아래로 이동하면 1과 교환된다', () => {
    const result = moveWaypointDown([A, B, C], 0);
    expect(result).toEqual([B, A, C]);
  });

  it('인덱스 1을 아래로 이동하면 2와 교환된다', () => {
    const result = moveWaypointDown([A, B, C], 1);
    expect(result).toEqual([A, C, B]);
  });

  it('마지막 인덱스는 아래로 이동 불가 — 원본 반환', () => {
    const result = moveWaypointDown([A, B, C], 2);
    expect(result).toEqual([A, B, C]);
  });

  it('범위 밖 인덱스는 원본 반환', () => {
    const result = moveWaypointDown([A, B], -1);
    expect(result).toEqual([A, B]);
  });

  it('기존 배열을 변경하지 않는다(immutable)', () => {
    const orig = [A, B, C];
    moveWaypointDown(orig, 0);
    expect(orig[0]).toEqual(A);
  });
});

describe('toStops', () => {
  const origin = { lat: 37.5, lng: 126.9 };
  const destination = { lat: 37.6, lng: 127.1 };

  it('출발+경유지+도착 순서로 stops를 만든다', () => {
    const stops = toStops(origin, [A, B], destination);
    expect(stops).toEqual([origin, A.coord, B.coord, destination]);
  });

  it('경유지 없으면 [origin, destination]', () => {
    const stops = toStops(origin, [], destination);
    expect(stops).toEqual([origin, destination]);
  });

  it('origin이 null이면 포함하지 않는다', () => {
    const stops = toStops(null, [A], destination);
    expect(stops).toEqual([A.coord, destination]);
  });

  it('destination이 null이면 포함하지 않는다', () => {
    const stops = toStops(origin, [A], null);
    expect(stops).toEqual([origin, A.coord]);
  });

  it('둘 다 null이면 경유지 좌표만', () => {
    const stops = toStops(null, [A, B], null);
    expect(stops).toEqual([A.coord, B.coord]);
  });
});
