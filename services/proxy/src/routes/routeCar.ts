/**
 * 자동차 경로 핸들러 — F1 501 stub.
 *
 * 스트림 A(A2)가 이 파일을 덮어쓴다 (카카오모빌리티/Google Routes 정규화).
 * modeHandlers.ts·index.ts는 fan-out 후 불가침 (critic C2 — 동일 파일 동시 편집 차단).
 */
import type { RouteHandler } from './modeHandlers.js';

export const routeCar: RouteHandler = async () => {
  return new Response(
    JSON.stringify({ error: 'car routing not implemented' }),
    { status: 501, headers: { 'content-type': 'application/json' } },
  );
};
