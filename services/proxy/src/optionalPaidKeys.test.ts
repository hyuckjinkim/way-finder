/**
 * 유료 가능 키(구글·카카오모빌리티)는 선택 — 빠져도 무료 키 기능은 실 모드로 남아야 한다.
 * 회귀: 과거 isDemoMode가 GOOGLE_PLACES_KEY를, kr 도보·자전거가 KAKAO_MOBILITY_KEY를 요구해
 * 유료 키 하나 빠지면 무료 기능까지 전부 데모(mock)로 떨어졌다.
 */
import { describe, it, expect, vi, afterEach } from 'vitest';
import app from './index.js';
import { isDemoMode, isRouteDemoMode, type Env } from './config.js';
import { KAKAO_LOCAL_SEARCH_RAW } from './fixtures/kakaoLocal.js';
import { routesPath } from '@wayfinder/shared/api';
import { TMAP_PEDESTRIAN_RAW } from '../test/fixtures/tmapPedestrian.js';

const KR = [{ lat: 37.5563, lng: 126.9723 }, { lat: 37.5665, lng: 126.978 }];

function postRoute(mode: string, env: Env): Promise<Response> {
  const req = new Request(`http://localhost${routesPath}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ stops: KR, mode }),
  });
  return Promise.resolve(app.fetch(req, env, {} as ExecutionContext));
}

function freeOnlyEnv(): Env {
  const store = new Map<string, string>();
  return {
    DEMO_MODE: 'auto',
    KAKAO_REST_KEY: 'k', NAVER_CLIENT_ID: 'n', NAVER_CLIENT_SECRET: 's',
    TMAP_APP_KEY: 'tm', ODSAY_API_KEY: 'od',
    GOOGLE_PLACES_KEY: '', GOOGLE_ROUTES_KEY: '', KAKAO_MOBILITY_KEY: '',
    MAPBOX_TOKEN: '', VALHALLA_URL: '',
    CACHE: {
      async get(key: string) { return store.get(key) ?? null; },
      async put(key: string, value: string) { store.set(key, value); },
    } as unknown as KVNamespace,
  };
}

describe('유료 가능 키 없이 무료 키만 설정', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('장소: 구글 키 없어도 실 모드', () => {
    expect(isDemoMode(freeOnlyEnv())).toBe(false);
  });

  it('장소: 네이버 키 없어도 실 모드 (카카오 REST만 필수)', () => {
    expect(isDemoMode({ ...freeOnlyEnv(), NAVER_CLIENT_ID: '', NAVER_CLIENT_SECRET: '' })).toBe(false);
  });

  it('네이버 블로그: API HUB 엔드포인트 + X-NCP 헤더로 호출', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ total: 0, items: [], documents: [] }) });
    vi.stubGlobal('fetch', fetchMock);
    await app.fetch(new Request('http://localhost/v1/blogs?q=카페'), freeOnlyEnv(), {} as ExecutionContext);
    const naverCall = fetchMock.mock.calls.find(([u]) => String(u).startsWith('https://naverapihub.apigw.ntruss.com/search/v1/blog'));
    expect(naverCall).toBeDefined();
    expect(naverCall![1].headers).toEqual({ 'X-NCP-APIGW-API-KEY-ID': 'n', 'X-NCP-APIGW-API-KEY': 's' });
  });

  it('네이버 블로그: 키 없으면 네이버 호출 없이 빈 결과, 카카오 블로그는 정상', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ documents: [] }) });
    vi.stubGlobal('fetch', fetchMock);
    const env = { ...freeOnlyEnv(), NAVER_CLIENT_ID: '', NAVER_CLIENT_SECRET: '' };
    const res = await app.fetch(new Request('http://localhost/v1/blogs?q=카페'), env, {} as ExecutionContext);
    expect(((await res.json()) as { naver: unknown[] }).naver).toEqual([]);
    expect(fetchMock.mock.calls.some(([u]) => String(u).includes('naverapihub'))).toBe(false);
    expect(fetchMock.mock.calls.some(([u]) => String(u).includes('dapi.kakao.com'))).toBe(true);
  });

  it('kr 길찾기: 모드별 공급자 키만 본다 (도보=TMAP, 자전거=Valhalla, 대중교통=ODsay, 자동차=카카오모빌리티)', () => {
    const env = freeOnlyEnv();
    expect(isRouteDemoMode(env, 'kr', 'walk')).toBe(false);
    expect(isRouteDemoMode(env, 'kr', 'transit')).toBe(false);
    expect(isRouteDemoMode(env, 'kr', 'car')).toBe(true);
    expect(isRouteDemoMode(env, 'kr', 'bike')).toBe(true); // VALHALLA_URL 비어있음
    expect(isRouteDemoMode({ ...env, VALHALLA_URL: 'http://localhost:8002' }, 'kr', 'bike')).toBe(false);
  });

  // 핸들러 경유 — 게이트 함수만 보면 호출부가 mode를 안 넘기는 결함을 못 잡는다(실제 발생).
  it('POST 도보: 카카오모빌리티 키 없어도 TMAP 실호출', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => TMAP_PEDESTRIAN_RAW });
    vi.stubGlobal('fetch', fetchMock);
    const res = await postRoute('walk', freeOnlyEnv());
    expect(res.status).toBe(200);
    expect(fetchMock.mock.calls.some(([u]) => String(u).includes('apis.openapi.sk.com'))).toBe(true);
  });

  it('POST 자동차: 앱은 실 모드인데 카카오모빌리티 키만 없으면 가짜 경로 대신 501 MODE_UNAVAILABLE', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    const res = await postRoute('car', freeOnlyEnv());
    expect(res.status).toBe(501);
    expect(await res.json()).toMatchObject({ code: 'MODE_UNAVAILABLE' });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('POST 대중교통: ODsay 키만 없어도 501 (transit 핸들러도 동일 게이트)', async () => {
    vi.stubGlobal('fetch', vi.fn());
    const res = await postRoute('transit', { ...freeOnlyEnv(), ODSAY_API_KEY: '' });
    expect(res.status).toBe(501);
  });

  it('키 0개(앱 전체 데모)면 기존처럼 mock 경로 200 — 개발 흐름 유지', async () => {
    vi.stubGlobal('fetch', vi.fn());
    const zero = { ...freeOnlyEnv(), KAKAO_REST_KEY: '', NAVER_CLIENT_ID: '', NAVER_CLIENT_SECRET: '', TMAP_APP_KEY: '', ODSAY_API_KEY: '' };
    expect((await postRoute('car', zero)).status).toBe(200);
    expect((await postRoute('transit', zero)).status).toBe(200);
  });

  it('global 길찾기: 구글 Routes 키 없으면 데모', () => {
    expect(isRouteDemoMode(freeOnlyEnv(), 'global', 'walk')).toBe(true);
  });

  it('한국 검색은 카카오 실호출, 글로벌 검색은 구글 호출 없이 빈 결과', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => KAKAO_LOCAL_SEARCH_RAW });
    vi.stubGlobal('fetch', fetchMock);

    const kr = await app.fetch(new Request('http://localhost/v1/places/search?q=카페&lat=37.5&lng=127.0'), freeOnlyEnv(), {} as ExecutionContext);
    expect(((await kr.json()) as Array<{ id: string }>)[0]?.id).toMatch(/^kakao:/);

    const gl = await app.fetch(new Request('http://localhost/v1/places/search?q=cafe&lat=40.7&lng=-74.0'), freeOnlyEnv(), {} as ExecutionContext);
    expect(await gl.json()).toEqual([]);
    expect(fetchMock.mock.calls.some(([u]) => String(u).includes('googleapis'))).toBe(false);
  });

  it('구글 탭: 키 없으면 호출 없이 빈 데이터', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    const res = await app.fetch(new Request('http://localhost/v1/places/kakao:26338954/google'), freeOnlyEnv(), {} as ExecutionContext);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ reviews: [] });
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe('CORS — 웹 앱(Pages)에서 호출 가능', () => {
  it('preflight OPTIONS에 Access-Control-Allow-Origin 응답', async () => {
    const res = await app.fetch(new Request('http://localhost/v1/routes', {
      method: 'OPTIONS',
      headers: { Origin: 'https://wayfinder.pages.dev', 'Access-Control-Request-Method': 'POST' },
    }), freeOnlyEnv(), {} as ExecutionContext);
    expect(res.headers.get('access-control-allow-origin')).toBe('*');
  });
});

describe('ODsay 실패는 200 빈 경로가 아니라 502', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('ODsay가 HTTP 200 + error 본문(인증 실패 등)을 주면 502', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true, json: async () => ({ error: [{ code: '500', message: 'ApiKeyAuthFailed' }] }),
    }));
    const res = await postRoute('transit', freeOnlyEnv());
    expect(res.status).toBe(502);
  });
});
