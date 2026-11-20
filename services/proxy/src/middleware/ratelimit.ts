/**
 * A4 — IP 기반 레이트리밋 미들웨어 (Hono).
 *
 * Workers Rate Limiting 바인딩(RATE_LIMITER, wrangler.toml [[ratelimits]])을 사용한다.
 * KV 카운터(요청마다 get+put)는 무료 티어 쓰기 쿼터(1,000/일)를 소진하고 지연을 더해 폐기.
 * 한도·윈도우(60 req/min)는 wrangler.toml에서 정의한다.
 *
 * 바인딩이 없거나(테스트/로컬) 호출이 실패하면 통과(fail-open) — 한도 장애가 서비스 장애가 되면 안 된다.
 * 한도 초과 시 429 + Retry-After.
 */
import type { Context, Next } from 'hono';
import type { Env } from '../config.js';

const RETRY_AFTER_SEC = 60;

/** binding으로 지정한 Rate Limiting 바인딩을 쓰는 미들웨어. */
export const rateLimitBy = (binding: 'RATE_LIMITER' | 'ROUTES_RATE_LIMITER') => async (
  c: Context<{ Bindings: Env }>,
  next: Next,
): Promise<void | Response> => {
  const limiter = c.env[binding];
  if (limiter) {
    const ip =
      c.req.header('CF-Connecting-IP') ??
      c.req.header('X-Forwarded-For') ??
      'unknown';
    try {
      const { success } = await limiter.limit({ key: ip });
      if (!success) {
        return c.json(
          { error: 'Too Many Requests', retryAfter: RETRY_AFTER_SEC },
          429,
          { 'Retry-After': String(RETRY_AFTER_SEC) },
        );
      }
    } catch (err) {
      console.error('[ratelimit] limiter failed, passing through:', err);
    }
  }
  await next();
};

/** /v1/* 전역 60 req/min. */
export const rateLimitMiddleware = rateLimitBy('RATE_LIMITER');
/** POST /v1/routes 전용 10 req/min (카카오 대중교통 일일 상한 보호). */
export const routesRateLimit = rateLimitBy('ROUTES_RATE_LIMITER');
