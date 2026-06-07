import { defineConfig } from 'vitest/config';

/** @wayfinder/shared 단위 테스트 설정 (F3/F4). */
export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
});
