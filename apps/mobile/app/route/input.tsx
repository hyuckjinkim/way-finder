/**
 * 경로 입력 라우트 — /route/input (E2).
 *
 * C2 RouteInputScreen에 어댑터로 배선(화면 시그니처 불변, 어댑터는 라우트 파일).
 * onSubmit(RouteRequest) → D2 routeStore에 stops·mode 기록 후 /route/result로 이동.
 * provider는 화면 기본값(mockPlaceProvider)을 그대로 사용 — 데모 모드에서 mock 데이터가 흐른다.
 */
import React, { useCallback } from 'react';
import { useRouter } from 'expo-router';
import type { RouteRequest } from '@wayfinder/shared';
import { RouteInputScreen } from '../../src/screens/RouteInputScreen';
import { useRouteStore } from '../../src/state/routeStore';

export default function RouteInputRoute() {
  const router = useRouter();
  const setStops = useRouteStore((s) => s.setStops);
  const setMode = useRouteStore((s) => s.setMode);

  const onSubmit = useCallback(
    (req: RouteRequest) => {
      // 결과 화면은 stops·mode로 keyed된 useRouteQuery가 자동 재탐색한다.
      setStops(req.stops);
      setMode(req.mode);
      router.push('/route/result');
    },
    [router, setStops, setMode],
  );

  const onCancel = useCallback(() => router.back(), [router]);

  return <RouteInputScreen onSubmit={onSubmit} onCancel={onCancel} />;
}
