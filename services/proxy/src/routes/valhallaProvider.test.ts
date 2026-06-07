/**
 * A2 — Valhalla 공급자 fetch-모킹 **실-모드** 테스트 (게이트 A, P4 §3-2).
 *
 * 데모 모드 불인정 — 실 fetch 분기를 모킹으로 직접 커버한다. body 구성(locations
 * {lat,lon}·costing_options 병합)·정규화·장애 격리(컨테이너 다운·non-2xx·URL 미설정)를
 * 단언. 통합 배선(routeDirect 호출)은 OW1(별도) 범위 — 여기선 provider 단위만.
 */
import { describe, it, expect, vi, afterEach } from 'vitest';
import { createValhallaProvider } from './valhallaProvider.js';
import type { Env } from '../config.js';
import { PROFILE_COSTING } from '@wayfinder/shared';
import { WALK_SIMPLE_RAW } from '../fixtures/valhalla/index.js';

const STOPS = [
  { lat: 37.5663, lng: 126.9779 },
  { lat: 37.5704, lng: 126.9921 },
];

function env(url = 'http://localhost:8002'): Env {
  return { VALHALLA_URL: url } as unknown as Env;
}

afterEach(() => vi.unstubAllGlobals());

describe('createValhallaProvider — fetch 모킹 실-모드', () => {
  it('정상 응답을 normalizeValhalla로 Route 변환', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({ ok: true, json: async () => WALK_SIMPLE_RAW }),
    );
    const provider = createValhallaProvider(env());
    const route = await provider.route({ stops: STOPS, mode: 'walk', preference: 'safe' }, PROFILE_COSTING.safe!);
    expect(route.legs[0]!.mode).toBe('walk');
    expect(route.legs[0]!.coords.length).toBeGreaterThan(1);
    expect(route.totalDurationSec).toBeGreaterThan(0);
  });

  it('POST /route + locations {lat,lon} + costing_options 병합', async () => {
    const fetchSpy = vi.fn().mockResolvedValue({ ok: true, json: async () => WALK_SIMPLE_RAW });
    vi.stubGlobal('fetch', fetchSpy);
    const provider = createValhallaProvider(env('http://localhost:8002'));
    await provider.route({ stops: STOPS, mode: 'walk', preference: 'safe' }, PROFILE_COSTING.safe!);

    const [calledUrl, init] = fetchSpy.mock.calls[0]!;
    expect(calledUrl).toBe('http://localhost:8002/route');
    expect(init.method).toBe('POST');
    const body = JSON.parse(init.body);
    expect(body.costing).toBe('pedestrian');
    expect(body.locations).toEqual([
      { lat: 37.5663, lon: 126.9779 },
      { lat: 37.5704, lon: 126.9921 },
    ]);
    expect(body.costing_options.pedestrian).toEqual(PROFILE_COSTING.safe);
  });

  it('빈 costing이면 costing_options 미포함 (표준 pedestrian)', async () => {
    const fetchSpy = vi.fn().mockResolvedValue({ ok: true, json: async () => WALK_SIMPLE_RAW });
    vi.stubGlobal('fetch', fetchSpy);
    const provider = createValhallaProvider(env());
    await provider.route({ stops: STOPS, mode: 'walk' }, {});
    const body = JSON.parse(fetchSpy.mock.calls[0]![1].body);
    expect(body.costing_options).toBeUndefined();
  });

  it('trailing slash URL 정규화 (//route 방지)', async () => {
    const fetchSpy = vi.fn().mockResolvedValue({ ok: true, json: async () => WALK_SIMPLE_RAW });
    vi.stubGlobal('fetch', fetchSpy);
    const provider = createValhallaProvider(env('http://localhost:8002/'));
    await provider.route({ stops: STOPS, mode: 'walk' }, {});
    expect(fetchSpy.mock.calls[0]![0]).toBe('http://localhost:8002/route');
  });
});

describe('createValhallaProvider — 장애 격리 (silent 금지)', () => {
  it('VALHALLA_URL 미설정 → throw', async () => {
    const provider = createValhallaProvider(env(''));
    await expect(
      provider.route({ stops: STOPS, mode: 'walk' }, {}),
    ).rejects.toThrow(/not configured/);
  });

  it('컨테이너 다운(fetch reject) → 명시적 throw', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('ECONNREFUSED')));
    const provider = createValhallaProvider(env());
    await expect(
      provider.route({ stops: STOPS, mode: 'walk' }, {}),
    ).rejects.toThrow(/container down/);
  });

  it('non-2xx → throw (status 포함)', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 503, json: async () => ({}) }));
    const provider = createValhallaProvider(env());
    await expect(
      provider.route({ stops: STOPS, mode: 'walk' }, {}),
    ).rejects.toThrow(/503/);
  });
});
