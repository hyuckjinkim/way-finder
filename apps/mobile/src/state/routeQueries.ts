/**
 * D2 — 경로 TanStack Query 훅 + queryOptions 팩토리.
 *
 * queries.ts 패턴 그대로:
 * - queryOptions 팩토리를 별도 export → 렌더러 없이 순수 로직 단위 테스트 가능.
 * - useRouteQuery: stops + mode로 경로 탐색. stops.length >= 2일 때만 활성화.
 * - 디바운스: ROUTE_DEBOUNCE_MS 간격으로 실제 fetch 억제 (§11 쿼터 방어선).
 *
 * 화면 컴포넌트를 import하지 않는다.
 */
import {
  useQuery,
  type UseQueryOptions,
  type UseQueryResult,
} from '@tanstack/react-query';
import { useRef, useEffect, useState } from 'react';
import type { LatLng, Route, RoutePreference, TravelMode } from '@wayfinder/shared';
import type { Capabilities } from '@wayfinder/shared/api';
import { getRoute, isModeUnavailable } from '../services/RouteService.js';
import { getCapabilities } from '../services/CapabilitiesService.js';
import { ROUTE_DEBOUNCE_MS } from './routeStore.js';

// ─── 캐시 키 팩토리 ────────────────────────────────────────────────────────────

export const routeQueryKeys = {
  route: (
    stops: LatLng[],
    mode: TravelMode,
    preference?: RoutePreference,
    maxExtraMinutes?: number,
  ) =>
    [
      'route',
      mode,
      stops.map((s) => `${s.lat},${s.lng}`).join('|'),
      preference ?? 'fastest',
      maxExtraMinutes ?? 'unlimited',
    ] as const,
} as const;

// ─── queryOptions 팩토리 (렌더러 없이 테스트 가능) ─────────────────────────────

/**
 * 경로 탐색 queryOptions.
 * stops.length >= 2 일 때만 enabled — 출발/도착 모두 있을 때만 탐색.
 * P4 D1: preference·maxExtraMinutes가 캐시 키 + queryFn body에 포함된다.
 */
export function routeQueryOptions(
  stops: LatLng[],
  mode: TravelMode,
  preference?: RoutePreference,
  maxExtraMinutes?: number,
): UseQueryOptions<Route, Error> {
  return {
    queryKey: routeQueryKeys.route(stops, mode, preference, maxExtraMinutes),
    queryFn: () => getRoute({ stops, mode, preference, maxExtraMinutes }),
    enabled: stops.length >= 2,
    staleTime: 60_000, // 1분
    // 미지원(501)은 재시도 무의미 — 즉시 안내. 그 외는 1회만: 웹 대중교통은 시도마다 ODsay 직접+프록시 호출이라
    // 공유 쿼터(1,000건/일, 키가 번들에 공개)를 재시도가 곱하지 않게.
    retry: (failureCount, err) => !isModeUnavailable(err) && failureCount < 1,
  };
}

// ─── 디바운스 유틸 (의존성 없이 자체 구현 — F3 의존 추가 금지) ──────────────────

/**
 * 디바운스 타이머 핸들 — 직전 타이머 참조를 mutable하게 들고 있는다.
 * 훅(useDebounced)과 단위 테스트가 동일한 스케줄링 로직을 공유한다(인라인 재구현 금지).
 */
export interface DebounceHandle {
  timer: ReturnType<typeof setTimeout> | null;
}

/** 새 DebounceHandle 생성. */
export function createDebounceHandle(): DebounceHandle {
  return { timer: null };
}

/**
 * 직전 타이머를 취소하고 `delayMs`ms 뒤에 `commit(value)`를 1회 발화하도록 예약한다.
 * 간격 내 연속 호출은 마지막 값만 commit된다(§11 쿼터 방어). 정리 함수를 반환한다.
 */
export function scheduleDebounce<T>(
  handle: DebounceHandle,
  value: T,
  delayMs: number,
  commit: (v: T) => void,
): () => void {
  if (handle.timer !== null) {
    clearTimeout(handle.timer);
  }
  handle.timer = setTimeout(() => {
    commit(value);
  }, delayMs);

  return () => {
    if (handle.timer !== null) {
      clearTimeout(handle.timer);
    }
  };
}

/**
 * 값이 변경될 때 `delayMs`ms 후에 안정화된 값을 반환한다.
 * stops/mode 편집 중 연속 탐색 억제용 (§11 쿼터 방어).
 */
export function useDebounced<T>(value: T, delayMs: number): T {
  const [debounced, setDebounced] = useState<T>(value);
  const handleRef = useRef<DebounceHandle>(createDebounceHandle());

  useEffect(
    () => scheduleDebounce(handleRef.current, value, delayMs, setDebounced),
    [value, delayMs],
  );

  return debounced;
}

// ─── React Query 훅 ────────────────────────────────────────────────────────────

/**
 * stops + mode(+ P4 preference·maxExtraMinutes)로 경로를 탐색한다.
 * 경유지 편집 중 연속 호출을 `ROUTE_DEBOUNCE_MS` 디바운스로 억제한다.
 */
export function useRouteQuery(
  stops: LatLng[],
  mode: TravelMode,
  preference?: RoutePreference,
  maxExtraMinutes?: number,
): UseQueryResult<Route, Error> {
  const debouncedStops = useDebounced(stops, ROUTE_DEBOUNCE_MS);
  const debouncedMode = useDebounced(mode, ROUTE_DEBOUNCE_MS);
  const debouncedPreference = useDebounced(preference, ROUTE_DEBOUNCE_MS);
  const debouncedMaxExtraMinutes = useDebounced(maxExtraMinutes, ROUTE_DEBOUNCE_MS);
  return useQuery(
    routeQueryOptions(debouncedStops, debouncedMode, debouncedPreference, debouncedMaxExtraMinutes),
  );
}

// ─── capabilities ───────────────────────────────────────────────────────────────

/** 지원 이동수단 — 세션 동안 거의 안 바뀌므로 길게 캐시. 실패 시 data=undefined → 화면은 전 모드 노출. */
export const capabilitiesQueryOptions: UseQueryOptions<Capabilities, Error> = {
  queryKey: ['capabilities'],
  queryFn: getCapabilities,
  staleTime: 60 * 60_000,
  retry: 1,
};

export function useCapabilities(): Capabilities | undefined {
  return useQuery(capabilitiesQueryOptions).data;
}
