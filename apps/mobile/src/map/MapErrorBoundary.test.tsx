/**
 * MapErrorBoundary 단위 테스트.
 *
 * React 에러 바운더리는 renderToStaticMarkup(SSR)에서 복구가 동작하지 않으므로(throw 버블),
 * 바운더리의 순수 로직을 메서드 직접 호출로 검증한다: getDerivedStateFromError가 failed를
 * 뒤집고, render가 상태에 따라 children/fallback을 고른다.
 */
import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import { MapErrorBoundary } from './MapErrorBoundary.js';

const CHILD = React.createElement('child');
const FALLBACK = React.createElement('fallback');

describe('MapErrorBoundary', () => {
  it('getDerivedStateFromError → failed:true', () => {
    expect(MapErrorBoundary.getDerivedStateFromError()).toEqual({ failed: true });
  });

  it('정상(초기) 상태 → children 렌더', () => {
    const b = new MapErrorBoundary({ fallback: FALLBACK, children: CHILD });
    expect(b.render()).toBe(CHILD);
  });

  it('실패 상태 → fallback 렌더', () => {
    const b = new MapErrorBoundary({ fallback: FALLBACK, children: CHILD });
    b.state = { failed: true };
    expect(b.render()).toBe(FALLBACK);
  });

  it('componentDidCatch → onFallback(error) 호출', () => {
    const onFallback = vi.fn();
    const err = new Error('kakao native render failed');
    const b = new MapErrorBoundary({
      fallback: FALLBACK,
      children: CHILD,
      onFallback,
    });
    b.componentDidCatch(err);
    expect(onFallback).toHaveBeenCalledWith(err);
  });
});
