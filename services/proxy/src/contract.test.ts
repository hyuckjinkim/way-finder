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
import { describe, it, expect, expectTypeOf } from 'vitest';
import app from './index.js';
import {
  placesSearchPath,
  placeDetailPath,
  placeGooglePath,
  blogsPath,
  routesPath,
} from '@wayfinder/shared/api';
import {
  MIN_EXTRA_MINUTES,
  MAX_EXTRA_MINUTES,
  DEFAULT_EXTRA_MINUTES,
  PROFILE_COSTING,
} from '@wayfinder/shared';
import type {
  RouteRequest,
  RoutePreference,
  RouteCustomMeta,
  Route,
} from '@wayfinder/shared';

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

describe('contract — RouteRequest P4 확장 필드 (preference·maxExtraMinutes·customMeta)', () => {
  // P1 드리프트 패턴 계승(§3 F1.7): 확장 필드 누락을 "프로즈가 아니라 (타입·계약) 테스트
  // 실패"로 만든다. 아래 타입 단언은 RouteRequest/Route에서 해당 필드를 삭제하면
  // 컴파일 실패(red) → §100 "확장 필드 누락이 contract.test 실패로 잡힘 1회 실증".
  // 런타임 검증(범위·화이트리스트)은 OW2(routeValidate) 범위 — 여기선 와이어 계약만.

  it('RouteRequest가 preference·maxExtraMinutes를 선택 필드로 수용 (타입 계약)', () => {
    const req: RouteRequest = {
      stops: [
        { lat: 37.5, lng: 127.0 },
        { lat: 37.51, lng: 127.01 },
      ],
      mode: 'walk',
      preference: 'walkable',
      maxExtraMinutes: DEFAULT_EXTRA_MINUTES,
    };
    // 미지정도 유효해야 함(하위호환 — 기존 P2 호출자).
    const legacy: RouteRequest = { stops: req.stops, mode: 'car' };

    // 타입 계약: 필드가 존재하고 올바른 타입. 삭제 시 컴파일 red(드리프트 게이트).
    expectTypeOf<RouteRequest['preference']>().toEqualTypeOf<
      RoutePreference | undefined
    >();
    expectTypeOf<RouteRequest['maxExtraMinutes']>().toEqualTypeOf<
      number | undefined
    >();
    expectTypeOf<Route['customMeta']>().toEqualTypeOf<
      RouteCustomMeta | undefined
    >();

    // 와이어 직렬화 round-trip: POST body로 나갈 때 확장 필드가 보존됨.
    const body = JSON.parse(JSON.stringify(req)) as RouteRequest;
    expect(body.preference).toBe('walkable');
    expect(body.maxExtraMinutes).toBe(DEFAULT_EXTRA_MINUTES);
    expect(legacy.preference).toBeUndefined();
  });

  it('RoutePreference 유니온이 5종(fastest+4프로필)을 포함', () => {
    const all: RoutePreference[] = ['fastest', 'walkable', 'safe', 'quiet', 'scenic'];
    expect(all).toHaveLength(5);
  });

  it('PROFILE_COSTING은 walkable·safe·quiet만 매핑, scenic·fastest는 미지원(❌)', () => {
    // §3 F1.2: scenic은 RoutePreference에 존재하나 costing 매핑 항목 없음(그래프 보강 후속).
    expect(Object.keys(PROFILE_COSTING).sort()).toEqual(['quiet', 'safe', 'walkable']);
    expect(PROFILE_COSTING.scenic).toBeUndefined();
    expect(PROFILE_COSTING.fastest).toBeUndefined();
    // 검증된 §1 옵션값 동결(드리프트 방지).
    // 곱셈 비용 계수: <1.0=선호. 보행로 우선(walkway/sidewalk <1.0).
    expect(PROFILE_COSTING.walkable).toEqual({ walkway_factor: 0.5, sidewalk_factor: 0.5 });
    expect(PROFILE_COSTING.safe).toEqual({ use_lit: 1.0, alley_factor: 4.0, driveway_factor: 8.0 });
    expect(PROFILE_COSTING.quiet).toEqual({ walkway_factor: 0.7, use_living_streets: 1.0 });
  });

  it('+N분 슬라이더 범위 상수가 일관(min ≤ default ≤ max)', () => {
    expect(MIN_EXTRA_MINUTES).toBeLessThanOrEqual(DEFAULT_EXTRA_MINUTES);
    expect(DEFAULT_EXTRA_MINUTES).toBeLessThanOrEqual(MAX_EXTRA_MINUTES);
  });
});
