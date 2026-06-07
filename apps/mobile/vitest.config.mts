import { defineConfig } from 'vitest/config';

/**
 * @wayfinder/mobile 단일 Vitest 설정 (E3 통합).
 *
 * 이전엔 워커별 산발 설정(src/__tests__/vitest.config.ts, src/map/vitest.config.ts)이
 * 각자 격리 러너로 돌았으나, E3에서 단일 패키지 설정으로 통합한다.
 * package.json `test` 스크립트(`vitest run`)가 이 설정을 자동으로 집어들어
 * 루트 `pnpm -r test`에 mobile이 포함된다.
 *
 * environment는 node — 순수 로직 테스트는 react-native·expo-*를 import하지 않는다.
 * 단, 라우트 레벨 렌더 테스트(routeRender.test.tsx)는 화면 컴포넌트를 마운트하므로
 * `react-native` → `react-native-web` alias로 RN 프리미티브(View/Text/Pressable)를
 * DOM으로 매핑하고 react-dom/server.renderToStaticMarkup으로 문자열 렌더한다
 * (react-dom·react-native-web은 이미 mobile 의존성 — 의존성 추가 없음).
 * globals: 기존 src/map 테스트가 bare describe/it을 쓸 수 있어 유지한다.
 */
export default defineConfig({
  // RN/Expo 런타임 전역. Metro/babel이 번들 시 주입하는 값을 테스트 환경에서 정의한다
  // (expo-constants가 import 시점에 __DEV__·EXPO_OS를 참조 — 미정의 시 ReferenceError).
  define: {
    __DEV__: 'false',
    'process.env.EXPO_OS': '"web"',
  },
  resolve: {
    alias: {
      'react-native': 'react-native-web',
    },
    // Metro의 플랫폼 해석을 모사: `.web.tsx`를 `.tsx`보다 먼저 해석해
    // 화면이 import하는 `../map/MapView`가 웹 디스패처(MapView.web.tsx)로 풀린다.
    // 네이티브 디스패처(MapView.tsx)는 Flow 구문의 네이티브 맵 모듈을 transitively
    // 끌어와 node 트랜스폼이 깨지므로(B4 웹 격리 불변식), 웹 엔트리로 우회한다.
    extensions: [
      '.web.tsx',
      '.web.ts',
      '.web.jsx',
      '.web.js',
      '.tsx',
      '.ts',
      '.jsx',
      '.js',
      '.json',
    ],
  },
  test: {
    globals: true,
    environment: 'node',
    include: ['src/**/*.test.{ts,tsx}'],
    exclude: ['**/node_modules/**', '**/dist/**'],
  },
});
