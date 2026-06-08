/**
 * D3 — NavScreen 흐름 테스트 (웹 비활성 안내 + 모바일 합성 NavScreen).
 *
 * vitest.config.mts extensions 우선순위: .web.tsx > .tsx
 * - WebNavScreen: './NavScreen.js' → .web.tsx (웹 비활성 안내)
 * - NativeNavScreen: './NavScreen.tsx' → .tsx (네이티브 턴바이턴 UI)
 *   allowImportingTsExtensions: true (mobile tsconfig — noEmit 전용 프로젝트에서 안전)
 *
 * react-native → react-native-web alias(vitest.config.mts) +
 * react-dom/server.renderToStaticMarkup 패턴 (RouteResultScreen.test.tsx 계승).
 * 의존성 추가 없음.
 */
import { describe, it, expect } from 'vitest';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import type { NavState, Route } from '@wayfinder/shared';
import { WALK_SIMPLE } from '@wayfinder/shared/mocks';

// 웹 분기: NavScreen.web.tsx 직접 명시 임포트
import { NavScreen as WebNavScreen } from './NavScreen.web.tsx';
// 네이티브 분기: NavScreen.tsx 직접 명시 임포트
// (allowImportingTsExtensions: true — tsconfig.json, noEmit 프로젝트에서 안전)
import { NavScreen as NativeNavScreen } from './NavScreen.tsx';

const render = (el: React.ReactElement): string => renderToStaticMarkup(el);

/** 기본 mock NavState — A/C 스트림 완료 전 stub. */
const MOCK_NAV_STATE: NavState = {
  status: 'navigating',
  activeLegIndex: 0,
  activeStepIndex: 0,
  distanceToNextTurnM: 150,
  distanceRemainingM: 1100,
  durationRemainingSec: 900,
  nextStep: undefined,
};

/** 다음 턴 step 포함 NavState. */
const NAV_STATE_WITH_STEP: NavState = {
  ...MOCK_NAV_STATE,
  nextStep: {
    location: { lat: 37.566899, lng: 126.979196 },
    instruction: '세종대로20길로 좌회전하세요',
    type: 15,
    distanceM: 250,
  },
  distanceToNextTurnM: 250,
};

/** off_route 상태 NavState. */
const NAV_STATE_OFF_ROUTE: NavState = {
  ...MOCK_NAV_STATE,
  status: 'off_route',
};

/** rerouting 상태 NavState. */
const NAV_STATE_REROUTING: NavState = {
  ...MOCK_NAV_STATE,
  status: 'rerouting',
};

/** arrived 상태 NavState. */
const NAV_STATE_ARRIVED: NavState = {
  ...MOCK_NAV_STATE,
  status: 'arrived',
  distanceRemainingM: 0,
  durationRemainingSec: 0,
};

// ─── 웹 데모 흐름: NavScreen.web.tsx ──────────────────────────────────────────

describe('D3 웹 비활성 안내 — NavScreen.web.tsx', () => {
  it('웹: "모바일 앱에서 이용하세요" 안내 포함', () => {
    const html = render(
      <WebNavScreen route={WALK_SIMPLE} navState={MOCK_NAV_STATE} onExit={() => {}} />,
    );
    expect(html).toContain('모바일 앱에서 이용하세요');
  });

  it('웹: 경로 표시 폴백(RouteResultScreen) 렌더 — 도보 15분 포함', () => {
    const html = render(
      <WebNavScreen route={WALK_SIMPLE} navState={MOCK_NAV_STATE} onExit={() => {}} />,
    );
    expect(html).toContain('15분');
  });

  it('웹: route=null도 throw 없이 렌더', () => {
    const html = render(
      <WebNavScreen route={null} navState={MOCK_NAV_STATE} onExit={() => {}} />,
    );
    expect(html.length).toBeGreaterThan(0);
    expect(html).toContain('모바일 앱에서 이용하세요');
  });

  it('웹: 턴 안내 카드를 렌더하지 않음 (웹 비활성)', () => {
    const html = render(
      <WebNavScreen route={WALK_SIMPLE} navState={NAV_STATE_WITH_STEP} onExit={() => {}} />,
    );
    // 웹 분기는 RouteResultScreen 폴백만 — 턴 안내 instruction 없어야 함
    expect(html).not.toContain('세종대로20길로 좌회전하세요');
  });
});

// ─── 모바일 합성 NavScreen: NavScreen.tsx 명시적 로드 ─────────────────────────

describe('D1 모바일 NavScreen.tsx — 턴 안내 카드·진행·이탈 표시', () => {
  it('모바일: 남은 시간·거리 렌더 (navigating 기본)', () => {
    const html = render(
      <NativeNavScreen route={WALK_SIMPLE} navState={MOCK_NAV_STATE} onExit={() => {}} />,
    );
    expect(html.length).toBeGreaterThan(0);
    // 900초 = 15분
    expect(html).toContain('15분');
    // 1100m → "1.1 km"
    expect(html).toContain('1.1 km');
  });

  it('모바일: nextStep 있으면 턴 안내 카드 포함', () => {
    const html = render(
      <NativeNavScreen route={WALK_SIMPLE} navState={NAV_STATE_WITH_STEP} onExit={() => {}} />,
    );
    expect(html).toContain('세종대로20길로 좌회전하세요');
    expect(html).toContain('250 m');
  });

  it('모바일: off_route 배너 표시', () => {
    const html = render(
      <NativeNavScreen route={WALK_SIMPLE} navState={NAV_STATE_OFF_ROUTE} onExit={() => {}} />,
    );
    expect(html).toContain('경로를 이탈했습니다');
  });

  it('모바일: rerouting 배너 표시', () => {
    const html = render(
      <NativeNavScreen route={WALK_SIMPLE} navState={NAV_STATE_REROUTING} onExit={() => {}} />,
    );
    expect(html).toContain('경로를 재탐색 중입니다');
  });

  it('모바일: arrived 배너 표시', () => {
    const html = render(
      <NativeNavScreen route={WALK_SIMPLE} navState={NAV_STATE_ARRIVED} onExit={() => {}} />,
    );
    expect(html).toContain('목적지에 도착했습니다');
  });

  it('모바일: route=null도 throw 없이 렌더', () => {
    const html = render(
      <NativeNavScreen route={null} navState={MOCK_NAV_STATE} onExit={() => {}} />,
    );
    expect(html.length).toBeGreaterThan(0);
  });

  it('모바일: 웹 비활성 안내 문구 없음 (모바일 분기 식별자)', () => {
    const html = render(
      <NativeNavScreen route={WALK_SIMPLE} navState={MOCK_NAV_STATE} onExit={() => {}} />,
    );
    // 이 단언이 실패하면 vitest가 .web.tsx를 로드한 것 — 파일 해석 오류 검출
    expect(html).not.toContain('모바일 앱에서 이용하세요');
  });

  it('모바일: 뒤로 가기(네비 종료) 버튼 포함', () => {
    const html = render(
      <NativeNavScreen route={WALK_SIMPLE} navState={MOCK_NAV_STATE} onExit={() => {}} />,
    );
    expect(html).toContain('←');
  });
});

// ─── _layout.tsx + nav.tsx 라우트 배선 확인 ─────────────────────────────────

describe('D3 라우트 배선 — nav.tsx stub', () => {
  it('nav 라우트가 NavScreen을 렌더 (route=null stub 동작)', () => {
    // nav.tsx는 expo-router useRouter를 사용해 라우트 컨텍스트가 필요하므로
    // 화면 컴포넌트 레벨에서 직접 검증한다 (routeRenderE2.test.tsx 패턴 동일).
    const route: Route | null = null;
    const html = render(
      <NativeNavScreen route={route} navState={MOCK_NAV_STATE} onExit={() => {}} />,
    );
    expect(html.length).toBeGreaterThan(0);
  });
});

// ─── U1: 음성 토글 + 교통 표시 (P5 U1) ─────────────────────────────────────

/** traffic 메타 포함 Route 픽스처 (인라인 — 공유 mock 미수정) */
const ROUTE_WITH_TRAFFIC: Route = {
  legs: [
    {
      start: { lat: 37.5665, lng: 126.978 },
      end: { lat: 37.567, lng: 126.979 },
      mode: 'car',
      durationSec: 600,
      distanceM: 2000,
      coords: [
        { lat: 37.5665, lng: 126.978 },
        { lat: 37.567, lng: 126.979 },
      ],
      traffic: { congestion: 'jam', delaySec: 120 },
    },
  ],
  totalDurationSec: 600,
  totalDistanceM: 2000,
};

const ROUTE_WITH_SLOW_TRAFFIC: Route = {
  legs: [
    {
      start: { lat: 37.5665, lng: 126.978 },
      end: { lat: 37.567, lng: 126.979 },
      mode: 'car',
      durationSec: 600,
      distanceM: 2000,
      coords: [
        { lat: 37.5665, lng: 126.978 },
        { lat: 37.567, lng: 126.979 },
      ],
      traffic: { congestion: 'slow' },
    },
  ],
  totalDurationSec: 600,
  totalDistanceM: 2000,
};

const ROUTE_WITH_FREE_TRAFFIC: Route = {
  legs: [
    {
      start: { lat: 37.5665, lng: 126.978 },
      end: { lat: 37.567, lng: 126.979 },
      mode: 'car',
      durationSec: 600,
      distanceM: 2000,
      coords: [
        { lat: 37.5665, lng: 126.978 },
        { lat: 37.567, lng: 126.979 },
      ],
      traffic: { congestion: 'free' },
    },
  ],
  totalDurationSec: 600,
  totalDistanceM: 2000,
};

describe('U1 음성 토글 — NavScreen.tsx (P5)', () => {
  it('defaultVoiceEnabled=false(기본): 음성 안내 켜기 레이블 포함', () => {
    const html = render(
      <NativeNavScreen route={WALK_SIMPLE} navState={MOCK_NAV_STATE} />,
    );
    expect(html).toContain('음성 안내 켜기');
  });

  it('defaultVoiceEnabled=true: 음성 안내 끄기 레이블 포함', () => {
    const html = render(
      <NativeNavScreen
        route={WALK_SIMPLE}
        navState={MOCK_NAV_STATE}
        defaultVoiceEnabled={true}
      />,
    );
    expect(html).toContain('음성 안내 끄기');
  });

  it('음성 on 상태에서 off 상태와 레이블이 다름 (toggle 상태 구분)', () => {
    const htmlOn = render(
      <NativeNavScreen route={WALK_SIMPLE} navState={MOCK_NAV_STATE} defaultVoiceEnabled={true} />,
    );
    const htmlOff = render(
      <NativeNavScreen route={WALK_SIMPLE} navState={MOCK_NAV_STATE} defaultVoiceEnabled={false} />,
    );
    expect(htmlOn).not.toEqual(htmlOff);
  });

  it('음성 토글 버튼이 있어도 기존 뒤로 가기(←) 버튼 불변', () => {
    const html = render(
      <NativeNavScreen route={WALK_SIMPLE} navState={MOCK_NAV_STATE} />,
    );
    expect(html).toContain('←');
  });

  it('웹 분기는 음성 토글 관련 레이블 없음 (웹 격리 확인)', () => {
    const html = render(
      <WebNavScreen route={WALK_SIMPLE} navState={MOCK_NAV_STATE} />,
    );
    expect(html).not.toContain('음성 안내 켜기');
    expect(html).not.toContain('음성 안내 끄기');
  });
});

// ─── U2: 자동차 경로 데모 흐름 (P5 §4 U2 작업 2) ─────────────────────────────
//
// 자동차 경로(maneuvers steps + traffic) → NavScreen이 car 턴 카드(raw instruction)·
// 교통 배지·음성 토글을 함께 렌더. 턴 카드는 navInstructionText가 아니라 raw
// instruction을 표시한다(plan §0 — VoiceGuide가 navInstructionText의 유일 소비자).

/** 자동차 maneuvers steps + 교통 정체 메타 — 데모 흐름 렌더 입력. */
const CAR_ROUTE_WITH_STEPS: Route = {
  legs: [
    {
      start: { lat: 37.5563, lng: 126.9723 },
      end: { lat: 37.5665, lng: 126.978 },
      mode: 'car',
      durationSec: 600,
      distanceM: 2400,
      coords: [
        { lat: 37.5563, lng: 126.9723 },
        { lat: 37.5665, lng: 126.978 },
      ],
      steps: [
        {
          location: { lat: 37.56, lng: 126.975 },
          instruction: '강남대로로 우회전하세요',
          maneuver: 'turn-right',
          distanceM: 800,
        },
      ],
      traffic: { congestion: 'jam', delaySec: 180 },
    },
  ],
  totalDurationSec: 600,
  totalDistanceM: 2400,
};

/** 자동차 첫 턴(우회전)을 다음 턴으로 가진 NavState. */
const CAR_NAV_STATE: NavState = {
  status: 'navigating',
  activeLegIndex: 0,
  activeStepIndex: 0,
  distanceToNextTurnM: 800,
  distanceRemainingM: 2400,
  durationRemainingSec: 600,
  nextStep: CAR_ROUTE_WITH_STEPS.legs[0]!.steps![0]!,
};

describe('U2 자동차 경로 데모 흐름 — NavScreen.tsx (P5)', () => {
  it('자동차 경로: 턴 카드에 raw maneuver instruction 렌더(차량 어휘)', () => {
    const html = render(
      <NativeNavScreen route={CAR_ROUTE_WITH_STEPS} navState={CAR_NAV_STATE} />,
    );
    expect(html).toContain('강남대로로 우회전하세요');
    expect(html).toContain('800 m');
  });

  it('자동차 경로: 교통 배지(정체)와 턴 카드가 함께 표시', () => {
    const html = render(
      <NativeNavScreen route={CAR_ROUTE_WITH_STEPS} navState={CAR_NAV_STATE} />,
    );
    expect(html).toContain('교통 정체');
    expect(html).toContain('강남대로로 우회전하세요');
  });

  it('자동차 경로: 음성 토글 버튼이 함께 동작(기본 off — 켜기 레이블)', () => {
    const html = render(
      <NativeNavScreen route={CAR_ROUTE_WITH_STEPS} navState={CAR_NAV_STATE} />,
    );
    expect(html).toContain('음성 안내 켜기');
  });

  it('웹 분기: 자동차 경로도 비활성 안내 + 턴 카드/배지 없음(웹 격리)', () => {
    const html = render(
      <WebNavScreen route={CAR_ROUTE_WITH_STEPS} navState={CAR_NAV_STATE} />,
    );
    expect(html).toContain('모바일 앱에서 이용하세요');
    expect(html).not.toContain('강남대로로 우회전하세요');
    expect(html).not.toContain('교통 정체');
  });
});

describe('U1 교통 표시 — NavScreen.tsx (P5)', () => {
  it('traffic.congestion=jam → "교통 정체" 배지 포함', () => {
    const html = render(
      <NativeNavScreen route={ROUTE_WITH_TRAFFIC} navState={MOCK_NAV_STATE} />,
    );
    expect(html).toContain('교통 정체');
  });

  it('traffic.congestion=slow → "교통 서행" 배지 포함', () => {
    const html = render(
      <NativeNavScreen route={ROUTE_WITH_SLOW_TRAFFIC} navState={MOCK_NAV_STATE} />,
    );
    expect(html).toContain('교통 서행');
  });

  it('traffic.congestion=free → "교통 원활" 배지 포함', () => {
    const html = render(
      <NativeNavScreen route={ROUTE_WITH_FREE_TRAFFIC} navState={MOCK_NAV_STATE} />,
    );
    expect(html).toContain('교통 원활');
  });

  it('traffic 없는 경로(WALK_SIMPLE) → 교통 배지 없음', () => {
    const html = render(
      <NativeNavScreen route={WALK_SIMPLE} navState={MOCK_NAV_STATE} />,
    );
    expect(html).not.toContain('교통 원활');
    expect(html).not.toContain('교통 서행');
    expect(html).not.toContain('교통 정체');
  });

  it('route=null → 교통 배지 없음 (throw 없이)', () => {
    const html = render(
      <NativeNavScreen route={null} navState={MOCK_NAV_STATE} />,
    );
    expect(html).not.toContain('교통');
    expect(html.length).toBeGreaterThan(0);
  });

  it('교통 배지 있어도 기존 진행 패널(남은 시간·거리) 불변', () => {
    const html = render(
      <NativeNavScreen route={ROUTE_WITH_TRAFFIC} navState={MOCK_NAV_STATE} />,
    );
    // MOCK_NAV_STATE.durationRemainingSec=900 → 15분 (navState가 표시 시간 소유)
    expect(html).toContain('15분');
    expect(html).toContain('교통 정체');
  });

  it('웹 분기는 교통 배지 렌더 안 함 (웹 격리 확인)', () => {
    const html = render(
      <WebNavScreen route={ROUTE_WITH_TRAFFIC} navState={MOCK_NAV_STATE} />,
    );
    expect(html).not.toContain('교통 정체');
  });
});
