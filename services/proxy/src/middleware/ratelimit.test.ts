/**
 * A4 — IP 레이트리밋 단위 테스트 (Workers Rate Limiting 바인딩).
 */
import { describe, it, expect, vi } from 'vitest';
import { Hono } from 'hono';
import type { Env } from '../config.js';
import { rateLimitMiddleware } from './ratelimit.js';

function makeApp(limiter?: RateLimit) {
  const app = new Hono<{ Bindings: Env }>();
  app.use('/v1/*', rateLimitMiddleware);
  app.get('/v1/test', (c) => c.json({ ok: true }));
  const env = { RATE_LIMITER: limiter } as unknown as Env;
  const call = (ip = '1.2.3.4') =>
    app.fetch(new Request('http://localhost/v1/test', { headers: { 'CF-Connecting-IP': ip } }), env, {} as ExecutionContext);
  return { call };
}

describe('rateLimitMiddleware', () => {
  it('바인딩 없으면 통과 (테스트/로컬 환경)', async () => {
    const res = await makeApp().call();
    expect(res.status).toBe(200);
  });

  it('한도 내 요청은 통과하고 IP를 키로 limit을 호출한다', async () => {
    const limit = vi.fn().mockResolvedValue({ success: true });
    const res = await makeApp({ limit }).call('1.2.3.4');
    expect(res.status).toBe(200);
    expect(limit).toHaveBeenCalledWith({ key: '1.2.3.4' });
  });

  it('한도 초과(success:false)면 429 + Retry-After 헤더 + retryAfter 필드', async () => {
    const res = await makeApp({ limit: async () => ({ success: false }) }).call();
    expect(res.status).toBe(429);
    expect(Number(res.headers.get('Retry-After'))).toBeGreaterThan(0);
    const body = (await res.json()) as { retryAfter: number };
    expect(body.retryAfter).toBeGreaterThan(0);
  });

  it('limit 호출이 throw하면 fail-open으로 통과한다', async () => {
    const err = vi.spyOn(console, 'error').mockImplementation(() => {});
    const res = await makeApp({ limit: async () => { throw new Error('boom'); } }).call();
    expect(res.status).toBe(200);
    err.mockRestore();
  });
});

// 앱 전체(../index.js)를 콜드 import — 패키지 병렬 실행 부하에서 기본 5s를 넘겨 간헐 실패했다.
describe('routesRateLimit — POST /v1/routes 전용 한도', { timeout: 20_000 }, () => {
  it('ROUTES_RATE_LIMITER 초과면 429, 다른 경로는 영향 없음', async () => {
    const { default: app } = await import('../index.js');
    const env = { DEMO_MODE: 'true', ROUTES_RATE_LIMITER: { limit: async () => ({ success: false }) } };
    const post = await app.fetch(
      new Request('http://localhost/v1/routes', { method: 'POST', body: '{}' }),
      env,
      {} as ExecutionContext,
    );
    expect(post.status).toBe(429);
    const health = await app.fetch(new Request('http://localhost/v1/capabilities'), env, {} as ExecutionContext);
    expect(health.status).toBe(200);
  });
});
