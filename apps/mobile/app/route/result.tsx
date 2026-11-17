/**
 * 경로 결과 라우트 — /route/result (E2 + P4 D1).
 *
 * D4 RouteResultScreen에 어댑터로 배선(화면 시그니처 불변, 어댑터는 라우트 파일).
 * D2 routeStore의 stops·mode·preference·maxExtraMinutes를 읽어 D 훅 useRouteQuery로
 * 경로를 탐색하고 결과 Route를 화면에 주입한다. 데모 모드에서는 mockRouteProvider 데이터가 흐른다.
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
  const preference = useRouteStore((s) => s.preference);
  const maxExtraMinutes = useRouteStore((s) => s.maxExtraMinutes);

  const { data, error } = useRouteQuery(stops, mode, preference, maxExtraMinutes);

  const onBack = React.useCallback(() => router.back(), [router]);
  // P3: 안내 시작 → /route/nav. navStore가 routeStore.result를 안내 경로로 읽는다.
  const onStartNav = React.useCallback(() => router.push('/route/nav'), [router]);

  return (
    <RouteResultScreen
      route={data ?? null}
      error={error}
      onBack={onBack}
      onStartNav={onStartNav}
    />
  );
}
