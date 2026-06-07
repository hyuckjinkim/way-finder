/**
 * A2 통합 테스트 — Hono 앱 엔드포인트 3종.
 *
 * 전략: 실 API fetch를 vi.stubGlobal('fetch', ...) 으로 모킹.
 * 데모 모드(env 키 없음)와 실 모드(fetch 모킹)를 모두 커버.
 * Cloudflare Workers 환경 전제: KV는 인메모리 Map으로 구현.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import app from './index.js';
import {
  placesSearchPath,
  placeDetailPath,
  placeGooglePath,
  blogsPath,
} from '@wayfinder/shared/api';
import { KAKAO_LOCAL_SEARCH_RAW } from './fixtures/kakaoLocal.js';
import { GOOGLE_PLACE_DETAIL_RAW } from './fixtures/googlePlaces.js';
import { NAVER_BLOG_SEARCH_RAW } from './fixtures/naverBlog.js';
import { KAKAO_BLOG_SEARCH_RAW } from './fixtures/kakaoBlog.js';

// ── 인메모리 KV mock ────────────────────────────────────────────────────────
function makeKV(): KVNamespace {
  const store = new Map<string, string>();
  return {
    async get(key: string) { return store.get(key) ?? null; },
    async put(key: string, value: string) { store.set(key, value); },
    async delete(key: string) { store.delete(key); },
    async list() { return { keys: [], list_complete: true, caret: undefined }; },
    async getWithMetadata(key: string) {
      const val = store.get(key) ?? null;
      return { value: val, metadata: null };
    },
  } as unknown as KVNamespace;
}

// ── 데모 모드 env (키 없음) ─────────────────────────────────────────────────
function demoEnv(): Record<string, unknown> {
  return {
    DEMO_MODE: 'auto',
    KAKAO_REST_KEY: '',
    GOOGLE_PLACES_KEY: '',
    NAVER_CLIENT_ID: '',
    NAVER_CLIENT_SECRET: '',
    CACHE: makeKV(),
  };
}

// ── 실 모드 env (키 세팅, fetch 모킹) ───────────────────────────────────────
function realEnv(): Record<string, unknown> {
  return {
    DEMO_MODE: 'false',
    KAKAO_REST_KEY: 'test-kakao-key',
    GOOGLE_PLACES_KEY: 'test-google-key',
    NAVER_CLIENT_ID: 'test-naver-id',
    NAVER_CLIENT_SECRET: 'test-naver-secret',
    CACHE: makeKV(),
  };
}

function makeRequest(path: string): Request {
  return new Request(`http://localhost${path}`);
}

async function invokeApp(path: string, env: Record<string, unknown>): Promise<Response> {
  const req = makeRequest(path);
  return app.fetch(req, env, {} as ExecutionContext);
}

// ── 테스트 ───────────────────────────────────────────────────────────────────

describe('GET / (헬스 체크)', () => {
  it('키 없이 200 + ok 반환', async () => {
    const res = await invokeApp('/', demoEnv());
    expect(res.status).toBe(200);
    const body = (await res.json()) as { status: string; phase: number };
    expect(body.status).toBe('ok');
    expect(body.phase).toBe(1);
  });
});

describe('GET /v1/places/search — 데모 모드', () => {
  it('q 파라미터 없으면 400', async () => {
    const res = await invokeApp('/v1/places/search', demoEnv());
    expect(res.status).toBe(400);
  });

  it('q 파라미터 있으면 200 + Place[] 반환', async () => {
    const res = await invokeApp('/v1/places/search?q=카페', demoEnv());
    expect(res.status).toBe(200);
    const body = (await res.json()) as unknown[];
    expect(Array.isArray(body)).toBe(true);
  });

  it('검색 결과가 Place 형태다', async () => {
    const res = await invokeApp('/v1/places/search?q=카페', demoEnv());
    const body = (await res.json()) as Array<{ id: string; name: string; coord: object }>;
    if (body.length > 0) {
      expect(body[0]).toHaveProperty('id');
      expect(body[0]).toHaveProperty('name');
      expect(body[0]).toHaveProperty('coord');
    }
  });
});

describe('GET /v1/places/search — 실 모드 (fetch 모킹)', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => KAKAO_LOCAL_SEARCH_RAW,
    }));
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('카카오 API 응답을 정규화해 반환한다', async () => {
    const res = await invokeApp('/v1/places/search?q=카페&lat=37.5&lng=127.0', realEnv());
    expect(res.status).toBe(200);
    const body = (await res.json()) as Array<{ id: string }>;
    expect(body[0]?.id).toMatch(/^kakao:/);
  });
});

describe('GET /v1/places/:id — 데모 모드', () => {
  it('존재하는 id는 PlaceDetail 반환', async () => {
    const res = await invokeApp('/v1/places/kakao:26338954', demoEnv());
    expect(res.status).toBe(200);
    const body = (await res.json()) as { id: string; reviews: unknown[]; blogs: object };
    expect(body.id).toBe('kakao:26338954');
    expect(Array.isArray(body.reviews)).toBe(true);
    expect(body.blogs).toHaveProperty('naver');
    expect(body.blogs).toHaveProperty('kakao');
  });

  it('존재하지 않는 id는 404', async () => {
    const res = await invokeApp('/v1/places/kakao:nonexistent', demoEnv());
    expect(res.status).toBe(404);
  });
});

describe('GET /v1/places/:id — graceful degradation (구글 fetch 실패)', () => {
  beforeEach(() => {
    // 카카오 기본정보는 성공, 구글은 실패
    vi.stubGlobal('fetch', vi.fn().mockImplementation((url: string) => {
      if (typeof url === 'string' && url.includes('kakao')) {
        return Promise.resolve({
          ok: true,
          json: async () => KAKAO_LOCAL_SEARCH_RAW,
        });
      }
      // 구글 요청 → 실패
      return Promise.reject(new Error('Google network error'));
    }));
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('구글 실패해도 200 반환', async () => {
    const res = await invokeApp('/v1/places/kakao:26338954', realEnv());
    expect(res.status).toBe(200);
  });

  it('구글 실패 시 reviews는 빈 배열', async () => {
    const res = await invokeApp('/v1/places/kakao:26338954', realEnv());
    const body = (await res.json()) as { reviews: unknown[]; rating?: unknown };
    expect(body.reviews).toEqual([]);
  });

  it('구글 실패해도 블로그 탭은 정상 — blogs 필드 존재', async () => {
    const res = await invokeApp('/v1/places/kakao:26338954', realEnv());
    const body = (await res.json()) as { blogs: { naver: unknown[]; kakao: unknown[] } };
    expect(body.blogs).toHaveProperty('naver');
    expect(body.blogs).toHaveProperty('kakao');
  });
});

describe('GET /v1/places/:id — 실 모드 구글 응답 정규화', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn().mockImplementation((url: string | URL | Request, opts?: RequestInit) => {
      const urlStr = typeof url === 'string' ? url : url instanceof URL ? url.toString() : (url as Request).url;
      // 카카오 검색 (기본정보)
      if (urlStr.includes('dapi.kakao.com/v2/local')) {
        return Promise.resolve({ ok: true, json: async () => KAKAO_LOCAL_SEARCH_RAW });
      }
      // 구글 Text Search (kakao 장소의 google id 탐색)
      if (urlStr.includes('searchText')) {
        return Promise.resolve({
          ok: true,
          json: async () => ({ places: [{ id: 'ChIJ51cu8IcbXWARiRtXIothAS4' }] }),
        });
      }
      // 구글 Place Detail
      if (urlStr.includes('places.googleapis.com/v1/places/')) {
        return Promise.resolve({ ok: true, json: async () => GOOGLE_PLACE_DETAIL_RAW });
      }
      // 네이버 블로그
      if (urlStr.includes('openapi.naver.com')) {
        return Promise.resolve({ ok: true, json: async () => NAVER_BLOG_SEARCH_RAW });
      }
      // 카카오 블로그
      if (urlStr.includes('dapi.kakao.com/v2/search/blog')) {
        return Promise.resolve({ ok: true, json: async () => KAKAO_BLOG_SEARCH_RAW });
      }
      return Promise.reject(new Error(`Unexpected fetch: ${urlStr}`));
    }));
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('PlaceDetail에 blogs.naver, blogs.kakao가 포함된다', async () => {
    const res = await invokeApp('/v1/places/kakao:26338954', realEnv());
    expect(res.status).toBe(200);
    const body = (await res.json()) as { blogs: { naver: unknown[]; kakao: unknown[] } };
    expect(body.blogs.naver.length).toBeGreaterThan(0);
    expect(body.blogs.kakao.length).toBeGreaterThan(0);
  });
});

describe('GET /v1/blogs — 데모 모드', () => {
  it('q 파라미터 없으면 400', async () => {
    const res = await invokeApp('/v1/blogs', demoEnv());
    expect(res.status).toBe(400);
  });

  it('q 있으면 200 + {naver, kakao} 반환', async () => {
    const res = await invokeApp('/v1/blogs?q=카페', demoEnv());
    expect(res.status).toBe(200);
    const body = (await res.json()) as { naver: unknown[]; kakao: unknown[] };
    expect(body).toHaveProperty('naver');
    expect(body).toHaveProperty('kakao');
  });
});

describe('GET /v1/blogs — 실 모드 (fetch 모킹)', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn().mockImplementation((url: string | URL | Request) => {
      const urlStr = typeof url === 'string' ? url : url instanceof URL ? url.toString() : (url as Request).url;
      if (urlStr.includes('openapi.naver.com')) {
        return Promise.resolve({ ok: true, json: async () => NAVER_BLOG_SEARCH_RAW });
      }
      if (urlStr.includes('dapi.kakao.com/v2/search/blog')) {
        return Promise.resolve({ ok: true, json: async () => KAKAO_BLOG_SEARCH_RAW });
      }
      return Promise.reject(new Error(`Unexpected: ${urlStr}`));
    }));
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('네이버+카카오 블로그 병합 결과 반환', async () => {
    const res = await invokeApp('/v1/blogs?q=카페', realEnv());
    expect(res.status).toBe(200);
    const body = (await res.json()) as { naver: unknown[]; kakao: unknown[] };
    expect(body.naver.length).toBeGreaterThan(0);
    expect(body.kakao.length).toBeGreaterThan(0);
  });
});

describe('GET /v1/places/:id — 구글 eager 병합 제거 (§11 lazy 방어선)', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn().mockImplementation((url: string | URL | Request) => {
      const urlStr = typeof url === 'string' ? url : url instanceof URL ? url.toString() : (url as Request).url;
      if (urlStr.includes('dapi.kakao.com/v2/local')) {
        return Promise.resolve({ ok: true, json: async () => KAKAO_LOCAL_SEARCH_RAW });
      }
      if (urlStr.includes('openapi.naver.com')) {
        return Promise.resolve({ ok: true, json: async () => NAVER_BLOG_SEARCH_RAW });
      }
      if (urlStr.includes('dapi.kakao.com/v2/search/blog')) {
        return Promise.resolve({ ok: true, json: async () => KAKAO_BLOG_SEARCH_RAW });
      }
      // 구글 호출이 일어나면 테스트 실패시킴 (상세에서 구글 호출 없어야 함)
      return Promise.reject(new Error(`Unexpected fetch (no Google in detail): ${urlStr}`));
    }));
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('상세 응답에서 구글을 호출하지 않고 200 반환', async () => {
    const res = await invokeApp(placeDetailPath('kakao:26338954'), realEnv());
    expect(res.status).toBe(200);
  });

  it('상세 응답의 reviews는 빈 배열, rating은 없음 (lazy)', async () => {
    const res = await invokeApp(placeDetailPath('kakao:26338954'), realEnv());
    const body = (await res.json()) as { reviews: unknown[]; rating?: unknown };
    expect(body.reviews).toEqual([]);
    expect(body.rating).toBeUndefined();
  });

  it('상세 응답에 블로그는 정상 포함', async () => {
    const res = await invokeApp(placeDetailPath('kakao:26338954'), realEnv());
    const body = (await res.json()) as { blogs: { naver: unknown[]; kakao: unknown[] } };
    expect(body.blogs.naver.length).toBeGreaterThan(0);
    expect(body.blogs.kakao.length).toBeGreaterThan(0);
  });
});

describe('GET /v1/places/:id/google — 데모 모드', () => {
  it('존재하는 id는 { rating, reviews } 반환', async () => {
    const res = await invokeApp(placeGooglePath('kakao:26338954'), demoEnv());
    expect(res.status).toBe(200);
    const body = (await res.json()) as { rating?: unknown; reviews: unknown[] };
    expect(Array.isArray(body.reviews)).toBe(true);
  });

  it('존재하지 않는 id는 404', async () => {
    const res = await invokeApp(placeGooglePath('kakao:nonexistent'), demoEnv());
    expect(res.status).toBe(404);
  });
});

describe('GET /v1/places/:id/google — 실 모드 구글 응답 정규화', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn().mockImplementation((url: string | URL | Request) => {
      const urlStr = typeof url === 'string' ? url : url instanceof URL ? url.toString() : (url as Request).url;
      // 카카오 검색 (이름 복구)
      if (urlStr.includes('dapi.kakao.com/v2/local')) {
        return Promise.resolve({ ok: true, json: async () => KAKAO_LOCAL_SEARCH_RAW });
      }
      // 구글 Text Search (kakao 장소의 google id 탐색)
      if (urlStr.includes('searchText')) {
        return Promise.resolve({
          ok: true,
          json: async () => ({ places: [{ id: 'ChIJ51cu8IcbXWARiRtXIothAS4' }] }),
        });
      }
      // 구글 Place Detail
      if (urlStr.includes('places.googleapis.com/v1/places/')) {
        return Promise.resolve({ ok: true, json: async () => GOOGLE_PLACE_DETAIL_RAW });
      }
      return Promise.reject(new Error(`Unexpected fetch: ${urlStr}`));
    }));
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('구글 평점·리뷰를 정규화해 반환한다', async () => {
    const res = await invokeApp(placeGooglePath('kakao:26338954'), realEnv());
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      rating?: { source: string };
      reviews: Array<{ author: string }>;
    };
    expect(body.reviews.length).toBeGreaterThan(0);
    expect(body.rating?.source).toBe('google');
  });
});

describe('GET /v1/places/:id/google — graceful degradation (구글 실패)', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn().mockImplementation((url: string | URL | Request) => {
      const urlStr = typeof url === 'string' ? url : url instanceof URL ? url.toString() : (url as Request).url;
      if (urlStr.includes('dapi.kakao.com/v2/local')) {
        return Promise.resolve({ ok: true, json: async () => KAKAO_LOCAL_SEARCH_RAW });
      }
      // 구글 요청 → 실패
      return Promise.reject(new Error('Google network error'));
    }));
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('구글 실패해도 200 + reviews 빈 배열', async () => {
    const res = await invokeApp(placeGooglePath('kakao:26338954'), realEnv());
    expect(res.status).toBe(200);
    const body = (await res.json()) as { reviews: unknown[]; rating?: unknown };
    expect(body.reviews).toEqual([]);
    expect(body.rating).toBeUndefined();
  });
});

describe('실-모드 경로 매핑 — PlaceService가 사용하는 모든 경로가 프록시에 등록됨', () => {
  // PlaceService(D)가 호출하는 경로 전부 — shared/api 단일 진실 소스 사용.
  // 데모 모드로 app.fetch를 직접 구동해 등록/응답을 검증한다(상수 비교가 아닌 live 라우팅).
  it('search 경로는 q와 함께 2xx', async () => {
    const res = await invokeApp(`${placesSearchPath}?q=카페`, demoEnv());
    expect(res.status).toBe(200);
  });

  it('search 경로는 q 누락 시 400', async () => {
    const res = await invokeApp(placesSearchPath, demoEnv());
    expect(res.status).toBe(400);
  });

  it('detail 경로는 존재하는 id에 2xx', async () => {
    const res = await invokeApp(placeDetailPath('kakao:26338954'), demoEnv());
    expect(res.status).toBe(200);
  });

  it('detail 경로는 미존재 id에 404', async () => {
    const res = await invokeApp(placeDetailPath('kakao:nonexistent'), demoEnv());
    expect(res.status).toBe(404);
  });

  it('google 경로는 존재하는 id에 2xx (404가 아님 — 회귀 방어)', async () => {
    const res = await invokeApp(placeGooglePath('kakao:26338954'), demoEnv());
    expect(res.status).toBe(200);
  });

  it('google 경로는 미존재 id에 404', async () => {
    const res = await invokeApp(placeGooglePath('kakao:nonexistent'), demoEnv());
    expect(res.status).toBe(404);
  });

  it('blogs 경로는 q와 함께 2xx', async () => {
    const res = await invokeApp(`${blogsPath}?q=카페`, demoEnv());
    expect(res.status).toBe(200);
  });

  it('blogs 경로는 q 누락 시 400', async () => {
    const res = await invokeApp(blogsPath, demoEnv());
    expect(res.status).toBe(400);
  });
});

describe('존재하지 않는 경로', () => {
  it('404 반환', async () => {
    const res = await invokeApp('/nonexistent', demoEnv());
    expect(res.status).toBe(404);
  });
});
