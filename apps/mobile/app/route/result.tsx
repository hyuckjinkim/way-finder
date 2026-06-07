/**
 * 경로 결과 라우트 — /route/result (E2).
 *
 * D4 RouteResultScreen에 어댑터로 배선(화면 시그니처 불변, 어댑터는 라우트 파일).
 * D2 routeStore의 stops·mode를 읽어 D 훅 useRouteQuery로 경로를 탐색하고
 * 결과 Route를 화면에 주입한다. 데모 모드에서는 mockRouteProvider 데이터가 흐른다.
 * QueryClientProvider는 app/_layout.tsx가 제공한다.
 */
import React from 'react';
import { useRouter } from 'expo-router';
import { RouteResultScreen } from '../../src/screens/RouteResultScreen';
import { useRouteStore } from '../../src/state/routeStore';
import { useRouteQuery } from '../../src/state/routeQueries';

export default function RouteResultRoute() {
  const router = useRouter();
  const stops = useRouteStore((s) => s.stops);
  const mode = useRouteStore((s) => s.mode);

  const { data } = useRouteQuery(stops, mode);

  const onBack = React.useCallback(() => router.back(), [router]);

  return <RouteResultScreen route={data ?? null} onBack={onBack} />;
}
