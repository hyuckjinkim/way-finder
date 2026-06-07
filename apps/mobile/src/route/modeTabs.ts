/**
 * C3 — 이동 수단 탭 순수 로직 (react-native 비의존).
 *
 * platformTabs.ts 패턴을 그대로 따른다:
 * 순수 함수/상수를 이 .ts 모듈에서 테스트하고,
 * 컴포넌트(ModeTabs.tsx)는 이 로직을 소비만 한다.
 */
import type { TravelMode } from '@wayfinder/shared';

/** 모드 탭 식별자 (TravelMode와 동일). */
export type ModeTabId = TravelMode;

/** 탭 순서 (좌→우). */
export const MODE_TAB_ORDER: readonly ModeTabId[] = [
  'walk',
  'transit',
  'car',
  'bike',
] as const;

/** 탭 표시 라벨. */
export const MODE_TAB_LABELS: Record<ModeTabId, string> = {
  walk: '도보',
  transit: '대중교통',
  car: '자동차',
  bike: '자전거',
};

/**
 * 탭 ID를 RouteRequest.mode로 매핑한다.
 * 현재 TravelMode === ModeTabId이므로 identity이지만,
 * 두 타입의 결합을 명시적으로 단언하는 함수로 노출한다.
 */
export function tabToMode(tab: ModeTabId): TravelMode {
  return tab;
}

/** 기본 활성 탭. */
export const DEFAULT_MODE_TAB: ModeTabId = 'transit';
