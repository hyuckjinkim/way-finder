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

export default function RootLayout() {
  return (
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
        </Stack>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
