/**
 * 대중교통 경로 핸들러 — F1 501 stub.
 *
 * 스트림 B(B2)가 이 파일을 덮어쓴다 (ODsay/Google transit leg-chaining + 시외 스티칭).
 * modeHandlers.ts·index.ts는 fan-out 후 불가침 (critic C2).
 */
import type { RouteHandler } from './modeHandlers.js';

export const routeTransit: RouteHandler = async () => {
  return new Response(
    JSON.stringify({ error: 'transit routing not implemented' }),
    { status: 501, headers: { 'content-type': 'application/json' } },
  );
};
