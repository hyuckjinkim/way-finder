/**
 * E2 라우트 레벨 렌더 테스트 — 경로 입력·결과 화면이 데모 mock 데이터로 마운트되는지.
 *
 * routeRender.test.tsx 패턴 그대로(react-native → react-native-web alias +
 * react-dom/server.renderToStaticMarkup): app/route/input.tsx·result.tsx 어댑터가
 * 주입하는 것과 동일한 props로 RouteInputScreen·RouteResultScreen을 직접 마운트해
 * RN 컴포넌트 트리가 throw 없이 DOM 문자열을 렌더하는지 검증한다.
 *
 * 정적 web export(별도 게이트)와 함께 §E2 데모 모드 경로 흐름을 이중으로 보장한다.
 * 의존성 추가 없음: react-dom·react-native-web은 이미 mobile 의존성.
 */
import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import {
  WALK_SIMPLE,
  CAR_WAYPOINT,
  TRANSIT_CHAIN,
  INTERCITY_STITCH,
} from '@wayfinder/shared/mocks';
import { RouteInputScreen } from './RouteInputScreen.js';
import { RouteResultScreen } from './RouteResultScreen.js';

// OverlayPanel은 마운트 후에만 그린다(SSR 하이드레이션) — 정적 렌더 테스트에선 내용만 통과시킨다.
vi.mock('../components/OverlayPanel', async (orig) => ({
  ...(await orig<typeof import('../components/OverlayPanel')>()),
  OverlayPanel: ({ children }: { children: React.ReactNode }) => children,
}));

const render = (el: React.ReactElement): string => renderToStaticMarkup(el);

describe('E2 라우트 레벨 렌더 — 경로 입력 (데모 모드)', () => {
  it('경로 입력 화면: 출발·도착·경유지 추가·모드 탭이 throw 없이 렌더된다', () => {
    // app/route/input.tsx 어댑터가 주입하는 props(provider는 화면 기본 mock).
    const html = render(<RouteInputScreen onSubmit={() => {}} onCancel={() => {}} />);
    expect(html.length).toBeGreaterThan(0);
    // 모드 탭 4종 라벨 + 정지점 placeholder.
    expect(html).toContain('도보');
    expect(html).toContain('대중교통');
    expect(html).toContain('자동차');
    expect(html).toContain('자전거');
    expect(html).toContain('출발지');
    expect(html).toContain('도착지');
    expect(html).toContain('경유지 추가');
    expect(html).toContain('경로 탐색');
  });
});

describe('E2 라우트 레벨 렌더 — 경로 결과 (데모 모드)', () => {
  it('도보 결과: 폴리라인 + 요약 패널이 렌더된다', () => {
    const html = render(<RouteResultScreen route={WALK_SIMPLE} onBack={() => {}} />);
    expect(html.length).toBeGreaterThan(0);
    expect(html).toContain('15분');
  });

  it('자동차 경유지 결과: throw 없이 렌더된다', () => {
    const html = render(<RouteResultScreen route={CAR_WAYPOINT} onBack={() => {}} />);
    expect(html.length).toBeGreaterThan(0);
  });

  it('대중교통 leg-chaining 결과: 노선명·환승 요약 렌더', () => {
    const html = render(<RouteResultScreen route={TRANSIT_CHAIN} onBack={() => {}} />);
    expect(html).toContain('4호선');
    expect(html).toContain('환승');
  });

  it('시외 3단 스티칭 결과: KTX 노선명 요약 렌더', () => {
    const html = render(<RouteResultScreen route={INTERCITY_STITCH} onBack={() => {}} />);
    expect(html).toContain('KTX');
  });

  it('결과 없음(null): 로딩 상태 렌더', () => {
    const html = render(<RouteResultScreen route={null} onBack={() => {}} />);
    expect(html).toContain('탐색 중');
  });
});

describe('B1 — 이동수단 탭 선택 상태(웹 aria-selected)', () => {
  it('선택된 탭만 aria-selected="true"', async () => {
    const { ModeTabs } = await import('../route/ModeTabsBar.js');
    const html = render(<ModeTabs active="walk" onChange={() => {}} modes={['transit', 'walk']} />);
    expect(html.match(/aria-selected="true"/g)).toHaveLength(1);
    expect(html).toMatch(/aria-selected="true"[^>]*>|도보/);
  });
});
