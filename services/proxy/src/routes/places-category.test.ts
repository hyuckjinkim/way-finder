import { describe, it, expect, vi, afterEach } from 'vitest';
import app from '../index.js';

const realEnv = { DEMO_MODE: 'false', KAKAO_REST_KEY: 'k', CACHE: { put: vi.fn(), get: vi.fn() } };
const demoEnv = { DEMO_MODE: 'true', KAKAO_REST_KEY: '' };
const call = (path: string, env: object = realEnv) =>
  app.fetch(new Request(`http://localhost${path}`), env, {} as ExecutionContext);

afterEach(() => vi.unstubAllGlobals());

describe('GET /v1/places/category', () => {
  it.each([
    ['code 없음', '/v1/places/category?rect=126.9,37.5,127,37.6'],
    ['모르는 code', '/v1/places/category?code=XX1&rect=126.9,37.5,127,37.6'],
    ['상속 키 code(toString)', '/v1/places/category?code=toString&rect=126.9,37.5,127,37.6'],
    ['상속 키 code(__proto__)', '/v1/places/category?code=__proto__&rect=126.9,37.5,127,37.6'],
    ['rect 뒤집힘', '/v1/places/category?code=CE7&rect=127,37.5,126.9,37.6'],
    ['rect 3개', '/v1/places/category?code=CE7&rect=126.9,37.5,127'],
    ['rect 빈 값', '/v1/places/category?code=CE7&rect=,,1,1'],
    ['범위 없음', '/v1/places/category?code=CE7'],
    ['radius 초과', '/v1/places/category?code=CE7&x=127&y=37.5&radius=20001'],
  ])('%s → 400', async (_, path) => {
    expect((await call(path)).status).toBe(400);
  });

  it(':id 라우트보다 먼저 매칭되고, 카카오 결과를 Place로 정규화하며 KV에 쓰지 않는다', async () => {
    const fetchMock = vi.fn(async () =>
      Response.json({
        documents: [
          {
            id: '1', place_name: '카페A', category_name: '음식점 > 카페', category_group_code: 'CE7',
            category_group_name: '카페', phone: '', address_name: '서울', road_address_name: '서울 길 1',
            x: '126.98', y: '37.56', place_url: '', distance: '120',
          },
        ],
      }),
    );
    vi.stubGlobal('fetch', fetchMock);
    const res = await call('/v1/places/category?code=CE7&rect=126.97,37.55,126.99,37.57&x=126.98&y=37.56');
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual([
      expect.objectContaining({ id: 'kakao:1', name: '카페A', distanceM: 120, categoryGroup: '카페' }),
    ]);
    const url = new URL(String((fetchMock.mock.calls[0] as unknown[])[0]));
    expect(url.pathname).toBe('/v2/local/search/category.json');
    expect(url.searchParams.get('category_group_code')).toBe('CE7');
    expect(url.searchParams.get('rect')).toBe('126.97,37.55,126.99,37.57');
    expect(url.searchParams.get('x')).toBe('126.98');
    expect(realEnv.CACHE.put).not.toHaveBeenCalled();
  });

  it('공급자 실패는 502', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('', { status: 500 })));
    expect((await call('/v1/places/category?code=CE7&x=127&y=37.5&radius=500')).status).toBe(502);
  });

  it('데모 모드는 fetch 없이 200', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    const res = await call('/v1/places/category?code=CE7&x=127&y=37.5&radius=500', demoEnv);
    expect(res.status).toBe(200);
    expect(Array.isArray(await res.json())).toBe(true);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe('GET /v1/geo/reverse', () => {
  it('lat/lng 잘못되면 400', async () => {
    expect((await call('/v1/geo/reverse?lat=abc&lng=127')).status).toBe(400);
    expect((await call('/v1/geo/reverse?lat=37.5')).status).toBe(400);
  });

  it('x=경도, y=위도로 부르고 건물명 > 도로명 순으로 라벨을 고른다', async () => {
    const fetchMock = vi.fn(async () =>
      Response.json({
        documents: [
          {
            road_address: { address_name: '서울특별시 중구 세종대로 110', building_name: '서울특별시청' },
            address: { address_name: '서울 중구 태평로1가 31' },
          },
        ],
      }),
    );
    vi.stubGlobal('fetch', fetchMock);
    const res = await call('/v1/geo/reverse?lat=37.5665&lng=126.978');
    expect(await res.json()).toEqual({ label: '서울특별시청' });
    const url = new URL(String((fetchMock.mock.calls[0] as unknown[])[0]));
    expect(url.searchParams.get('x')).toBe('126.978');
    expect(url.searchParams.get('y')).toBe('37.5665');
  });

  it('주소가 없으면(바다·해외) label=null', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => Response.json({ documents: [] })));
    expect(await (await call('/v1/geo/reverse?lat=35.68&lng=139.7')).json()).toEqual({ label: null });
  });
});
