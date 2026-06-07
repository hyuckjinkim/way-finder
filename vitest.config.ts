import { defineConfig } from 'vitest/config';

/**
 * 루트 Vitest 설정 (Foundation F4).
 *
 * 각 워크스페이스 패키지는 자체 test 스크립트(`vitest run`)를 갖는다.
 * 모노레포 전체 실행은 `pnpm -r test` (각 패키지가 독립 실행)를 사용한다.
 * 이 루트 설정은 저장소 루트에서 직접 `vitest`를 돌릴 때의 기본값으로,
 * 모든 패키지의 *.test.ts를 한 번에 수집한다.
 */
export default defineConfig({
  test: {
    globals: true,
    include: ['packages/**/src/**/*.test.ts', 'services/**/src/**/*.test.ts'],
    exclude: ['**/node_modules/**', '**/dist/**'],
  },
});
