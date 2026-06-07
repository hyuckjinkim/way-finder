import { describe, it, expect, vi } from 'vitest';
import { SEOUL_CAFE, TOKYO_PLACE } from '@wayfinder/shared/mocks';
import type { PlaceDetail } from '@wayfinder/shared';
import {
  defaultActiveTab,
  shouldLoadGoogle,
  visibleTabs,
  TAB_ORDER,
} from './platformTabs.js';

/** 블로그가 둘 다 없는 글로벌 장소(도쿄) — degradation 검증용. */
const GLOBAL_NO_BLOGS: PlaceDetail = TOKYO_PLACE;

describe('visibleTabs — graceful degradation', () => {
  it('한국 장소(블로그 있음)는 네이버·카카오·구글 모두 노출', () => {
    expect(visibleTabs(SEOUL_CAFE)).toEqual(['naver', 'kakao', 'google']);
  });

  it('블로그가 없는 공급자 섹션은 탭에서 생략, 나머지(구글)는 정상', () => {
    const tabs = visibleTabs(GLOBAL_NO_BLOGS);
    expect(tabs).not.toContain('naver');
    expect(tabs).not.toContain('kakao');
    // 한 공급자 섹션 부재해도 구글 탭은 정상 노출 (degradation).
    expect(tabs).toContain('google');
  });

  it('네이버만 있는 장소는 네이버·구글만 노출(카카오 생략)', () => {
    const naverOnly: PlaceDetail = {
      ...SEOUL_CAFE,
      blogs: { naver: SEOUL_CAFE.blogs.naver, kakao: [] },
    };
    expect(visibleTabs(naverOnly)).toEqual(['naver', 'google']);
  });
});

describe('defaultActiveTab — lazy 방어선(구글 기본 활성 금지)', () => {
  it('가시 탭이 여럿이면 구글이 아닌 첫 탭을 기본 활성으로', () => {
    expect(defaultActiveTab(SEOUL_CAFE)).toBe('naver');
  });

  it('가시 탭이 구글뿐이면(블로그 전무) 구글이 기본', () => {
    expect(defaultActiveTab(GLOBAL_NO_BLOGS)).toBe('google');
  });

  it('TAB_ORDER에서 구글은 마지막(기본 활성에서 밀려남)', () => {
    expect(TAB_ORDER[TAB_ORDER.length - 1]).toBe('google');
  });
});

describe('shouldLoadGoogle — lazy 트리거 판정', () => {
  it('구글 탭이 활성이고 idle일 때만 로드', () => {
    expect(shouldLoadGoogle('google', 'idle')).toBe(true);
  });

  it('구글 탭이 아니면 어떤 상태에서도 로드 안 함', () => {
    expect(shouldLoadGoogle('naver', 'idle')).toBe(false);
    expect(shouldLoadGoogle('kakao', 'idle')).toBe(false);
  });

  it('이미 로딩/완료/에러면 재요청 안 함(중복 fetch 방지)', () => {
    expect(shouldLoadGoogle('google', 'loading')).toBe(false);
    expect(shouldLoadGoogle('google', 'loaded')).toBe(false);
    expect(shouldLoadGoogle('google', 'error')).toBe(false);
  });
});

/**
 * (a) lazy 부정 테스트 — 컨트롤러 레벨 시뮬레이션.
 *
 * PlaceDetailSheet가 구글 로더를 호출하는 유일한 경로는 shouldLoadGoogle 게이트다.
 * 상세 진입(기본 탭=네이버) → 카카오 탭 전환까지는 구글 로더가 호출되지 않고,
 * 구글 탭으로 전환될 때만 호출됨을 lazy 게이트로 검증한다(§11 과금 방어선).
 */
describe('lazy 부정 테스트 — 구글 fetch는 구글 탭 활성 시에만', () => {
  function simulateSheet(detail: PlaceDetail) {
    const loadGoogle = vi.fn(async () => ({
      rating: detail.rating,
      reviews: detail.reviews,
    }));
    let googleState: 'idle' | 'loading' | 'loaded' | 'error' = 'idle';

    // PlaceDetailSheet.requestGoogle 게이트 로직과 동일.
    function activate(tab: 'naver' | 'kakao' | 'google') {
      if (shouldLoadGoogle(tab, googleState)) {
        googleState = 'loading';
        void loadGoogle();
      }
    }

    return { loadGoogle, activate };
  }

  it('상세 진입(네이버 기본) + 카카오 전환에서는 구글 로더 미호출', () => {
    const { loadGoogle, activate } = simulateSheet(SEOUL_CAFE);
    // 기본 활성 탭 진입.
    activate(defaultActiveTab(SEOUL_CAFE)); // naver
    activate('kakao');
    expect(loadGoogle).not.toHaveBeenCalled();
  });

  it('구글 탭으로 전환할 때 비로소 구글 로더 1회 호출', () => {
    const { loadGoogle, activate } = simulateSheet(SEOUL_CAFE);
    activate('naver');
    activate('kakao');
    activate('google');
    expect(loadGoogle).toHaveBeenCalledTimes(1);
  });

  it('구글 탭을 떠났다 다시 와도 재요청 없음(1회만)', () => {
    const { loadGoogle, activate } = simulateSheet(SEOUL_CAFE);
    activate('google');
    activate('naver');
    activate('google');
    expect(loadGoogle).toHaveBeenCalledTimes(1);
  });
});
