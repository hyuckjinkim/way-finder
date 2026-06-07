/**
 * Wayfinder 앱 루트 (E1 부트스트랩).
 *
 * E1의 산출은 stub MapView를 렌더하는 최소 앱이다. 네비게이션 셸(expo-router)은
 * E2에서 배선한다 — 현재는 classic entry(index.js)로 이 컴포넌트를 직접 마운트한다.
 *
 * MapView는 F5 stub 고정 경로(`./src/map/MapView`)만 import한다. Metro가 웹에서
 * `MapView.web.tsx`, 네이티브에서 `MapView.tsx`를 자동 선택한다.
 */
import React, { useRef } from 'react';
import { SafeAreaView, StyleSheet } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import type { CameraState, MapViewRef } from '@wayfinder/shared';
import MapView from './src/map/MapView';

// 초기 카메라: 서울 시청 근처 (데모 모드 기본 뷰).
const INITIAL_CAMERA: CameraState = {
  center: { lat: 37.5665, lng: 126.978 },
  zoom: 11,
};

export default function App() {
  const mapRef = useRef<MapViewRef>(null);

  return (
    <SafeAreaView style={styles.root}>
      <StatusBar style="auto" />
      <MapView ref={mapRef} camera={INITIAL_CAMERA} showUserLocation />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
});
