// ESLint flat config (.styleguide app §2.4).
// - apps/mobile: Expo 공식 설정 eslint-config-expo(SDK 56 권장 판) — core·typescript·react·react-hooks·import·expo 규칙.
// - packages·services·scripts·e2e: @eslint/js recommended + typescript-eslint recommended.
// ESLint 는 9 를 쓴다: eslint-config-expo 가 쓰는 eslint-plugin-react 가 ESLint 10 을 아직 지원하지 않는다.
import { defineConfig, globalIgnores } from 'eslint/config';
import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import globals from 'globals';
import expoConfig from 'eslint-config-expo/flat.js';

export default defineConfig([
  globalIgnores([
    '**/node_modules/',
    '**/dist/',
    '**/.expo/',
    '**/web-build/',
    '**/.wrangler/',
    '**/coverage/',
    'poc/',
    'e2e/node_modules',
  ]),
  {
    files: ['apps/mobile/**/*.{js,jsx,ts,tsx,mjs,cjs}'],
    extends: [expoConfig],
    rules: {
      // React Compiler 계열 규칙(react-hooks v7). 도입 때 기존 코드 22곳이 걸렸다 — 고치려면 화면 동작을
      // 바꾸는 리팩터링이라 기기 확인과 함께 한다. 그때까지 경고로 둔다(.styleguide wayfinder §3).
      'react-hooks/refs': 'warn',
      'react-hooks/set-state-in-effect': 'warn',
    },
  },
  {
    // vi.mock 을 import 보다 먼저 적는 테스트 관례(vitest 가 끌어올린다).
    files: ['apps/mobile/**/*.test.{ts,tsx}'],
    rules: { 'import/first': 'off' },
  },
  {
    files: [
      'packages/**/*.{js,mjs,ts,tsx}',
      'services/**/*.{js,mjs,ts}',
      'scripts/**/*.{js,mjs,ts}',
      'e2e/**/*.{js,mjs,ts}',
      '*.{js,mjs,ts}',
    ],
    extends: [js.configs.recommended, tseslint.configs.recommended],
    languageOptions: { globals: { ...globals.node, ...globals.worker } },
    rules: {
      // 밑줄로 시작하는 이름은 「일부러 안 쓴다」는 표시(typescript-eslint 문서의 관례).
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_', caughtErrorsIgnorePattern: '^_' },
      ],
    },
  },
  {
    // page.evaluate 안의 코드는 브라우저에서 돈다.
    files: ['e2e/**/*.{js,mjs,ts}'],
    languageOptions: { globals: { ...globals.browser } },
  },
]);
