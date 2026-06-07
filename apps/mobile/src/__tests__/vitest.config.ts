import { defineConfig } from 'vitest/config';

/**
 * 스트림 C(화면) 전용 Vitest 설정.
 *
 * 루트 vitest 설정의 include는 packages/**·services/** 만 포함하고(앱 제외),
 * 워커 C는 루트 설정과 mobile package.json을 수정할 수 없다(소유권 밖).
 * 따라서 화면/부품의 순수 로직 테스트는 이 in-scope 설정으로 실행한다.
 *
 * 실행: pnpm exec vitest run --config apps/mobile/src/__tests__/vitest.config.ts
 *
 * 환경은 node — 테스트 대상 모듈은 react-native·expo-*를 import하지 않는 순수 로직만이다
 * (react-test-renderer 미설치, DOM 환경 부재. E 스트림에서 렌더 통합 검증).
 */
export default defineConfig({
  root: __dirname + '/../..',
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
    exclude: ['**/node_modules/**', '**/dist/**'],
  },
});
