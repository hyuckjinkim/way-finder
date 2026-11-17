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
 *
 * C1(P4): preference·maxExtraMinutes 전달 단언 — 드리프트 방지.
 * RouteService.ts는 req 전체를 그대로 전달하므로 필드가 body에 통과되어야 한다.
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

// ─── C1(P4): preference·maxExtraMinutes 전달 단언 ─────────────────────────────
// routesPath 상수 와이어 테스트(위)의 보완 — 확장 필드가 apiPost body에 그대로
// 통과되는지 개별 필드 단언. 미래에 getRoute가 req를 재구성할 때 드리프트를 잡는다.

describe('RouteService — C1(P4) preference·maxExtraMinutes 전달 (와이어 테스트)', () => {
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
    vi.doMock('./apiClient.js', () => ({
      isDemoMode: false,
      apiPost: vi.fn().mockResolvedValue(MOCK_ROUTE),
      apiFetch: vi.fn(),
    }));
  });

  it('preference 필드가 apiPost body에 포함된다', async () => {
    const { apiPost } = await import('./apiClient.js');
    const { getRoute } = await import('./RouteService.js');
    const req: RouteRequest = { stops: [SEOUL_A, SEOUL_C], mode: 'walk', preference: 'safe' };

    await getRoute(req);

    const body = (apiPost as Mock).mock.calls[0]?.[1] as RouteRequest;
    expect(body.preference).toBe('safe');
  });

  it('maxExtraMinutes 필드가 apiPost body에 포함된다', async () => {
    const { apiPost } = await import('./apiClient.js');
    const { getRoute } = await import('./RouteService.js');
    const req: RouteRequest = {
      stops: [SEOUL_A, SEOUL_C],
      mode: 'walk',
      preference: 'walkable',
      maxExtraMinutes: 10,
    };

    await getRoute(req);

    const body = (apiPost as Mock).mock.calls[0]?.[1] as RouteRequest;
    expect(body.preference).toBe('walkable');
    expect(body.maxExtraMinutes).toBe(10);
  });

  it('preference 미지정 시 body에 undefined (하위호환)', async () => {
    const { apiPost } = await import('./apiClient.js');
    const { getRoute } = await import('./RouteService.js');

    await getRoute(WALK_REQ);

    const body = (apiPost as Mock).mock.calls[0]?.[1] as RouteRequest;
    expect(body.preference).toBeUndefined();
    expect(body.maxExtraMinutes).toBeUndefined();
  });

  it('routesPath 상수 — preference 있어도 첫 인자 불변', async () => {
    const { apiPost } = await import('./apiClient.js');
    const { getRoute } = await import('./RouteService.js');
    const req: RouteRequest = { stops: [SEOUL_A, SEOUL_C], mode: 'walk', preference: 'quiet' };

    await getRoute(req);

    const firstArg = (apiPost as Mock).mock.calls[0]?.[0];
    expect(firstArg).toBe(routesPath);
  });
});

// ─── 웹 국내 대중교통: ODsay 직접 호출 (Workers는 고정 IP가 없어 Server 키 불가) ──────────
describe('RouteService — 웹 국내 대중교통 ODsay 직접 호출', () => {
  const TRANSIT_KR: RouteRequest = { stops: [SEOUL_A, SEOUL_C], mode: 'transit' };
  const ODSAY_OK = {
    result: { path: [{ pathType: 1, info: { totalTime: 5 }, subPath: [
      { trafficType: 3, distance: 40, sectionTime: 1 },
      { trafficType: 1, distance: 1100, sectionTime: 2, lane: [{ name: '수도권 1호선' }],
        startX: 126.972314, startY: 37.555942, endX: 126.977142, endY: 37.565364 },
      { trafficType: 3, distance: 147, sectionTime: 2 },
    ] }] },
  };

  async function load(key: string | undefined) {
    vi.resetModules();
    vi.unstubAllEnvs();
    if (key) vi.stubEnv('EXPO_PUBLIC_ODSAY_KEY', key);
    vi.stubGlobal('document', {}); // 브라우저(웹) 환경
    vi.doMock('./apiClient.js', () => ({
      isDemoMode: false,
      apiPost: vi.fn().mockResolvedValue({ legs: [], via: 'proxy' }),
      apiFetch: vi.fn(),
      ApiError: class extends Error {},
    }));
    const { apiPost } = await import('./apiClient.js');
    const { getRoute } = await import('./RouteService.js');
    return { apiPost: apiPost as Mock, getRoute };
  }

  it('키 있음 + 국내 → ODsay 직접 호출, 프록시 미호출', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ODSAY_OK });
    vi.stubGlobal('fetch', fetchMock);
    const { apiPost, getRoute } = await load('uri-key');
    const route = await getRoute(TRANSIT_KR);
    expect(String(fetchMock.mock.calls[0]![0])).toContain('https://api.odsay.com/');
    expect(fetchMock.mock.calls[0]![1]).toBeUndefined(); // 커스텀 헤더 없는 단순 GET (ODsay CORS)
    expect(apiPost).not.toHaveBeenCalled();
    expect(route.legs.some((l) => l.mode === 'transit')).toBe(true);
    vi.unstubAllGlobals();
  });

  it('키 없음 → 프록시', async () => {
    const { apiPost, getRoute } = await load(undefined);
    await getRoute(TRANSIT_KR);
    expect(apiPost).toHaveBeenCalledWith(routesPath, TRANSIT_KR);
    vi.unstubAllGlobals();
  });

  it('네이티브(document 없음) → 키가 있어도 프록시 (URI 키는 웹 전용)', async () => {
    const fetchMock = vi.fn();
    const { apiPost, getRoute } = await load('uri-key');
    vi.unstubAllGlobals();
    vi.stubGlobal('fetch', fetchMock);
    await getRoute(TRANSIT_KR);
    expect(fetchMock).not.toHaveBeenCalled();
    expect(apiPost).toHaveBeenCalledWith(routesPath, TRANSIT_KR);
    vi.unstubAllGlobals();
  });

  it('해외 대중교통 → 프록시 (Google)', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    const { apiPost, getRoute } = await load('uri-key');
    const req: RouteRequest = { stops: [{ lat: 40.71, lng: -74.0 }, { lat: 40.73, lng: -73.99 }], mode: 'transit' };
    await getRoute(req);
    expect(fetchMock).not.toHaveBeenCalled();
    expect(apiPost).toHaveBeenCalledWith(routesPath, req);
    vi.unstubAllGlobals();
  });

  it('ODsay 인증 실패(200 + error 본문, 예: localhost) → 프록시로 폴백', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true, json: async () => ({ error: [{ code: '500', message: '[ApiKeyAuthFailed]' }] }),
    }));
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    const { apiPost, getRoute } = await load('uri-key');
    await getRoute(TRANSIT_KR);
    expect(apiPost).toHaveBeenCalledWith(routesPath, TRANSIT_KR);
    vi.unstubAllGlobals();
  });
});
