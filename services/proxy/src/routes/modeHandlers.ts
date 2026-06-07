/**
 * 모드 디스패치 — `POST /v1/routes` 진입점 (critic C2, F1 소유).
 *
 * `dispatchRoutes`는 body의 `mode`로 모드별 핸들러를 선택해 위임한다.
 * 이 파일과 index.ts는 fan-out 후 불가침 — A는 car/walk/bike 핸들러 파일만,
 * B는 transit 핸들러 파일만 덮어쓴다 (동일 파일 동시 편집 원천 차단).
 *
 * 입력 검증(stops 수·좌표 유효성 등)은 A3 routeValidate의 책임 — 여기서는 안 함(YAGNI).
 */
import type { Context } from 'hono';
import type { TravelMode } from '@wayfinder/shared';
import type { Env } from '../config.js';
import { routeCar } from './routeCar.js';
import { routeWalk } from './routeWalk.js';
import { routeBike } from './routeBike.js';
import { routeTransit } from './routeTransit.js';

/** 모드별 경로 핸들러 계약. Hono Context를 받아 Response를 반환. */
export type RouteHandler = (c: Context<{ Bindings: Env }>) => Promise<Response>;

/** 모드 → 핸들러 레지스트리. A/B가 stub 파일을 덮어쓰면 자동 반영. */
export const modeHandlers: Record<TravelMode, RouteHandler> = {
  car: routeCar,
  walk: routeWalk,
  bike: routeBike,
  transit: routeTransit,
};

/**
 * `POST /v1/routes` 디스패처. body `{ stops, mode }`의 `mode`로 핸들러 선택.
 * 알 수 없는 mode는 400.
 */
export async function dispatchRoutes(
  c: Context<{ Bindings: Env }>,
): Promise<Response> {
  let body: { mode?: unknown };
  try {
    body = (await c.req.json()) as { mode?: unknown };
  } catch {
    return c.json({ error: 'invalid JSON body' }, 400);
  }

  const mode = body.mode;
  if (typeof mode !== 'string' || !(mode in modeHandlers)) {
    return c.json({ error: `unknown mode: ${String(mode)}` }, 400);
  }

  return modeHandlers[mode as TravelMode](c);
}
