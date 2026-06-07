/**
 * E2 데모 모드 경로 흐름 데이터 계약 테스트.
 *
 * routeFlow.test.ts 패턴: 라우트 어댑터(app/route/*.tsx)가 의존하는 데모 모드 데이터
 * 계약을 라우트 레벨 흐름으로 검증한다(useRouteQuery 훅 자체는 web export가 검증):
 *
 *   경로입력(출발·도착·경유지 추가·순서변경 → stops 구성)
 *     → 모드탭 4종(tabToMode → RouteRequest.mode)
 *     → RouteService.getRoute(데모 모드 = mockRouteProvider)
 *     → routeToPolylines / routeSummary (결과 화면이 역참조하는 필드)
 *
 * 키 0개 데모 모드에서 4모드 + 경유지 + 시외 leg-chaining이 목 데이터로 동작함을 단언한다.
 */
import { describe, it, expect } from 'vitest';
import type { LatLng } from '@wayfinder/shared';
import { MODE_TAB_ORDER, tabToMode } from '../route/modeTabs.js';
import {
  addWaypoint,
  moveWaypointDown,
  toStops,
  type WaypointEntry,
} from '../route/waypoints.js';
import { getRoute } from '../services/RouteService.js';
import { routeSummary } from '../route/routeSummary.js';
import { routeToPolylines } from '../route/routeToPolylines.js';

// 서울 시내 좌표 (경유지 흐름용).
const ORIGIN: LatLng = { lat: 37.5563, lng: 126.9723 };
const WP_A: LatLng = { lat: 37.5601, lng: 126.985 };
const WP_B: LatLng = { lat: 37.5651, lng: 126.99 };
const DEST: LatLng = { lat: 37.5665, lng: 126.978 };
// 시외(서울→부산) — mockRouteProvider isIntercity(위도차 >1.5°) 트리거.
const BUSAN: LatLng = { lat: 35.1153, lng: 129.0413 };

describe('E2 경로 입력 흐름 — 경유지 구성 + 순서변경 → stops', () => {
  it('출발·도착 + 경유지 2개 추가 후 stops 5개? — 출발+2경유+도착=4', () => {
    let wps: WaypointEntry[] = [];
    wps = addWaypoint(wps, { label: 'A', coord: WP_A });
    wps = addWaypoint(wps, { label: 'B', coord: WP_B });
    const stops = toStops(ORIGIN, wps, DEST);
    expect(stops).toEqual([ORIGIN, WP_A, WP_B, DEST]);
  });

  it('경유지 순서변경(아래로 이동)이 stops 순서에 반영된다', () => {
    let wps: WaypointEntry[] = [];
    wps = addWaypoint(wps, { label: 'A', coord: WP_A });
    wps = addWaypoint(wps, { label: 'B', coord: WP_B });
    // A를 아래로 → [B, A]
    wps = moveWaypointDown(wps, 0);
    const stops = toStops(ORIGIN, wps, DEST);
    expect(stops).toEqual([ORIGIN, WP_B, WP_A, DEST]);
  });
});

describe('E2 모드탭 4종 → getRoute(데모) → 결과 필드', () => {
  it('4모드 전부 유효한 Route를 반환하고 폴리라인·요약이 산출된다', async () => {
    const stops = toStops(ORIGIN, [{ label: 'A', coord: WP_A }], DEST);
    for (const tab of MODE_TAB_ORDER) {
      const mode = tabToMode(tab);
      const route = await getRoute({ stops, mode });
      // 결과 화면이 역참조하는 계약: legs·총합·폴리라인.
      expect(route.legs.length).toBeGreaterThan(0);
      const summary = routeSummary(route);
      expect(summary.totalDurationSec).toBeGreaterThan(0);
      expect(summary.totalDistanceM).toBeGreaterThan(0);
      const polylines = routeToPolylines(route);
      expect(polylines.length).toBeGreaterThan(0);
      // 폴리라인은 leg.coords를 그대로 사용(앱은 디코드 안 함) — coords 비어있지 않음.
      expect(polylines.every((p) => p.coords.length > 0)).toBe(true);
    }
  });
});

describe('E2 대중교통 leg-chaining + 시외 스티칭 요약', () => {
  it('시내 대중교통: leg-chaining 요약에 노선명·환승이 포함된다', async () => {
    const stops = toStops(ORIGIN, [], DEST);
    const route = await getRoute({ stops, mode: 'transit' });
    const summary = routeSummary(route);
    expect(summary.lineNames.length).toBeGreaterThan(0);
    expect(summary.transfers).toBeGreaterThanOrEqual(1);
  });

  it('시외(서울→부산) 대중교통: 3단 스티칭 요약에 KTX 등 도시간 노선이 포함된다', async () => {
    const stops = toStops(ORIGIN, [], BUSAN);
    const route = await getRoute({ stops, mode: 'transit' });
    const summary = routeSummary(route);
    // 시외 스티칭 픽스처는 KTX 노선명을 포함한다.
    expect(summary.lineNames.some((n) => n.includes('KTX'))).toBe(true);
    expect(summary.transfers).toBeGreaterThanOrEqual(2);
  });
});
