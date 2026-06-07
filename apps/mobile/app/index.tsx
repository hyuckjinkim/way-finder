/**
 * Home 라우트 — / (E3).
 *
 * C1 HomeScreen에 어댑터로 배선한다(화면 시그니처 불변, 어댑터는 라우트 파일).
 * - 카메라/선택 장소는 D4 Zustand 스토어(useAppStore)에 연결.
 * - 검색바 탭 → /search, 현재 위치 버튼 → LocationService(데모 모드는 서울 폴백).
 */
import React, { useCallback } from 'react';
import { useRouter } from 'expo-router';
import type { MapMarker } from '@wayfinder/shared';
import { HomeScreen } from '../src/screens/HomeScreen';
import { useAppStore } from '../src/state/store';
import { getCurrentCamera } from '../src/services/LocationService';

export default function HomeRoute() {
  const router = useRouter();
  const camera = useAppStore((s) => s.camera);
  const selectedPlaceId = useAppStore((s) => s.selectedPlaceId);
  const setCamera = useAppStore((s) => s.setCamera);

  // 선택된 장소가 있으면 마커 1개(좌표는 스토어 카메라 center로 근사 — 검색에서 카메라를 좌표로 이동).
  const markers: MapMarker[] | undefined = selectedPlaceId
    ? [{ id: selectedPlaceId, coord: camera.center }]
    : undefined;

  const onOpenSearch = useCallback(() => router.push('/search'), [router]);

  const onRequestLocation = useCallback(() => {
    void getCurrentCamera().then(setCamera);
  }, [setCamera]);

  return (
    <HomeScreen
      initialCamera={camera}
      markers={markers}
      onOpenSearch={onOpenSearch}
      onRequestLocation={onRequestLocation}
    />
  );
}
