/** 마지막으로 고른 이동수단 기억 — 웹 localStorage(없거나 막히면 조용히 무시). */
import type { TravelMode } from '@wayfinder/shared';
import { MODE_TAB_ORDER } from './modeTabs.js';

const KEY = 'wayfinder.lastMode';

export function loadLastMode(): TravelMode | undefined {
  try {
    const v = globalThis.localStorage?.getItem(KEY);
    return MODE_TAB_ORDER.find((m) => m === v);
  } catch {
    return undefined; // 사생활 보호 모드 등 — 기억 기능만 포기
  }
}

export function saveLastMode(mode: TravelMode): void {
  try {
    globalThis.localStorage?.setItem(KEY, mode);
  } catch {
    // 저장 불가 — 무시
  }
}
