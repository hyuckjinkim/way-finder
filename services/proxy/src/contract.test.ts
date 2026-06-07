/**
 * F1 와이어 계약 introspection 테스트.
 *
 * P1 드리프트(클라이언트 호출 경로 ≠ 프록시 등록 경로)를 "프로즈가 아니라 테스트
 * 실패"로 만든다. shared/api가 export하는 모든 경로 상수·빌더가 Hono `app.routes`에
 * 올바른 method로 등록돼 있다고 단언한다 — POST /v1/routes 포함.
 *
 * 빌더(`:param` 포함)는 센티널로 구체화해 검증한다 (critic M1):
 *   placeDetailPath('__SENTINEL__') === 등록 패턴 '/v1/places/:id'의 :id를 센티널로 치환
 * 센티널은 인코딩 영향 없는 [A-Za-z_]만 사용.
 */
import { describe, it, expect } from 'vitest';
import app from './index.js';
import {
  placesSearchPath,
  placeDetailPath,
  placeGooglePath,
  blogsPath,
  routesPath,
} from '@wayfinder/shared/api';

/** 인코딩 영향 없는 센티널 — 빌더 구체화 + 등록 패턴 :param 치환에 동일 사용. */
const SENTINEL = '__SENTINEL__';

/** 등록된 Hono 패턴의 모든 `:param` 세그먼트를 센티널로 치환. */
function fillParams(pattern: string): string {
  return pattern.replace(/:[^/]+/g, SENTINEL);
}

/** `app.routes`에서 `${METHOD} ${path}` 집합 생성 (method 대문자 정규화). */
function registeredSet(): Set<string> {
  return new Set(
    app.routes.map((r) => `${r.method.toUpperCase()} ${fillParams(r.path)}`),
  );
}

describe('contract — shared/api 경로가 전부 프록시에 등록됨 (subset 단언)', () => {
  // subset 단언: shared 경로 ⊆ 등록 경로. 역방향(set-equality) 금지 —
  // app.use('/v1/*')(ALL)·헬스('/') 등 미들웨어/기타 라우트가 포함되므로.
  const expected: Array<{ method: string; path: string }> = [
    { method: 'GET', path: placesSearchPath },
    { method: 'GET', path: blogsPath },
    { method: 'GET', path: placeDetailPath(SENTINEL) },
    { method: 'GET', path: placeGooglePath(SENTINEL) },
    { method: 'POST', path: routesPath },
  ];

  for (const { method, path } of expected) {
    it(`${method} ${path} 등록됨`, () => {
      const registered = registeredSet();
      expect(registered.has(`${method} ${path}`)).toBe(true);
    });
  }

  it('POST /v1/routes 가 명시적으로 등록됨 (GET만이 아님)', () => {
    const registered = registeredSet();
    expect(registered.has(`POST ${routesPath}`)).toBe(true);
  });

  it('빌더 센티널이 등록 패턴의 :param 치환과 정확히 일치', () => {
    // placeDetailPath(SENTINEL) === /v1/places/__SENTINEL__,
    // 등록 패턴 /v1/places/:id 를 치환하면 동일해야 함.
    expect(placeDetailPath(SENTINEL)).toBe(`/v1/places/${SENTINEL}`);
    expect(placeGooglePath(SENTINEL)).toBe(`/v1/places/${SENTINEL}/google`);
    expect(fillParams('/v1/places/:id')).toBe(placeDetailPath(SENTINEL));
    expect(fillParams('/v1/places/:id/google')).toBe(placeGooglePath(SENTINEL));
  });
});
