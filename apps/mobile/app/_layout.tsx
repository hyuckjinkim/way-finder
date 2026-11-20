/**
 * expo-router 루트 레이아웃 (E2).
 *
 * Stack 네비게이터로 Home / Search / PlaceDetail / Roadview 4개 라우트를 감싼다(검색·장소 상세는 홈 위 패널).
 * GestureHandlerRootView와 SafeAreaProvider는 네이티브 제스처·안전 영역의 필수 래퍼.
 */
import React, { useEffect } from 'react';
import { Stack } from 'expo-router';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { installWebFocusStyle } from '../src/components/webFocus';

// 딥링크·새로고침으로 /search 등에 바로 들어와도 홈 지도가 아래에 깔리도록.
export const unstable_settings = { initialRouteName: 'index' };

// 검색·경로 입력·장소 상세는 지도를 가리지 않는 패널(OverlayPanel)로 — 아래 홈 지도가 계속 보인다.
const OVERLAY = { presentation: 'transparentModal', headerShown: false, animation: 'fade' } as const;

// 데모/실 모드 공통 쿼리 클라이언트 (D4 훅 usePlaceDetailQuery 등이 사용).
// 탭 복귀 재조회 끔 — 대중교통(ODsay 30콜/일)을 포커스마다 다시 쓰지 않도록. 재시도는 쿼리별 옵션에 둔다.
const queryClient = new QueryClient({ defaultOptions: { queries: { refetchOnWindowFocus: false } } });

export default function RootLayout() {
  // 웹 입력창 기본 포커스 outline(주황) 대신 브랜드 테두리 — 네이티브/SSR에선 no-op.
  useEffect(() => installWebFocusStyle(), []);
  return (
    <QueryClientProvider client={queryClient}>
      <GestureHandlerRootView style={{ flex: 1 }}>
        <SafeAreaProvider>
          <Stack>
          <Stack.Screen name="index" options={{ title: 'Wayfinder', headerShown: false }} />
          <Stack.Screen name="search" options={{ title: '검색', ...OVERLAY }} />
          <Stack.Screen name="place/[id]" options={{ title: '장소 상세', ...OVERLAY }} />
          <Stack.Screen
            name="roadview/[id]"
            options={{ title: '로드뷰', headerShown: true }}
          />
          <Stack.Screen
            name="route/input"
            options={{ title: '경로 입력', ...OVERLAY }}
          />
          <Stack.Screen
            name="route/result"
            options={{ title: '경로 결과', headerShown: true }}
          />
          <Stack.Screen
            name="route/nav"
            options={{ title: '네비게이션', headerShown: false }}
          />
          </Stack>
        </SafeAreaProvider>
      </GestureHandlerRootView>
    </QueryClientProvider>
  );
}
