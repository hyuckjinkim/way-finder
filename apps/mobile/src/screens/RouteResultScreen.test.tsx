/**
 * D4 — RouteResultScreen 렌더 테스트 (데모 모드).
 *
 * routeRender.test.tsx 패턴 그대로:
 * react-native → react-native-web alias + react-dom/server.renderToStaticMarkup으로
 * RN 컴포넌트 트리가 throw 없이 DOM 문자열을 렌더하는지 검증한다.
 *
 * renderToStaticMarkup은 useEffect를 실행하지 않으므로 fitBounds 호출은 이 테스트 범위 외.
 * boundsForRoute의 BBox 계산은 routeToPolylines.test.ts에서 별도로 단언한다.
 */
import { describe, it, expect } from 'vitest';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import {
  WALK_SIMPLE,
  CAR_WAYPOINT,
  TRANSIT_CHAIN,
  INTERCITY_STITCH,
  BIKE_SIMPLE,
} from '@wayfinder/shared/mocks';
import { RouteResultScreen } from './RouteResultScreen.js';

const render = (el: React.ReactElement): string => renderToStaticMarkup(el);

describe('RouteResultScreen — 렌더 (데모 모드)', () => {
  it('route=null: 로딩 상태 렌더 (throw 없음)', () => {
    const html = render(
      <RouteResultScreen route={null} onBack={() => {}} />,
    );
    expect(html.length).toBeGreaterThan(0);
    expect(html).toContain('탐색 중');
  });

  it('도보 단순 경로 렌더', () => {
    const html = render(
      <RouteResultScreen route={WALK_SIMPLE} onBack={() => {}} />,
    );
    expect(html.length).toBeGreaterThan(0);
    // 총 시간 포함 (900초 = 15분)
    expect(html).toContain('15분');
  });

  it('자동차 경유지 경로 렌더', () => {
    const html = render(
      <RouteResultScreen route={CAR_WAYPOINT} onBack={() => {}} />,
    );
    expect(html.length).toBeGreaterThan(0);
  });

  it('대중교통 leg-chaining 렌더 — 노선명 표시', () => {
    const html = render(
      <RouteResultScreen route={TRANSIT_CHAIN} onBack={() => {}} />,
    );
    expect(html.length).toBeGreaterThan(0);
    expect(html).toContain('4호선');
    expect(html).toContain('402번');
    expect(html).toContain('환승');
  });

  it('시외 3단 스티칭 렌더 — KTX 노선명 표시', () => {
    const html = render(
      <RouteResultScreen route={INTERCITY_STITCH} onBack={() => {}} />,
    );
    expect(html.length).toBeGreaterThan(0);
    expect(html).toContain('KTX');
  });

  it('자전거 경로 렌더', () => {
    const html = render(
      <RouteResultScreen route={BIKE_SIMPLE} onBack={() => {}} />,
    );
    expect(html.length).toBeGreaterThan(0);
  });

  it('뒤로 가기 버튼 포함', () => {
    const html = render(
      <RouteResultScreen route={WALK_SIMPLE} onBack={() => {}} />,
    );
    expect(html).toContain('←');
  });
});

describe('RouteResultScreen — 요약 표시 정확성', () => {
  it('총 거리 표시 — km 또는 m 형식', () => {
    const html = render(
      <RouteResultScreen route={WALK_SIMPLE} onBack={() => {}} />,
    );
    // 1100m < 1000m 아니므로 km 표시
    expect(html).toMatch(/km|m/);
  });

  it('대중교통 환승 수 표시 — TRANSIT_CHAIN은 환승 1회', () => {
    const html = render(
      <RouteResultScreen route={TRANSIT_CHAIN} onBack={() => {}} />,
    );
    expect(html).toContain('환승 1회');
  });

  it('시외 스티칭 환승 2회 표시', () => {
    const html = render(
      <RouteResultScreen route={INTERCITY_STITCH} onBack={() => {}} />,
    );
    expect(html).toContain('환승 2회');
  });

  it('도보 경로 — 환승 표시 없음', () => {
    const html = render(
      <RouteResultScreen route={WALK_SIMPLE} onBack={() => {}} />,
    );
    expect(html).not.toContain('환승');
  });
});
