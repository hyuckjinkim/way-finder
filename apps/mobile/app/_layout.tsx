/**
 * expo-router 루트 레이아웃 (E2).
 *
 * Stack 네비게이터로 Home / Search / PlaceDetail / Roadview 4개 라우트를 감싼다.
 * GestureHandlerRootView와 SafeAreaProvider는 네이티브 제스처·안전 영역의 필수 래퍼.
 */
import React from 'react';
import { Stack } from 'expo-router';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

// 데모/실 모드 공통 쿼리 클라이언트 (D4 훅 usePlaceDetailQuery 등이 사용).
const queryClient = new QueryClient();

export default function RootLayout() {
  return (
    <QueryClientProvider client={queryClient}>
      <GestureHandlerRootView style={{ flex: 1 }}>
        <SafeAreaProvider>
          <Stack>
          <Stack.Screen name="index" options={{ title: 'Wayfinder', headerShown: false }} />
          <Stack.Screen name="search" options={{ title: '검색', headerShown: true }} />
          <Stack.Screen
            name="place/[id]"
            options={{ title: '장소 상세', presentation: 'modal' }}
          />
          <Stack.Screen
            name="roadview/[id]"
            options={{ title: '로드뷰', headerShown: true }}
          />
          <Stack.Screen
            name="route/input"
            options={{ title: '경로 입력', headerShown: true }}
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
