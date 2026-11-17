/**
 * D2 — routeStore / routeQueries 단위 테스트.
 *
 * routeQueryOptions 팩토리를 순수 함수로 테스트한다 (QueryClientProvider 불필요).
 * 캐시 키 구조 · enabled 플래그 · 디바운스 상수를 검증한다.
 *
 * 디바운스 훅(useDebounced)은 React 훅이므로 순수 로직 테스트 대신
 * vi.useFakeTimers()로 타이머 제어 후 단언한다.
 *
 * C2(P4): preference·maxExtraMinutes 캐시 키 포함 + 슬라이더 디바운스 추가 단언.
 */
import { describe, it, expect, vi, afterEach } from 'vitest';
import {
  routeQueryKeys,
  routeQueryOptions,
  createDebounceHandle,
  scheduleDebounce,
} from './routeQueries.js';
import { ROUTE_DEBOUNCE_MS } from './routeStore.js';
import { ApiError } from '../services/apiClient.js';
import type { LatLng, RoutePreference, TravelMode } from '@wayfinder/shared';

const SEOUL_A: LatLng = { lat: 37.5563, lng: 126.9723 };
const SEOUL_C: LatLng = { lat: 37.5665, lng: 126.978 };

afterEach(() => {
  vi.restoreAllMocks();
});

// ─── 캐시 키 팩토리 ────────────────────────────────────────────────────────────

describe('routeQueryKeys — 캐시 키 구조', () => {
  it('키는 [route, mode, stops직렬화] 형태', () => {
    const key = routeQueryKeys.route([SEOUL_A, SEOUL_C], 'walk');
    expect(key[0]).toBe('route');
    expect(key[1]).toBe('walk');
    expect(typeof key[2]).toBe('string');
    expect(key[2]).toContain('37.5563');
  });

  it('stops 순서가 같으면 동일 키', () => {
    const k1 = routeQueryKeys.route([SEOUL_A, SEOUL_C], 'walk');
    const k2 = routeQueryKeys.route([SEOUL_A, SEOUL_C], 'walk');
    expect(k1).toEqual(k2);
  });

  it('mode가 다르면 다른 키', () => {
    const kWalk = routeQueryKeys.route([SEOUL_A, SEOUL_C], 'walk');
    const kCar = routeQueryKeys.route([SEOUL_A, SEOUL_C], 'car');
    expect(kWalk).not.toEqual(kCar);
  });

  it('stops가 다르면 다른 키', () => {
    const k1 = routeQueryKeys.route([SEOUL_A, SEOUL_C], 'transit');
    const k2 = routeQueryKeys.route([SEOUL_C, SEOUL_A], 'transit');
    expect(k1).not.toEqual(k2);
  });
});

// ─── routeQueryOptions — 활성화 조건 ────────────────────────────────────────────

describe('routeQueryOptions — 활성화 조건', () => {
  it('stops.length >= 2면 enabled=true', () => {
    const opts = routeQueryOptions([SEOUL_A, SEOUL_C], 'walk');
    expect(opts.enabled).toBe(true);
  });

  it('stops.length < 2면 enabled=false', () => {
    const opts = routeQueryOptions([SEOUL_A], 'walk');
    expect(opts.enabled).toBe(false);
  });

  it('stops가 비어 있으면 enabled=false', () => {
    const opts = routeQueryOptions([], 'transit');
    expect(opts.enabled).toBe(false);
  });

  it('경유지 포함(3개 stops)도 enabled=true', () => {
    const opts = routeQueryOptions([SEOUL_A, SEOUL_C, SEOUL_A], 'car');
    expect(opts.enabled).toBe(true);
  });
});

// ─── routeQueryOptions — staleTime ───────────────────────────────────────────

describe('routeQueryOptions — staleTime', () => {
  it('staleTime이 양수(1분)', () => {
    const opts = routeQueryOptions([SEOUL_A, SEOUL_C], 'walk');
    expect((opts.staleTime ?? 0)).toBeGreaterThan(0);
  });
});

// ─── 디바운스 상수 ────────────────────────────────────────────────────────────

describe('ROUTE_DEBOUNCE_MS — §11 쿼터 방어 상수', () => {
  it('양수 ms 값', () => {
    expect(ROUTE_DEBOUNCE_MS).toBeGreaterThan(0);
  });

  it('합리적인 범위(100ms ~ 2000ms)', () => {
    expect(ROUTE_DEBOUNCE_MS).toBeGreaterThanOrEqual(100);
    expect(ROUTE_DEBOUNCE_MS).toBeLessThanOrEqual(2000);
  });
});

// ─── 디바운스 타이머 동작 (실제 scheduleDebounce — useDebounced 훅이 쓰는 로직) ──────

describe('scheduleDebounce — useDebounced가 사용하는 실제 디바운스 로직', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('디바운스 간격 내 연속 변경은 마지막 값만 commit', () => {
    vi.useFakeTimers();
    const handle = createDebounceHandle();
    let debounced = 0;
    const commit = (v: number) => {
      debounced = v;
    };

    scheduleDebounce(handle, 1, ROUTE_DEBOUNCE_MS, commit);
    scheduleDebounce(handle, 2, ROUTE_DEBOUNCE_MS, commit);
    scheduleDebounce(handle, 3, ROUTE_DEBOUNCE_MS, commit);

    // 아직 타이머 미발화
    expect(debounced).toBe(0);

    vi.advanceTimersByTime(ROUTE_DEBOUNCE_MS);
    expect(debounced).toBe(3); // 마지막 값만 반영
  });

  it('디바운스 간격 이후 값 안정화', () => {
    vi.useFakeTimers();
    const handle = createDebounceHandle();
    let debounced = '';
    const commit = (v: string) => {
      debounced = v;
    };

    scheduleDebounce(handle, 'walk', ROUTE_DEBOUNCE_MS, commit);
    vi.advanceTimersByTime(ROUTE_DEBOUNCE_MS);
    expect(debounced).toBe('walk');
  });

  it('간격 경과 전에는 commit하지 않는다', () => {
    vi.useFakeTimers();
    const handle = createDebounceHandle();
    const commit = vi.fn();

    scheduleDebounce(handle, 42, ROUTE_DEBOUNCE_MS, commit);
    vi.advanceTimersByTime(ROUTE_DEBOUNCE_MS - 1);
    expect(commit).not.toHaveBeenCalled();

    vi.advanceTimersByTime(1);
    expect(commit).toHaveBeenCalledExactlyOnceWith(42);
  });

  it('반환된 정리 함수가 대기 중 타이머를 취소한다', () => {
    vi.useFakeTimers();
    const handle = createDebounceHandle();
    const commit = vi.fn();

    const cleanup = scheduleDebounce(handle, 7, ROUTE_DEBOUNCE_MS, commit);
    cleanup();
    vi.advanceTimersByTime(ROUTE_DEBOUNCE_MS);
    expect(commit).not.toHaveBeenCalled();
  });
});

// ─── routeQueryOptions — queryFn 호출 계약 ───────────────────────────────────

describe('routeQueryOptions — queryFn', () => {
  it('queryFn 존재 (함수)', () => {
    const opts = routeQueryOptions([SEOUL_A, SEOUL_C], 'walk');
    expect(typeof opts.queryFn).toBe('function');
  });

  it('4종 모드 모두 queryFn 정의됨', () => {
    const modes: TravelMode[] = ['walk', 'car', 'bike', 'transit'];
    for (const mode of modes) {
      const opts = routeQueryOptions([SEOUL_A, SEOUL_C], mode);
      expect(typeof opts.queryFn).toBe('function');
    }
  });
});

// ─── C2(P4): preference·maxExtraMinutes 캐시 키 포함 ────────────────────────

describe('routeQueryKeys — C2(P4) preference·maxExtraMinutes 포함', () => {
  it('preference 미지정 시 기본값(fastest)으로 정규화', () => {
    const k1 = routeQueryKeys.route([SEOUL_A, SEOUL_C], 'walk');
    const k2 = routeQueryKeys.route([SEOUL_A, SEOUL_C], 'walk', undefined);
    expect(k1).toEqual(k2);
  });

  it('preference가 다르면 다른 키', () => {
    const kFastest = routeQueryKeys.route([SEOUL_A, SEOUL_C], 'walk', 'fastest');
    const kSafe = routeQueryKeys.route([SEOUL_A, SEOUL_C], 'walk', 'safe');
    expect(kFastest).not.toEqual(kSafe);
  });

  it('maxExtraMinutes가 다르면 다른 키', () => {
    const k10 = routeQueryKeys.route([SEOUL_A, SEOUL_C], 'walk', 'safe', 10);
    const k20 = routeQueryKeys.route([SEOUL_A, SEOUL_C], 'walk', 'safe', 20);
    expect(k10).not.toEqual(k20);
  });

  it('maxExtraMinutes 미지정과 undefined는 동일 키', () => {
    const kUndef = routeQueryKeys.route([SEOUL_A, SEOUL_C], 'walk', 'safe', undefined);
    const kOmit = routeQueryKeys.route([SEOUL_A, SEOUL_C], 'walk', 'safe');
    expect(kUndef).toEqual(kOmit);
  });

  it('기존 key[0..2] 구조 불변 (하위호환)', () => {
    const key = routeQueryKeys.route([SEOUL_A, SEOUL_C], 'walk', 'safe', 10);
    expect(key[0]).toBe('route');
    expect(key[1]).toBe('walk');
    expect(key[2]).toContain('37.5563');
  });

  it('모든 RoutePreference 값이 각각 다른 키 생성', () => {
    const prefs: RoutePreference[] = ['fastest', 'walkable', 'safe', 'quiet', 'scenic'];
    const keys = prefs.map((p) => routeQueryKeys.route([SEOUL_A, SEOUL_C], 'walk', p));
    const unique = new Set(keys.map((k) => JSON.stringify(k)));
    expect(unique.size).toBe(prefs.length);
  });
});

describe('routeQueryOptions — C2(P4) preference·maxExtraMinutes queryFn 전달', () => {
  it('preference·maxExtraMinutes가 queryKey에 반영된다', () => {
    const opts = routeQueryOptions([SEOUL_A, SEOUL_C], 'walk', 'safe', 15);
    const key = opts.queryKey as unknown[];
    // key 구조: ['route', mode, stops, preference, maxExtraMinutes]
    expect(key[3]).toBe('safe');
    expect(key[4]).toBe(15);
  });

  it('preference 없이 호출해도 enabled 정상 (하위호환)', () => {
    const opts = routeQueryOptions([SEOUL_A, SEOUL_C], 'walk');
    expect(opts.enabled).toBe(true);
  });
});

// ─── C2(P4): 슬라이더(maxExtraMinutes) 디바운스 — scheduleDebounce 재사용 ─────

describe('scheduleDebounce — C2(P4) 슬라이더 N분 디바운스', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('슬라이더 연속 변경은 마지막 N분만 commit', () => {
    vi.useFakeTimers();
    const handle = createDebounceHandle();
    let committed: number | undefined;
    const commit = (v: number) => { committed = v; };

    scheduleDebounce(handle, 5, ROUTE_DEBOUNCE_MS, commit);
    scheduleDebounce(handle, 10, ROUTE_DEBOUNCE_MS, commit);
    scheduleDebounce(handle, 15, ROUTE_DEBOUNCE_MS, commit);

    expect(committed).toBeUndefined();
    vi.advanceTimersByTime(ROUTE_DEBOUNCE_MS);
    expect(committed).toBe(15);
  });

  it('디바운스 간격 전에는 N분 미commit', () => {
    vi.useFakeTimers();
    const handle = createDebounceHandle();
    const commit = vi.fn();

    scheduleDebounce(handle, 20, ROUTE_DEBOUNCE_MS, commit);
    vi.advanceTimersByTime(ROUTE_DEBOUNCE_MS - 1);
    expect(commit).not.toHaveBeenCalled();

    vi.advanceTimersByTime(1);
    expect(commit).toHaveBeenCalledExactlyOnceWith(20);
  });
});

describe('routeQueryOptions — retry (501 미지원은 즉시 안내)', () => {
  const retry = routeQueryOptions([SEOUL_A, SEOUL_C], 'car').retry as (n: number, e: Error) => boolean;

  it('501 MODE_UNAVAILABLE은 재시도하지 않는다', () => {
    expect(retry(0, new ApiError(501, 'API error 501'))).toBe(false);
  });

  it('그 외 오류는 1회만 재시도 (ODsay 공유 쿼터 보호)', () => {
    expect(retry(0, new ApiError(502, 'API error 502'))).toBe(true);
    expect(retry(1, new Error('network'))).toBe(false);
  });
});
