/**
 * A4 — IP 기반 레이트리밋 미들웨어 (Hono).
 *
 * Workers KV를 카운터 저장소로 사용한다.
 * - 윈도우: 60초
 * - 한도: RATE_LIMIT_MAX (기본 60 req/min/IP)
 *
 * 한도 초과 시 429 응답. 키가 없는 경우(테스트/로컬) 통과.
 */
import type { Context, Next } from 'hono';
import type { Env } from '../config.js';

const WINDOW_SEC = 60;
const RATE_LIMIT_MAX = 60;

/**
 * IP 레이트리밋 미들웨어.
 * Hono 미들웨어 시그니처: (c, next) => Promise<void | Response>
 */
export async function rateLimitMiddleware(
  c: Context<{ Bindings: Env }>,
  next: Next,
): Promise<void | Response> {
  const kv = c.env.CACHE;
  // KV가 없으면 (테스트/로컬) 통과
  if (!kv) {
    await next();
    return;
  }

  const ip =
    c.req.header('CF-Connecting-IP') ??
    c.req.header('X-Forwarded-For') ??
    'unknown';

  const key = `ratelimit:${ip}`;

  const raw = await kv.get(key);
  const count = raw !== null ? parseInt(raw, 10) : 0;

  if (count >= RATE_LIMIT_MAX) {
    return c.json(
      { error: 'Too Many Requests', retryAfter: WINDOW_SEC },
      429,
    );
  }

  // 카운터 증가; 신규 키면 TTL 설정, 기존 키는 갱신하지 않아 윈도우 유지
  if (raw === null) {
    await kv.put(key, '1', { expirationTtl: WINDOW_SEC });
  } else {
    await kv.put(key, String(count + 1), { expirationTtl: WINDOW_SEC });
  }

  await next();
}
