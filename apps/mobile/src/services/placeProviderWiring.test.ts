/**
 * 회귀: 검색 화면들은 provider 기본값이 mockPlaceProvider라, 라우트에서 주입을 빼먹으면
 * 실 모드(배포본)에서도 검색이 mock으로 돈다(2026-11-18 "검색 결과 없음" 원인). 라우트가 PlaceService를 주입하는지 확인.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const APP = join(__dirname, '../../app');

describe('검색 화면 provider 배선 — 실 PlaceService 주입', () => {
  it.each([
    ['search.tsx', 'SearchScreen'],
    ['route/input.tsx', 'RouteInputScreen'],
  ])('%s → <%s provider={PlaceService}>', (file, screen) => {
    const src = readFileSync(join(APP, file), 'utf8');
    expect(src).toMatch(new RegExp(`<${screen}\\b[^>]*\\bprovider=\\{PlaceService\\}`));
  });
});
