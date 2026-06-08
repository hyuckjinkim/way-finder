/**
 * 경로 입력 라우트 — /route/input (E2 + P4 D1).
 *
 * C2 RouteInputScreen에 어댑터로 배선(화면 시그니처 불변, 어댑터는 라우트 파일).
 * onSubmit(RouteRequest) → D2 routeStore에 stops·mode·preference·maxExtraMinutes 기록 후 /route/result로 이동.
 * provider는 화면 기본값(mockPlaceProvider)을 그대로 사용 — 데모 모드에서 mock 데이터가 흐른다.
 *
 * P4 D1: RouteOptionsBar 슬롯 배선. B 스트림 완료 전 placeholder stub 사용.
 */
import React, { useCallback } from 'react';
import { useRouter } from 'expo-router';
import type { RoutePreference, RouteRequest } from '@wayfinder/shared';
import { RouteInputScreen } from '../../src/screens/RouteInputScreen';
import { useRouteStore } from '../../src/state/routeStore';
import { RouteOptionsBar } from '../../src/route/RouteOptionsBar';

export default function RouteInputRoute() {
  const router = useRouter();
  const setStops = useRouteStore((s) => s.setStops);
  const setMode = useRouteStore((s) => s.setMode);
  const preference = useRouteStore((s) => s.preference);
  const maxExtraMinutes = useRouteStore((s) => s.maxExtraMinutes);
  const setPreference = useRouteStore((s) => s.setPreference);
  const setMaxExtraMinutes = useRouteStore((s) => s.setMaxExtraMinutes);

  const onSubmit = useCallback(
    (req: RouteRequest) => {
      // 결과 화면은 stops·mode·preference·maxExtraMinutes로 keyed된 useRouteQuery가 자동 재탐색한다.
      setStops(req.stops);
      setMode(req.mode);
      router.push('/route/result');
    },
    [router, setStops, setMode],
  );

  const onCancel = useCallback(() => router.back(), [router]);

  const onPreferenceChange = useCallback(
    (pref: RoutePreference | undefined) => setPreference(pref),
    [setPreference],
  );

  const onMaxExtraMinutesChange = useCallback(
    (minutes: number | undefined) => setMaxExtraMinutes(minutes),
    [setMaxExtraMinutes],
  );

  return (
    <>
      {/* 경로 옵션 슬롯 — B3 구현 전 stub(null 렌더). 배선 계약 선행 정착. */}
      <RouteOptionsBar
        preference={preference}
        maxExtraMinutes={maxExtraMinutes}
        onPreferenceChange={onPreferenceChange}
        onMaxExtraMinutesChange={onMaxExtraMinutesChange}
      />
      <RouteInputScreen onSubmit={onSubmit} onCancel={onCancel} />
    </>
  );
}
