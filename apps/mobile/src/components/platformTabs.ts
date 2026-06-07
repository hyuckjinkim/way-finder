/**
 * 플랫폼 탭 순수 로직 (C3·C4 — react-native 비의존).
 *
 * 탭 가시성(degradation)·구글 lazy load 트리거를 순수 함수로 분리해
 * node 환경에서 단위 검증한다(react-test-renderer 미설치 대체).
 * 컴포넌트(GoogleTab/NaverTab/KakaoTab, PlaceDetailSheet)는 이 로직을 소비한다.
 */
import type { PlaceDetail } from '@wayfinder/shared';

/** 플랫폼 탭 식별자. */
export type PlatformTabId = 'google' | 'naver' | 'kakao';

/** 탭 순서(좌→우). 구글이 기본 활성 탭이 아니어야 lazy 방어선이 성립한다(§11). */
export const TAB_ORDER: readonly PlatformTabId[] = ['naver', 'kakao', 'google'] as const;

/** 탭 표시 라벨. */
export const TAB_LABELS: Record<PlatformTabId, string> = {
  google: '구글',
  naver: '네이버',
  kakao: '카카오',
};

/**
 * 어떤 탭을 렌더할지 (graceful degradation).
 * 공급자 섹션이 비어 있어도 탭 자체는 노출한다 — 빈 상태 UI로 안내(§11).
 * 단, 데이터가 전혀 없는 글로벌 장소에서 블로그 탭을 숨기고 싶을 수 있으므로
 * "데이터가 있거나, 항상 노출되는 탭"만 가시 탭으로 본다.
 */
export function visibleTabs(detail: PlaceDetail): PlatformTabId[] {
  return TAB_ORDER.filter((tab) => {
    switch (tab) {
      case 'google':
        // 구글 탭은 lazy — 데이터 유무와 무관하게 항상 진입 가능(열 때 로드).
        return true;
      case 'naver':
        return detail.blogs.naver.length > 0;
      case 'kakao':
        return detail.blogs.kakao.length > 0;
    }
  });
}

/**
 * 기본 활성 탭. 가시 탭 중 **구글이 아닌** 첫 탭을 고른다.
 * 상세 진입 시 구글 데이터가 자동 로드되지 않도록(lazy 방어선) 구글을 기본값에서 제외한다.
 * 가시 탭이 구글뿐이면 어쩔 수 없이 구글(이때만 진입 즉시 로드).
 */
export function defaultActiveTab(detail: PlaceDetail): PlatformTabId {
  const tabs = visibleTabs(detail);
  const nonGoogle = tabs.find((tab) => tab !== 'google');
  return nonGoogle ?? 'google';
}

/** 구글 데이터 lazy 로드 상태. */
export type GoogleLoadState = 'idle' | 'loading' | 'loaded' | 'error';

/**
 * 구글 탭 활성화 시 "지금 구글 데이터를 fetch해야 하는가"를 판정 (lazy 방어선).
 * idle 상태에서 구글 탭이 활성화될 때만 true. 이미 로딩/로딩완료/에러면 재요청 안 함.
 *
 * @param activeTab 현재 활성 탭
 * @param state 현재 구글 로드 상태
 */
export function shouldLoadGoogle(
  activeTab: PlatformTabId,
  state: GoogleLoadState,
): boolean {
  return activeTab === 'google' && state === 'idle';
}
