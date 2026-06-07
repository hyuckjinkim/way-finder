import { defineConfig } from 'vitest/config';

/**
 * D3 — 라이브 컨테이너 e2e 설정 (게이트 B, env-gated).
 *
 * 기본 단위 설정(vitest.config.ts)과 분리된 lane. node 환경에서 e2e 디렉토리의
 * `.e2e.ts` 파일만 실행하며, `VALHALLA_URL` 미설정 시 테스트가 자체 describe.skip한다.
 * 실행: VALHALLA_URL=http://localhost:8002 pnpm --filter @wayfinder/proxy test:e2e
 */
export default defineConfig({
  test: {
    environment: 'node',
    include: ['e2e/**/*.e2e.ts'],
    // 라이브 컨테이너 왕복(2-call) — 단위보다 넉넉한 타임아웃.
    testTimeout: 30_000,
  },
});
