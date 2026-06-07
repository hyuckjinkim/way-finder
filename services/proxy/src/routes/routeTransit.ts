/**
 * B2 — 대중교통 경로 핸들러 (F1 501 stub 덮어쓰기).
 *
 * 흐름 (routeDirect 패턴 계승 — A3 validateRouteBody 재사용):
 *   1. body 파싱·검증 (A3) — 실패 400.
 *   2. 지역 판정 — shared routeRegion(stops) (F1.8).
 *   3. 데모 모드(키 없음) → F2 mockRouteProvider (실 fetch 없음). 키 0개 게이트는 이 경로.
 *   4. 실 모드 → leg-chaining(B2) / 시외 스티칭(B3) 합성 → 정규화.
 *      실패 격리(silent 금지) → 502.
 *
 * **ODSAY 키 갭(블로커):** config.ts `Env`에 `ODSAY_API_KEY`가 아직 없고 config.ts는
 * 본 스트림 경계 밖(F1/A 소유)이다. 따라서 실 ODsay fetch 배선은 키 추가 후로 연기한다.
 * 키 0개 게이트에서는 `isRouteDemoMode`가 transit에 대해 항상 데모로 떨어져(아래) 동작에
 * 영향 없음. 실 모드 전환 시 fetch + chainTransitLegs(B2)/stitchIntercity(B3)를 배선한다.
 *
 * modeHandlers.ts·index.ts는 fan-out 후 불가침 (critic C2).
 */
import type { Context } from 'hono';
import type { Route } from '@wayfinder/shared';
import { routeRegion } from '@wayfinder/shared/region';
import { mockRouteProvider } from '@wayfinder/shared/mocks';
import type { Env } from '../config.js';
import { isRouteDemoMode } from '../config.js';
import { validateRouteBody } from './routeValidate.js';
import type { RouteHandler } from './modeHandlers.js';

export const routeTransit: RouteHandler = async (
  c: Context<{ Bindings: Env }>,
): Promise<Response> => {
  let body: unknown;
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: 'invalid JSON body' }, 400);
  }

  const result = validateRouteBody(body);
  if (!result.ok) {
    return c.json({ error: result.error }, 400);
  }
  if (result.request.mode !== 'transit') {
    return c.json(
      { error: `mode mismatch: handler=transit body=${result.request.mode}` },
      400,
    );
  }

  const region = routeRegion(result.request.stops);

  // 데모 모드 — 실 fetch 없이 mock provider (leg-chaining·시외 픽스처 선택은 provider가 담당).
  if (isRouteDemoMode(c.env, region)) {
    const route: Route = await mockRouteProvider.getRoute(result.request);
    return c.json(route);
  }

  // 실 모드 — ODSAY 키 갭으로 미배선 (위 주석). 명시적 에러(silent failure 금지).
  return c.json(
    { error: 'transit real-mode routing not configured (ODSAY_API_KEY missing)' },
    502,
  );
};
