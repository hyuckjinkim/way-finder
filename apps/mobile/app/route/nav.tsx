/**
 * 네비게이션 라우트 — /route/nav (D3 P3).
 *
 * NavScreen에 어댑터로 배선. routeStore에서 경로를 읽어 NavScreen에 주입한다.
 * navState는 A·C 스트림 완료 전 정적 mock stub — A/C 도착 시 실 navStore로 교체.
 *
 * expo-location 및 nav 서비스를 import하지 않는다 — 웹 export 안전.
 * expo-keep-awake 미도입 (디바이스 런타임 §8 deferred).
 */
import React from 'react';
import { useRouter } from 'expo-router';
import type { NavState } from '@wayfinder/shared';
import { NavScreen } from '../../src/screens/NavScreen';
import { useRouteStore } from '../../src/state/routeStore';

/** A/C 스트림 완료 전 정적 mock NavState stub. */
const MOCK_NAV_STATE: NavState = {
  status: 'navigating',
  activeLegIndex: 0,
  activeStepIndex: 0,
  distanceToNextTurnM: 150,
  distanceRemainingM: 1100,
  durationRemainingSec: 900,
  nextStep: undefined,
};

export default function NavRoute() {
  const router = useRouter();
  const activeRoute = useRouteStore((s) => s.result);

  const onExit = React.useCallback(() => router.back(), [router]);

  return (
    <NavScreen
      route={activeRoute}
      navState={MOCK_NAV_STATE}
      onExit={onExit}
    />
  );
}
