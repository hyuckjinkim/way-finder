/**
 * 네비게이션 라우트 — /route/nav (P3 최종 통합).
 *
 * navStore에 실 연결한다(stub NavState 제거):
 *  - **데모 모드**: 안내 경로·표본을 **자기완결 DEMO_ROUTE/DEMO_NAV_SEQUENCE**로 구동한다
 *    (동일 geometry). routeStore.result는 사용자 가변 입력·transit이라 합성 시퀀스와
 *    불일치하므로 데모에 쓰지 않는다(advisor 지적). navReduce가 매 표본을 실제로 reduce →
 *    NavScreen이 **턴 카드(DEMO_ROUTE.steps)·남은 거리 감소·이탈 배너**를 표시(목 NavState 아님).
 *  - 실 모드: routeStore.result를 안내 경로로, expo LocationProvider(C2)를 주입(디바이스 GPS — §8 별도 QA).
 *
 * **데모 재탐색 범위(advisor):** REROUTE_DEBOUNCE_MS=5000ms 디바운스라 짧은 합성
 * 시퀀스로는 라우트 *swap*까지 데모되지 않는다 — 데모는 턴 진행·**이탈 배너**까지.
 * 전체 재탐색 사이클(엣지 트리거·in-flight·swap·실패)은 reroute.test.ts·navStore.test.ts가 증명.
 *
 * 웹은 NavScreen.web.tsx(.web 분기)가 비활성 안내를 렌더. expo-location은 웹 export
 * 안전(app/index.tsx의 LocationService가 이미 정적 import — Expo가 웹 shim 제공).
 */
import React from 'react';
import { useRouter } from 'expo-router';
import type { RouteRequest } from '@wayfinder/shared';
import { NavScreen } from '../../src/screens/NavScreen';
import { useRouteStore } from '../../src/state/routeStore';
import { useNavStore } from '../../src/state/navStore';
import { createSyntheticLocationProvider } from '../../src/nav/locationProvider.js';
import { createExpoLocationProvider } from '../../src/nav/locationProvider.expo.js';
import { createSyntheticVoiceGuide } from '../../src/nav/voiceGuide.js';
import { createVoiceGuide } from '../../src/nav/createVoiceGuide.js';
import { DEMO_NAV_SEQUENCE, DEMO_ROUTE } from '../../src/nav/fixtures/gpsSequences.js';
import { isDemoMode } from '../../src/services/apiClient.js';

/** 데모 합성 표본 cadence(ms) — 턴 진행이 눈에 보이도록 800ms. */
const DEMO_CADENCE_MS = 800;

export default function NavRoute() {
  const router = useRouter();
  const resultRoute = useRouteStore((s) => s.result);
  const mode = useRouteStore((s) => s.mode);
  const stops = useRouteStore((s) => s.stops);
  const preference = useRouteStore((s) => s.preference);
  const maxExtraMinutes = useRouteStore((s) => s.maxExtraMinutes);

  const startNav = useNavStore((s) => s.startNav);
  const stopNav = useNavStore((s) => s.stopNav);
  const setVoiceEnabled = useNavStore((s) => s.setVoiceEnabled);
  const navState = useNavStore((s) => s.navState);
  const sessionRoute = useNavStore((s) => s.activeRoute);

  // 데모는 자기완결 DEMO_ROUTE, 실 모드는 사용자 경로(result). 결과 컨텍스트가 있을 때만 시작.
  const guidanceRoute = isDemoMode ? DEMO_ROUTE : resultRoute;

  React.useEffect(() => {
    if (!resultRoute || !guidanceRoute) return;
    const baseRequest: RouteRequest = { stops, mode, preference, maxExtraMinutes };
    const provider = isDemoMode
      ? createSyntheticLocationProvider(DEMO_NAV_SEQUENCE, DEMO_CADENCE_MS)
      : createExpoLocationProvider();
    // 음성: 데모=합성 spy(부수효과 0), 실 모드=expo impl(createVoiceGuide — 네이티브
    // 팩토리, 웹은 .web 분기가 합성으로 격리해 expo-speech 웹 번들 미포함, P5 §6).
    const voiceGuide = isDemoMode ? createSyntheticVoiceGuide() : createVoiceGuide();
    // 데모: 재탐색도 DEMO_ROUTE로 해소(동일 geometry·steps). 미주입 시 기본 getRoute는
    // routeStore.mode(기본 transit)로 steps 없는 TRANSIT_CHAIN을 반환해 데모가 비정합
    // 경로로 점프한다(이탈 후 디바운스 경과 시 재탐색 발사 — 합성 시퀀스 종료와 무관).
    startNav({
      route: guidanceRoute,
      baseRequest,
      provider,
      getRoute: isDemoMode ? async () => DEMO_ROUTE : undefined,
      voiceGuide,
    });
    return () => stopNav();
  }, [resultRoute, guidanceRoute, stops, mode, preference, maxExtraMinutes, startNav, stopNav]);

  const onExit = React.useCallback(() => {
    stopNav();
    router.back();
  }, [router, stopNav]);

  return (
    <NavScreen
      route={sessionRoute ?? guidanceRoute}
      navState={navState ?? initialFallback}
      onExit={onExit}
      onToggleVoice={setVoiceEnabled}
    />
  );
}

/** navState 동기화 전 1프레임 폴백(세션 시작 직전). */
const initialFallback = {
  status: 'navigating' as const,
  activeLegIndex: 0,
  activeStepIndex: 0,
  distanceToNextTurnM: 0,
  distanceRemainingM: 0,
  durationRemainingSec: 0,
  nextStep: undefined,
};
