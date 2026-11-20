/**
 * 장소 상세 힌트 매칭 · 검색 품질 · capabilities · onError 회귀 테스트.
 * 카카오 id 단건 조회 API가 없어 상세는 이름·좌표 힌트로 근처 키워드 검색 후 id 매칭한다.
 */
import { describe, it, expect, vi, afterEach } from 'vitest';
import app from '../index.js';
import { placeDetailPath, placeGooglePath, placesSearchPath, capabilitiesPath } from '@wayfinder/shared/api';

function makeKV(): KVNamespace & { _store: Map<string, string> } {
  const _store = new Map<string, string>();
  return {
    _store,
    async get(k: string) { return _store.get(k) ?? null; },
    async put(k: string, v: string) { _store.set(k, v); },
  } as unknown as KVNamespace & { _store: Map<string, string> };
}

const realEnv = (extra: Record<string, unknown> = {}) => ({
  DEMO_MODE: 'false',
  KAKAO_REST_KEY: 'k',
  GOOGLE_PLACES_KEY: 'g',
  NAVER_CLIENT_ID: '',
  NAVER_CLIENT_SECRET: '',
  CACHE: makeKV(),
  ...extra,
});

const call = (path: string, env: Record<string, unknown>) =>
  app.fetch(new Request(`http://localhost${path}`), env, {} as ExecutionContext);

const doc = (id: string, name: string, over: Record<string, string> = {}) => ({
  id, place_name: name, category_name: '교통,수송 > 지하철,전철', category_group_code: 'CE7',
  category_group_name: '카페', phone: '', address_name: '서울 강남구', road_address_name: '서울 강남구 강남대로',
  x: '127.028', y: '37.498', place_url: `https://place.map.kakao.com/${id}`, distance: '120', ...over,
});

/** URL별 응답 라우터. 호출된 URL을 calls에 기록. */
function stubFetch(handler: (u: URL) => unknown) {
  const calls: URL[] = [];
  vi.stubGlobal('fetch', vi.fn(async (input: string) => {
    const u = new URL(input);
    calls.push(u);
    return { ok: true, json: async () => handler(u) };
  }));
  return calls;
}

afterEach(() => vi.unstubAllGlobals());

describe('GET /v1/places/:id — 힌트로 카카오 상세 조회 (P0 404 회귀)', () => {
  const hint = { name: '강남역 2호선', coord: { lat: 37.498, lng: 127.028 } };

  it('name+좌표로 keyword.json을 검색하고 id가 일치하는 문서를 반환한다 (숫자 id를 query로 쓰지 않음)', async () => {
    const calls = stubFetch((u) =>
      u.pathname.includes('keyword') ? { documents: [doc('1', '강남역 2호선 출구'), doc('21160803', '강남역 2호선')] } : { documents: [] },
    );
    const res = await call(placeDetailPath('kakao:21160803', hint), realEnv());
    expect(res.status).toBe(200);
    expect(((await res.json()) as { name: string }).name).toBe('강남역 2호선');
    const kw = calls.find((u) => u.pathname.includes('local/search/keyword'))!;
    expect(kw.searchParams.get('query')).toBe('강남역 2호선');
    expect(kw.searchParams.get('x')).toBe('127.028');
    expect(kw.searchParams.get('y')).toBe('37.498');
    expect(kw.searchParams.get('radius')).toBe('500');
    expect(kw.searchParams.get('sort')).toBe('distance');
  });

  it('id가 안 맞으면 이름이 같아도 404 — hint로 다른 장소를 공유 캐시 키에 넣지 않는다(캐시 오염)', async () => {
    stubFetch((u) =>
      u.pathname.includes('keyword') ? { documents: [doc('1', '다른곳'), doc('2', '강남역 2호선')] } : { documents: [] },
    );
    expect((await call(placeDetailPath('kakao:999', hint), realEnv())).status).toBe(404);
  });

  it('id도 이름도 안 맞으면 404', async () => {
    stubFetch(() => ({ documents: [doc('1', '다른곳')] }));
    expect((await call(placeDetailPath('kakao:999', hint), realEnv())).status).toBe(404);
  });

  it('404는 캐시하지 않는다 (null 비캐시)', async () => {
    stubFetch(() => ({ documents: [] }));
    const env = realEnv();
    await call(placeDetailPath('kakao:999', hint), env);
    expect([...(env.CACHE as ReturnType<typeof makeKV>)._store.keys()].some((k) => k.includes('kakao-detail'))).toBe(false);
  });

  it.each([
    ['name 101자', `?name=${'가'.repeat(101)}&lat=37.5&lng=127`],
    ['lat 범위 밖', '?name=a&lat=91&lng=127'],
    ['lng NaN', '?name=a&lat=37.5&lng=abc'],
    ['lat 빈 문자열', '?name=a&lat=&lng=127'],
    ['일부만 제공', '?name=a'],
  ])('잘못된 힌트(%s)는 400', async (_label, qs) => {
    stubFetch(() => ({ documents: [] }));
    expect((await call(`/v1/places/kakao%3A1${qs}`, realEnv())).status).toBe(400);
  });
});

describe('GET /v1/places/:id/google — 캐시 키는 카카오 id (동명 지점 리뷰 혼입 방지)', () => {
  it('같은 이름·다른 id의 두 지점이 서로 다른 구글 캐시 키를 쓴다', async () => {
    stubFetch((u) => {
      if (u.pathname.includes('keyword')) return { documents: [doc('A', '스타벅스'), doc('B', '스타벅스')] };
      if (u.pathname.includes('searchText')) return { places: [{ id: 'gp' }] };
      return { rating: 4.5, userRatingCount: 10, reviews: [{ rating: 5, text: 'x', authorAttribution: { displayName: 'a' }, publishTime: '2026-01-01T00:00:00Z' }] };
    });
    const env = realEnv();
    // 구글 text search는 POST — stubFetch가 URL로만 분기하므로 searchText 경로도 처리됨
    await call(placeGooglePath('kakao:A') + '?name=%EC%8A%A4%ED%83%80%EB%B2%85%EC%8A%A4&lat=37.5&lng=127', env);
    await call(placeGooglePath('kakao:B') + '?name=%EC%8A%A4%ED%83%80%EB%B2%85%EC%8A%A4&lat=37.5&lng=127', env);
    const keys = [...(env.CACHE as ReturnType<typeof makeKV>)._store.keys()].filter((k) => k.startsWith('google:'));
    expect(keys.some((k) => k.includes('kakao:a'))).toBe(true);
    expect(keys.some((k) => k.includes('kakao:b'))).toBe(true);
    expect(keys.some((k) => k.includes('스타벅스'))).toBe(false);
  });
});

describe('GET /v1/places/search — 품질 개선', () => {
  const search = (q: string) => call(`${placesSearchPath}?q=${encodeURIComponent(q)}&lat=37.498&lng=127.028`, realEnv());

  it('distance·category_group_name을 distanceM·categoryGroup으로 전달', async () => {
    stubFetch(() => ({ documents: [doc('1', '강남카페', { distance: '120' })] }));
    const [p] = (await (await search('강남카페')).json()) as Array<{ distanceM?: number; categoryGroup?: string }>;
    expect(p?.distanceM).toBe(120);
    expect(p?.categoryGroup).toBe('카페');
  });

  it('distance가 빈 문자열이면 distanceM 생략', async () => {
    stubFetch(() => ({ documents: [doc('1', '강남카페', { distance: '' })] }));
    const [p] = (await (await search('강남카페')).json()) as Array<Record<string, unknown>>;
    expect(p && 'distanceM' in p).toBe(false);
  });

  it('짧은 한글 지명은 "<q>역"도 검색해 SW8 지하철역을 최대 2개 앞으로 올리고 id로 중복 제거', async () => {
    const calls = stubFetch((u) => {
      const q = u.searchParams.get('query');
      if (q === '강남') return { documents: [doc('10', '강남 맛집'), doc('20', '강남역 2호선', { category_group_code: 'SW8' })] };
      if (q === '강남역') {
        return { documents: [
          doc('20', '강남역 2호선', { category_group_code: 'SW8' }),
          doc('21', '강남역 신분당선', { category_group_code: 'SW8' }),
          doc('22', '강남역 3호선', { category_group_code: 'SW8' }),
          doc('23', '강남역 카페', { category_group_code: 'CE7' }),
        ] };
      }
      return { documents: [] };
    });
    const ids = ((await (await search('강남')).json()) as Array<{ id: string }>).map((p) => p.id);
    expect(calls.some((u) => u.searchParams.get('query') === '강남역')).toBe(true);
    expect(ids.slice(0, 2)).toEqual(['kakao:20', 'kakao:21']);
    expect(ids).not.toContain('kakao:22'); // 승격 최대 2개
    expect(ids).not.toContain('kakao:23'); // SW8 아님
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('역으로 끝나거나 5자 이상·공백 포함이면 역 검색을 추가하지 않는다', async () => {
    const calls = stubFetch(() => ({ documents: [doc('1', 'x')] }));
    for (const q of ['강남역', '강남구청앞사거리', '강 남']) await search(q);
    expect(calls.filter((u) => u.searchParams.get('query')?.endsWith('역역')).length).toBe(0);
    expect(calls.filter((u) => u.pathname.includes('keyword')).length).toBe(3);
  });

  it('키워드 결과가 비면 address.json 결과를 kakao-addr 장소로 반환', async () => {
    stubFetch((u) =>
      u.pathname.includes('address')
        ? { documents: [{ address_name: '서울 강남구 테헤란로 152', x: '127.036', y: '37.5', road_address: null }] }
        : { documents: [] },
    );
    const [p] = (await (await search('테헤란로 152')).json()) as Array<{ id: string; name: string; category: string }>;
    expect(p).toMatchObject({ id: 'kakao-addr:127.036,37.5', name: '서울 강남구 테헤란로 152', category: '주소' });
  });

  it('주소형 질의(로/길/동 + 숫자)는 키워드 결과가 있어도 주소를 앞에 붙인다', async () => {
    stubFetch((u) =>
      u.pathname.includes('address')
        ? { documents: [{ address_name: '서울 강남구 테헤란로 152', x: '127.036', y: '37.5' }] }
        : { documents: [doc('1', '테헤란로 152 빌딩')] },
    );
    const ids = ((await (await search('테헤란로 152')).json()) as Array<{ id: string }>).map((p) => p.id);
    expect(ids).toEqual(['kakao-addr:127.036,37.5', 'kakao:1']);
  });

  it('주소가 아닌 질의에 키워드 결과가 있으면 address.json을 호출하지 않는다', async () => {
    const calls = stubFetch(() => ({ documents: [doc('1', '카페')] }));
    await search('카페');
    expect(calls.some((u) => u.pathname.includes('address'))).toBe(false);
  });

  it('캐시 키는 좌표 소수 2자리·정규화된 q — 근접 좌표/대소문자·공백 차이는 같은 키', async () => {
    const calls = stubFetch(() => ({ documents: [doc('1', 'Cafe')] }));
    const env = realEnv();
    const get = (q: string, lat: string) => call(`${placesSearchPath}?q=${encodeURIComponent(q)}&lat=${lat}&lng=127.028`, env);
    await get('Cafe  Bar', '37.4981');
    const n = calls.length;
    await get(' cafe bar ', '37.4984');
    expect(calls.length).toBe(n); // 캐시 히트
  });

  it('상세 조회 대상이 아닌 kakao-addr id의 상세는 좌표로 구성, 구글 탭은 비어 있다', async () => {
    stubFetch(() => ({ documents: [] }));
    const d = await call('/v1/places/kakao-addr%3A127.036%2C37.5?name=%EC%A3%BC%EC%86%8C&lat=37.5&lng=127.036', realEnv());
    expect(d.status).toBe(200);
    expect(((await d.json()) as { coord: { lat: number; lng: number } }).coord).toEqual({ lat: 37.5, lng: 127.036 });
    const g = await call(placeGooglePath('kakao-addr:127.036,37.5'), realEnv());
    expect(await g.json()).toEqual({ reviews: [] });
  });
});

describe('GET /v1/capabilities', () => {
  it('VALHALLA_URL이 있으면 도보 선호 지원', async () => {
    const res = await call(capabilitiesPath, { DEMO_MODE: 'auto', VALHALLA_URL: 'http://v', CACHE: makeKV() });
    expect(((await res.json()) as { walkPreferences: boolean }).walkPreferences).toBe(true);
  });

  it('키 없음(auto) — kr은 transit만(웹 직접 ODsay), global 비어 있음', async () => {
    const res = await call(capabilitiesPath, { DEMO_MODE: 'auto', CACHE: makeKV() });
    expect(await res.json()).toEqual({ modes: { kr: ['transit'], global: [] }, walkPreferences: false });
  });

  it('키 보유 모드만 포함', async () => {
    const res = await call(capabilitiesPath, {
      DEMO_MODE: 'auto', KAKAO_REST_KEY: 'k', TMAP_APP_KEY: 't', GOOGLE_ROUTES_KEY: 'r', CACHE: makeKV(),
    });
    expect(await res.json()).toEqual({
      modes: { kr: ['walk', 'transit'], global: ['walk', 'transit', 'car', 'bike'] },
      walkPreferences: false,
    });
  });
});

describe('app.onError', () => {
  it('미처리 예외는 JSON {error} 500으로 응답', async () => {
    const err = vi.spyOn(console, 'error').mockImplementation(() => {});
    stubFetch(() => { throw new Error('upstream exploded'); });
    // 상세의 카카오 조회는 fetchWithFallback 밖 — 예외가 전파된다
    const res = await call(placeDetailPath('kakao:1', { name: 'a', coord: { lat: 37.5, lng: 127 } }), realEnv());
    expect(res.status).toBe(500);
    expect(res.headers.get('content-type')).toContain('application/json');
    expect(await res.json()).toEqual({ error: 'Internal Server Error' });
    err.mockRestore();
  });
});

describe('GET /v1/places/search — 역 약칭·입력 검증·공급자 실패', () => {
  const search = (qs: string, env = realEnv()) => call(`${placesSearchPath}?${qs}`, env);

  it.each([
    ['구디', '구로디지털단지역'],
    ['가디', '가산디지털단지역'],
    ['고터', '고속터미널역'],
    ['dmc', '디지털미디어시티역'],
  ])('%s → 카카오에 %s로 질의', async (abbr, full) => {
    const calls = stubFetch(() => ({ documents: [doc('1', `${full} 2호선`, { category_group_code: 'SW8' })] }));
    const res = await search(`q=${encodeURIComponent(abbr)}`);
    expect(res.status).toBe(200);
    expect(calls[0]!.searchParams.get('query')).toBe(full);
  });

  it('약칭으로 시작하는 상호(구디별밤)는 그대로', async () => {
    const calls = stubFetch(() => ({ documents: [doc('1', '구디별밤')] }));
    await search(`q=${encodeURIComponent('구디별밤')}`);
    expect(calls[0]!.searchParams.get('query')).toBe('구디별밤');
  });

  it('lat/lng가 숫자가 아니면 400', async () => {
    stubFetch(() => ({ documents: [] }));
    expect((await search('q=cafe&lat=abc&lng=127')).status).toBe(400);
    expect((await search('q=cafe&lat=37.5&lng=999')).status).toBe(400);
  });

  it('q 100자 초과면 400', async () => {
    stubFetch(() => ({ documents: [] }));
    expect((await search(`q=${'a'.repeat(101)}`)).status).toBe(400);
  });

  it('공급자 실패 → 200 []가 아니라 502', async () => {
    const err = vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 500, json: async () => ({}) }));
    const res = await search('q=cafe&lat=37.5&lng=127');
    expect(res.status).toBe(502);
    expect(await res.json()).toMatchObject({ code: 'upstream' });
    err.mockRestore();
  });
});
