/**
 * D2 — 경로 Zustand 스토어.
 *
 * 경로 탐색 상태:
 * - stops: 경유 좌표 순서열 [출발, ...경유, 도착]
 * - mode: 이동 수단
 * - result: 탐색 결과 Route (null = 미탐색/초기화)
 * - preference: 경로 선호 프로필 (P4 D1 — 미지정='fastest')
 * - maxExtraMinutes: "+N분" 예산 (P4 D1 — 미지정=무제한)
 *
 * 화면 컴포넌트를 import하지 않는다 — 훅/서비스만 export.
 */
import { create } from 'zustand';
import type { LatLng, Route, RoutePreference, TravelMode } from '@wayfinder/shared';

/** 디바운스 간격(ms) — §11 쿼터 방어: 경유지 편집 중 연속 호출 억제. */
export const ROUTE_DEBOUNCE_MS = 600;

export interface RouteState {
  /** 경유 좌표 순서열. stops[0]=출발, stops[last]=도착, 그 사이=경유지. */
  stops: LatLng[];
  /** 이동 수단. */
  mode: TravelMode;
  /** 탐색 결과. null = 미탐색. */
  result: Route | null;
  /** 경로 선호 프로필 (P4). undefined=fastest=기존 동작. */
  preference: RoutePreference | undefined;
  /** "+N분" 예산 (P4 2-call 필터). undefined=무제한. */
  maxExtraMinutes: number | undefined;
}

export interface RouteActions {
  setStops(stops: LatLng[]): void;
  setMode(mode: TravelMode): void;
  setResult(result: Route | null): void;
  setPreference(preference: RoutePreference | undefined): void;
  setMaxExtraMinutes(maxExtraMinutes: number | undefined): void;
  resetRoute(): void;
}

export const useRouteStore = create<RouteState & RouteActions>((set) => ({
  // 초기 상태
  stops: [],
  mode: 'transit',
  result: null,
  preference: undefined,
  maxExtraMinutes: undefined,

  // 액션
  setStops: (stops) => set({ stops }),
  setMode: (mode) => set({ mode }),
  setResult: (result) => set({ result }),
  setPreference: (preference) => set({ preference }),
  setMaxExtraMinutes: (maxExtraMinutes) => set({ maxExtraMinutes }),
  resetRoute: () =>
    set({ stops: [], mode: 'transit', result: null, preference: undefined, maxExtraMinutes: undefined }),
}));
