/**
 * 경로 정렬·필터 (F4) — 이미 받은 주 경로+대안만 재배열한다(추가 API 콜 0).
 */
import type { Route } from '@wayfinder/shared';
import { transferCount, walkMinutes } from './routeResultView.js';

export type RouteSort = 'time' | 'transfers' | 'walk';
export type RouteFilter = 'all' | 'subway' | 'bus';

export const SORT_LABEL: Record<RouteSort, string> = { time: '최소시간', transfers: '최소환승', walk: '최소도보' };
export const FILTER_LABEL: Record<RouteFilter, string> = { all: '전체', subway: '지하철만', bus: '버스만' };

const SORT_KEY: Record<RouteSort, (r: Route) => number> = {
  time: (r) => r.totalDurationSec,
  transfers: transferCount,
  walk: walkMinutes,
};

/** 대중교통 leg가 모두 해당 노선 유형인지(대중교통 없는 경로는 제외). */
const onlyLine = (r: Route, type: 'subway' | 'bus'): boolean => {
  const transit = r.legs.filter((l) => l.mode === 'transit');
  return transit.length > 0 && transit.every((l) => l.transit?.lineType === type);
};

/** 필터 후 정렬. 동률은 원래(공급자) 순서 유지 — Array.sort는 안정 정렬. */
export function arrangeRoutes(routes: Route[], sort: RouteSort, filter: RouteFilter): Route[] {
  const kept = filter === 'all' ? routes : routes.filter((r) => onlyLine(r, filter));
  const key = SORT_KEY[sort];
  return [...kept].sort((a, b) => key(a) - key(b));
}
