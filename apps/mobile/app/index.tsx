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
import { useLocalSearchParams, useNavigation, usePathname, useRouter } from 'expo-router';
import type { MapMarker } from '@wayfinder/shared';
import { HomeScreen } from '../src/screens/HomeScreen';
import { useAppStore } from '../src/state/store';
import { getUserLocation } from '../src/services/LocationService';
import { isOverlayPath, panelForPath } from '../src/components/sheetSnap';

const LOCATION_NOTICE = '위치 권한을 허용하면 내 주변부터 보여드려요';
// '내 위치'를 직접 눌렀을 때 — 무엇을 하면 되는지까지.
const LOCATION_DENIED_HELP = '위치 권한이 꺼져 있어요. 주소창 왼쪽 사이트 설정(자물쇠)에서 위치를 허용한 뒤 다시 눌러 주세요.';
const LOCATION_ERROR = '현재 위치를 찾지 못했어요. 잠시 후 다시 시도해 주세요.';
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
  const [notice, setNotice] = useState<{ text: string; id: number } | null>(null);
  const showNotice = useCallback((text: string) => setNotice((n) => ({ text, id: (n?.id ?? 0) + 1 })), []);

  // 딥링크(/place/x?name=…)로 들어오면 expo-router가 아래에 깐 홈에도 같은 params를 복사한다 —
  // 패널을 닫으면 URL이 /?id=…로 남는다. 홈 자신의 params는 늘 비워 둔다.
  const navigation = useNavigation();
  const homeParams = useLocalSearchParams();
  const strayKeys = Object.keys(homeParams).filter((k) => homeParams[k] !== undefined);
  useEffect(() => {
    if (strayKeys.length > 0) navigation.setParams(Object.fromEntries(strayKeys.map((k) => [k, undefined])) as never);
  }, [strayKeys.join('|'), navigation]); // eslint-disable-line react-hooks/exhaustive-deps

  const markers: MapMarker[] | undefined = selectedPlace
    ? [{ id: selectedPlace.id, coord: selectedPlace.coord, title: selectedPlace.name, kind: 'place', selected: true }]
    : undefined;

  /** 내 위치를 구해 파란 점을 찍고, shouldMove()가 참이면 카메라도 옮긴다(거부·실패는 토스트). explicit = 버튼을 직접 누름. */
  const locate = useCallback(
    async (shouldMove: () => boolean, explicit = false) => {
      const result = await getUserLocation();
      if (result.status !== 'ok') {
        showNotice(!explicit ? LOCATION_NOTICE : result.status === 'denied' ? LOCATION_DENIED_HELP : LOCATION_ERROR);
        return;
      }
      setUserLocation(result.coord);
      if (shouldMove()) setCamera({ center: result.coord, zoom: USER_ZOOM });
    },
    [setCamera, setUserLocation, showNotice],
  );

  // 시작 시 한 번 — 장소 링크로 들어왔으면(이미 선택 장소가 있으면) 카메라는 건드리지 않는다.
  useEffect(() => {
    void locate(() => !useAppStore.getState().selectedPlace);
  }, [locate]);

  const onOpenSearch = useCallback(() => router.push('/search'), [router]);
  const onRequestLocation = useCallback(() => void locate(() => true, true), [locate]);
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
      notice={notice?.text}
      noticeId={notice?.id}
      revealBehindPanel={isOverlayPath(pathname)}
      onDismissNotice={onDismissNotice}
      onOpenSearch={onOpenSearch}
      onRequestLocation={onRequestLocation}
      onOpenRoute={onOpenRoute}
    />
  );
}
