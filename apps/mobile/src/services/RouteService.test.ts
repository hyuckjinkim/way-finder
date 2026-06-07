/**
 * D1 — RouteService 단위 테스트.
 *
 * 두 모드 검증:
 * 1. 데모 모드: mockRouteProvider 위임 — apiPost 미호출
 * 2. 실 모드: apiPost 호출 — 첫 인자가 routesPath(shared import)와 정확히 일치 (와이어 테스트)
 *
 * 와이어 테스트(critic C3): apiClient 모듈을 vi.mock으로 격리해 isDemoMode를 제어하고,
 * apiPost 스파이가 `routesPath` 상수(shared import)와 동일한 첫 인자로 호출됨을 단언한다.
 * 리터럴 하드코딩이 있으면 이 테스트가 실패한다.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Mock } from 'vitest';
import { routesPath } from '@wayfinder/shared/api';
import type { RouteRequest } from '@wayfinder/shared';

// ─── apiClient 모듈 모킹 (isDemoMode 직접 제어) ─────────────────────────────────
vi.mock('./apiClient.js', () => ({
  isDemoMode: false, // 기본값 실 모드; 각 테스트에서 재정의
  apiPost: vi.fn(),
  apiFetch: vi.fn(),
}));

// ─── 공통 픽스처 ─────────────────────────────────────────────────────────────────
const SEOUL_A = { lat: 37.5563, lng: 126.9723 };
const SEOUL_C = { lat: 37.5665, lng: 126.978 };

const WALK_REQ: RouteRequest = {
  stops: [SEOUL_A, SEOUL_C],
  mode: 'walk',
};

describe('RouteService — 데모 모드', () => {
  beforeEach(async () => {
    vi.resetModules();
    // 데모 모드로 재구성
    vi.doMock('./apiClient.js', () => ({
      isDemoMode: true,
      apiPost: vi.fn(),
      apiFetch: vi.fn(),
    }));
  });

  it('mockRouteProvider 위임 — apiPost 미호출', async () => {
    const { apiPost } = await import('./apiClient.js');
    const { getRoute } = await import('./RouteService.js');

    const result = await getRoute(WALK_REQ);

    expect(result).toBeDefined();
    expect(result.legs.length).toBeGreaterThan(0);
    expect(result.totalDurationSec).toBeGreaterThan(0);
    expect((apiPost as Mock)).not.toHaveBeenCalled();
  });

  it('walk 모드 — legs의 mode가 walk인 leg 포함', async () => {
    const { getRoute } = await import('./RouteService.js');
    const result = await getRoute(WALK_REQ);
    expect(result.legs.some((leg) => leg.mode === 'walk')).toBe(true);
  });

  it('transit 모드 — legs 반환', async () => {
    const { getRoute } = await import('./RouteService.js');
    const result = await getRoute({ stops: [SEOUL_A, SEOUL_C], mode: 'transit' });
    expect(result.legs.length).toBeGreaterThan(0);
  });

  it('car 모드 — legs 반환', async () => {
    const { getRoute } = await import('./RouteService.js');
    const result = await getRoute({ stops: [SEOUL_A, SEOUL_C], mode: 'car' });
    expect(result.legs.length).toBeGreaterThan(0);
  });

  it('bike 모드 — legs 반환', async () => {
    const { getRoute } = await import('./RouteService.js');
    const result = await getRoute({ stops: [SEOUL_A, SEOUL_C], mode: 'bike' });
    expect(result.legs.length).toBeGreaterThan(0);
  });
});

describe('RouteService — 실 모드 (apiPost 스파이)', () => {
  const MOCK_ROUTE = {
    legs: [
      {
        start: SEOUL_A,
        end: SEOUL_C,
        mode: 'walk' as const,
        durationSec: 900,
        distanceM: 1100,
        coords: [SEOUL_A, SEOUL_C],
      },
    ],
    totalDurationSec: 900,
    totalDistanceM: 1100,
  };

  beforeEach(() => {
    vi.resetModules();
    // 실 모드로 재구성
    vi.doMock('./apiClient.js', () => ({
      isDemoMode: false,
      apiPost: vi.fn().mockResolvedValue(MOCK_ROUTE),
      apiFetch: vi.fn(),
    }));
  });

  it('apiPost 호출 — 첫 인자가 routesPath(shared import)와 정확히 일치 (와이어 테스트)', async () => {
    const { apiPost } = await import('./apiClient.js');
    const { getRoute } = await import('./RouteService.js');

    await getRoute(WALK_REQ);

    expect((apiPost as Mock)).toHaveBeenCalledOnce();
    // 핵심 와이어 단언: 첫 인자 === shared/api 에서 import한 routesPath 상수
    const firstArg = (apiPost as Mock).mock.calls[0]?.[0];
    expect(firstArg).toBe(routesPath);
  });

  it('apiPost 호출 — 두 번째 인자가 RouteRequest 그대로', async () => {
    const { apiPost } = await import('./apiClient.js');
    const { getRoute } = await import('./RouteService.js');

    await getRoute(WALK_REQ);

    const secondArg = (apiPost as Mock).mock.calls[0]?.[1];
    expect(secondArg).toEqual(WALK_REQ);
  });

  it('apiPost 반환값을 Route로 전달한다', async () => {
    const { getRoute } = await import('./RouteService.js');

    const result = await getRoute(WALK_REQ);

    expect(result).toEqual(MOCK_ROUTE);
  });

  it('apiPost throw 시 에러 전파', async () => {
    vi.resetModules();
    vi.doMock('./apiClient.js', () => ({
      isDemoMode: false,
      apiPost: vi.fn().mockRejectedValue(new Error('API error 500')),
      apiFetch: vi.fn(),
    }));
    const { getRoute } = await import('./RouteService.js');

    await expect(getRoute(WALK_REQ)).rejects.toThrow('API error 500');
  });
});
