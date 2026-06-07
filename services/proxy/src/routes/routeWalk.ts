/**
 * 도보 경로 핸들러 — F1 501 stub.
 *
 * 스트림 A(A2)가 이 파일을 덮어쓴다 (TMAP 보행자/Google Routes 정규화).
 * modeHandlers.ts·index.ts는 fan-out 후 불가침 (critic C2).
 */
import type { RouteHandler } from './modeHandlers.js';

export const routeWalk: RouteHandler = async () => {
  return new Response(
    JSON.stringify({ error: 'walk routing not implemented' }),
    { status: 501, headers: { 'content-type': 'application/json' } },
  );
};
