/**
 * 웹 정적 렌더(SSR)·하이드레이션 중엔 false, 그 뒤(그리고 네이티브·클라이언트 이동)는 true.
 * React 문서의 useSyncExternalStore 관례 — 하이드레이션 때는 서버 스냅샷으로 맞춘 뒤 곧바로 다시 렌더한다.
 */
import { useSyncExternalStore } from 'react';

const subscribe = (): (() => void) => () => {};

export function useHydrated(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => true,
    () => false,
  );
}
