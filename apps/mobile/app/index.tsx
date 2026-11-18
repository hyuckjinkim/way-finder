/**
 * Home 라우트 — / (E3).
 *
 * C1 HomeScreen에 어댑터로 배선(화면 시그니처 불변, 어댑터는 라우트 파일).
 * - 카메라·선택 장소·내 위치는 D4 Zustand 스토어(useAppStore)가 소유 — 스토어 카메라가 지도를 움직인다.
 * - 시작 시 위치 권한이 있으면 내 위치로 센터링 + 파란 점. 거부/실패면 토스트로 안내.
 * - 검색바 탭 → /search, 현재 위치 버튼 → LocationService.
 * - 장소 상세·검색·경로 입력은 이 화면 위에 패널로 뜬다(pathname으로 패널 종류 판별).
 */
import React, { useCallback, useEffect, useState } from 'react';
import { usePathname, useRouter } from 'expo-router';
import type { MapMarker } from '@wayfinder/shared';
import { HomeScreen } from '../src/screens/HomeScreen';
import { useAppStore } from '../src/state/store';
import { getUserLocation } from '../src/services/LocationService';
import { panelForPath } from '../src/components/sheetSnap';

const LOCATION_NOTICE = '위치 권한을 허용하면 내 주변부터 보여드려요';
const USER_ZOOM = 15;

export default function HomeRoute() {
  const router = useRouter();
  const pathname = usePathname();
  const camera = useAppStore((s) => s.camera);
  const selectedPlace = useAppStore((s) => s.selectedPlace);
  const focusSeq = useAppStore((s) => s.focusSeq);
  const userLocation = useAppStore((s) => s.userLocation);
  const setCamera = useAppStore((s) => s.setCamera);
  const setUserLocation = useAppStore((s) => s.setUserLocation);
  const [notice, setNotice] = useState<string | null>(null);

  const markers: MapMarker[] | undefined = selectedPlace
    ? [{ id: selectedPlace.id, coord: selectedPlace.coord, title: selectedPlace.name, kind: 'place', selected: true }]
    : undefined;

  /** 내 위치를 구해 파란 점을 찍고, shouldMove()가 참이면 카메라도 옮긴다(거부·실패는 토스트). */
  const locate = useCallback(
    async (shouldMove: () => boolean) => {
      const result = await getUserLocation();
      if (result.status !== 'ok') {
        setNotice(LOCATION_NOTICE);
        return;
      }
      setUserLocation(result.coord);
      if (shouldMove()) setCamera({ center: result.coord, zoom: USER_ZOOM });
    },
    [setCamera, setUserLocation],
  );

  // 시작 시 한 번 — 장소 링크로 들어왔으면(이미 선택 장소가 있으면) 카메라는 건드리지 않는다.
  useEffect(() => {
    void locate(() => !useAppStore.getState().selectedPlace);
  }, [locate]);

  const onOpenSearch = useCallback(() => router.push('/search'), [router]);
  const onRequestLocation = useCallback(() => void locate(() => true), [locate]);
  const onOpenRoute = useCallback(() => router.push('/route/input'), [router]);
  const onDismissNotice = useCallback(() => setNotice(null), []);

  return (
    <HomeScreen
      camera={camera}
      onCameraChange={setCamera}
      markers={markers}
      userLocation={userLocation ?? undefined}
      focus={selectedPlace?.coord}
      focusSeq={focusSeq}
      panel={panelForPath(pathname)}
      notice={notice}
      onDismissNotice={onDismissNotice}
      onOpenSearch={onOpenSearch}
      onRequestLocation={onRequestLocation}
      onOpenRoute={onOpenRoute}
    />
  );
}
