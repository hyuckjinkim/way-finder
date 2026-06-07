/**
 * A4 — IP 레이트리밋 단위 테스트.
 */
import { describe, it, expect } from 'vitest';
import { Hono } from 'hono';
import type { Env } from '../config.js';
import { rateLimitMiddleware } from './ratelimit.js';

function makeKV(): KVNamespace {
  const store = new Map<string, string>();
  return {
    async get(key: string) { return store.get(key) ?? null; },
    async put(key: string, value: string) { store.set(key, value); },
    async delete(key: string) { store.delete(key); },
    async list() { return { keys: [], list_complete: true, caret: undefined }; },
    async getWithMetadata(key: string) { return { value: store.get(key) ?? null, metadata: null }; },
  } as unknown as KVNamespace;
}

function makeEnv(kv?: KVNamespace): Env {
  return {
    DEMO_MODE: 'auto',
    KAKAO_REST_KEY: '',
    GOOGLE_PLACES_KEY: '',
    NAVER_CLIENT_ID: '',
    NAVER_CLIENT_SECRET: '',
    KAKAO_MOBILITY_KEY: '',
    TMAP_APP_KEY: '',
    GOOGLE_ROUTES_KEY: '',
    MAPBOX_TOKEN: '',
    CACHE: kv ?? makeKV(),
  };
}

function makeApp(kv?: KVNamespace) {
  const app = new Hono<{ Bindings: Env }>();
  app.use('/v1/*', rateLimitMiddleware);
  app.get('/v1/test', (c) => c.json({ ok: true }));
  return { app, env: makeEnv(kv) };
}

describe('rateLimitMiddleware', () => {
  it('KV 없으면 통과 (테스트/로컬 환경)', async () => {
    const { app, env } = makeApp();
    // CACHE를 null로 설정 — KV 없는 환경
    const noKvEnv = { ...env, CACHE: null as unknown as KVNamespace };
    const req = new Request('http://localhost/v1/test');
    const res = await app.fetch(req, noKvEnv, {} as ExecutionContext);
    expect(res.status).toBe(200);
  });

  it('한도 미만 요청은 통과한다', async () => {
    const kv = makeKV();
    const { app, env } = makeApp(kv);
    const req = new Request('http://localhost/v1/test', {
      headers: { 'CF-Connecting-IP': '1.2.3.4' },
    });
    const res = await app.fetch(req, env, {} as ExecutionContext);
    expect(res.status).toBe(200);
  });

  it('카운터가 한도(60)에 도달하면 429 반환', async () => {
    const kv = makeKV();
    // 카운터를 60으로 미리 설정
    await kv.put('ratelimit:1.2.3.5', '60');
    const { app, env } = makeApp(kv);
    const req = new Request('http://localhost/v1/test', {
      headers: { 'CF-Connecting-IP': '1.2.3.5' },
    });
    const res = await app.fetch(req, env, {} as ExecutionContext);
    expect(res.status).toBe(429);
  });

  it('429 응답에 retryAfter 필드가 포함된다', async () => {
    const kv = makeKV();
    await kv.put('ratelimit:9.8.7.6', '60');
    const { app, env } = makeApp(kv);
    const req = new Request('http://localhost/v1/test', {
      headers: { 'CF-Connecting-IP': '9.8.7.6' },
    });
    const res = await app.fetch(req, env, {} as ExecutionContext);
    const body = (await res.json()) as { retryAfter: number };
    expect(body.retryAfter).toBeGreaterThan(0);
  });
});
