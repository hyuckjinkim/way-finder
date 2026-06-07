import { defineConfig } from 'vitest/config';

/**
 * 프록시 단위 테스트 설정 (Foundation F4).
 * 현재는 node 환경의 순수 단위 테스트만. 스트림 A(A2)가 통합 테스트를
 * @cloudflare/vitest-pool-workers로 교체한다.
 */
export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
});
