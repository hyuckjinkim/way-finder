import { defineConfig } from 'vitest/config';

/**
 * 스트림 B 지도 모듈 전용 Vitest 설정.
 *
 * mobile 패키지엔 공용 test 러너가 없고(의존성 추가 금지 — 루트 hoisted vitest 사용),
 * 루트 vitest.config.ts는 packages/services만 수집한다(F4 소유, 수정 금지).
 * 이 설정은 `src/map/**` 단위 테스트만 수집하는 격리 러너로,
 *   `node_modules/.bin/vitest run --config apps/mobile/src/map/vitest.config.ts`
 * 로 실행한다. 다른 워커의 파일을 건드리지 않는다.
 */
export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    root: __dirname,
    include: ['**/*.test.ts', '**/*.test.tsx'],
  },
});
