import { defineConfig } from 'vitest/config';

/**
 * 스모크 테스트 전용 vitest 설정 (E3).
 * smoke/ 디렉토리의 *.skip.ts 파일만 포함 — 기본 CI(test)와 완전 분리.
 * 실행: pnpm --filter @wayfinder/proxy test:smoke (실 키 env 필요)
 */
export default defineConfig({
  test: {
    environment: 'node',
    include: ['smoke/**/*.skip.ts'],
  },
});
