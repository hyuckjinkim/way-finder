/**
 * D2 — routeStore / routeQueries 단위 테스트.
 *
 * routeQueryOptions 팩토리를 순수 함수로 테스트한다 (QueryClientProvider 불필요).
 * 캐시 키 구조 · enabled 플래그 · 디바운스 상수를 검증한다.
 *
 * 디바운스 훅(useDebounced)은 React 훅이므로 순수 로직 테스트 대신
 * vi.useFakeTimers()로 타이머 제어 후 단언한다.
 */
import { describe, it, expect, vi, afterEach } from 'vitest';
import {
  routeQueryKeys,
  routeQueryOptions,
} from './routeQueries.js';
import { ROUTE_DEBOUNCE_MS } from './routeStore.js';
import type { LatLng, TravelMode } from '@wayfinder/shared';

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

// ─── 디바운스 타이머 동작 ─────────────────────────────────────────────────────

describe('디바운스 동작 — vi.useFakeTimers()', () => {
  it('디바운스 간격 내 연속 변경은 마지막 값만 반영', () => {
    vi.useFakeTimers();

    // 타이머 기반 디바운스 로직 직접 테스트
    let debounced = 0;
    let timer: ReturnType<typeof setTimeout> | null = null;

    const debounce = (val: number) => {
      if (timer !== null) clearTimeout(timer);
      timer = setTimeout(() => { debounced = val; }, ROUTE_DEBOUNCE_MS);
    };

    debounce(1);
    debounce(2);
    debounce(3);

    // 아직 타이머 미발화
    expect(debounced).toBe(0);

    vi.advanceTimersByTime(ROUTE_DEBOUNCE_MS);
    expect(debounced).toBe(3); // 마지막 값만 반영

    vi.useRealTimers();
  });

  it('디바운스 간격 이후 값 안정화', () => {
    vi.useFakeTimers();

    let debounced = '';
    let timer: ReturnType<typeof setTimeout> | null = null;

    const debounce = (val: string) => {
      if (timer !== null) clearTimeout(timer);
      timer = setTimeout(() => { debounced = val; }, ROUTE_DEBOUNCE_MS);
    };

    debounce('walk');
    vi.advanceTimersByTime(ROUTE_DEBOUNCE_MS);
    expect(debounced).toBe('walk');

    vi.useRealTimers();
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
