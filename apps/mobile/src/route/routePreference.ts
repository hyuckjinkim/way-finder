/**
 * B1 — 경로 선호 프로필 탭 순수 로직 (react-native 비의존).
 *
 * modeTabs.ts 패턴을 그대로 따른다:
 * 순수 함수/상수를 이 .ts 모듈에서 테스트하고,
 * 컴포넌트(RouteOptionsBar.tsx)는 이 로직을 소비만 한다.
 *
 * ENABLE_SCENIC: 풍경 프로필은 Valhalla costing 미지원(❌) — 그래프 보강 후속 단계.
 * false(기본) 상태에서는 탭 목록에서 제외된다.
 */
import type { RoutePreference } from '@wayfinder/shared';

/** 풍경(scenic) 기능 플래그 — 기본 off. 그래프 보강 완료 후 true로 활성화. */
export const ENABLE_SCENIC = false;

/** 프로필 탭 식별자 (RoutePreference와 동일). */
export type PreferenceTabId = RoutePreference;

/** 탭 표시 라벨. */
export const PREFERENCE_TAB_LABELS: Record<PreferenceTabId, string> = {
  fastest: '빠른',
  walkable: '걷기좋은',
  safe: '안전',
  quiet: '한적',
  scenic: '풍경',
};

/**
 * 탭 렌더 순서 (좌→우).
 * ENABLE_SCENIC=false 상태에서 'scenic'은 포함되지 않는다.
 * 매핑 totality(tabToPreference)는 scenic 포함 전체 RoutePreference를 커버한다.
 */
export const PREFERENCE_TAB_ORDER: readonly PreferenceTabId[] = ENABLE_SCENIC
  ? (['fastest', 'walkable', 'safe', 'quiet', 'scenic'] as const)
  : (['fastest', 'walkable', 'safe', 'quiet'] as const);

/**
 * 탭 ID를 RouteRequest.preference로 매핑한다.
 * RoutePreference === PreferenceTabId이므로 identity이지만,
 * 두 타입의 결합을 명시적으로 단언하는 함수로 노출한다.
 */
export function tabToPreference(tab: PreferenceTabId): RoutePreference {
  return tab;
}

/** 기본 활성 탭. */
export const DEFAULT_PREFERENCE_TAB: PreferenceTabId = 'fastest';
