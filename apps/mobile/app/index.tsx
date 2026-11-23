/**
 * Home 라우트 — / (E3).
 *
 * C1 HomeScreen에 어댑터로 배선(화면 시그니처 불변, 어댑터는 라우트 파일).
 * - 카메라·선택 장소·내 위치는 D4 Zustand 스토어(useAppStore)가 소유 — 스토어 카메라가 지도를 움직인다.
 * - 시작 시 위치 권한이 있으면 내 위치로 센터링 + 파란 점. 거부/실패면 토스트로 안내.
 * - 검색바 탭 → /search, 현재 위치 버튼 → LocationService.
 * - 장소 상세·검색·경로 입력은 이 화면 위에 패널로 뜬다(pathname으로 패널 종류 판별).
 * - 카테고리 칩(F5): 고른 순간의 지도 영역으로 검색, 지도를 옮기면 '이 지역 재검색'. 마커·목록 탭 → 장소.
 * - 길게 누르기(F6): 주소를 붙여 '여기서 출발/여기로 도착' → /route/input?o=|d=.
 */
import React, { useCallback, useEffect, useState } from 'react';
import { useLocalSearchParams, useNavigation, usePathname, useRouter, type Href } from 'expo-router';
import type { BBox, CameraState, LatLng, MapMarker, Place } from '@wayfinder/shared';
import type { PlaceCategoryCode } from '@wayfinder/shared/api';
import { HomeScreen } from '../src/screens/HomeScreen';
import { useCategoryQuery, useReverseGeocodeQuery } from '../src/state/queries';
import { placeHref } from '../src/search/placeUrl';
import { routeQuery } from '../src/route/routeUrl';
import { boundsMoved } from '../src/map/mapHelpers';
import { useAppStore } from '../src/state/store';
import { getUserLocation } from '../src/services/LocationService';
import { isOverlayPath, panelForPath } from '../src/components/sheetSnap';

const LOCATION_NOTICE = '위치 권한을 허용하면 내 주변부터 보여드려요';
// '내 위치'를 직접 눌렀을 때 — 무엇을 하면 되는지까지.
const LOCATION_DENIED_HELP = '위치 권한이 꺼져 있어요. 주소창 왼쪽 사이트 설정(자물쇠)에서 위치를 허용한 뒤 다시 눌러 주세요.';
const LOCATION_ERROR = '현재 위치를 찾지 못했어요. 잠시 후 다시 시도해 주세요.';
const USER_ZOOM = 15;
const PRESSED_MARKER_ID = '__pressed__';

/** 지도가 영역을 아직 안 알려 줬을 때(네이티브) 중심 ±약 1km. ponytail: 네이티브에 onBoundsChange가 붙으면 불필요. */
function approxBounds(camera: CameraState): BBox {
  const d = 0.01;
  const { lat, lng } = camera.center;
  return { sw: { lat: lat - d, lng: lng - d }, ne: { lat: lat + d, lng: lng + d } };
}

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

  // 카테고리 칩(F5): 칩을 고른 순간(또는 재검색)의 영역으로만 검색 — 지도를 옮길 때마다 자동 검색하지 않는다.
  const [bounds, setBounds] = useState<BBox | null>(null);
  const [categoryReq, setCategoryReq] = useState<{ code: PlaceCategoryCode; bounds: BBox } | null>(null);
  const categoryQuery = useCategoryQuery(categoryReq);
  const categoryPlaces = categoryReq ? categoryQuery.data : undefined;
  const onSelectCategory = useCallback(
    (code: PlaceCategoryCode | null) =>
      setCategoryReq(code ? { code, bounds: bounds ?? approxBounds(useAppStore.getState().camera) } : null),
    [bounds],
  );
  const canResearch = !!categoryReq && !!bounds && boundsMoved(categoryReq.bounds, bounds);
  // 옮겼으면 새 영역으로, 아니면(실패 후 다시 시도) 같은 영역 재요청.
  const { refetch: refetchCategory } = categoryQuery;
  const onResearch = useCallback(() => {
    if (canResearch && categoryReq && bounds) setCategoryReq({ code: categoryReq.code, bounds });
    else void refetchCategory();
  }, [canResearch, categoryReq, bounds, refetchCategory]);
  const onOpenPlace = useCallback((place: Place) => router.push(placeHref(place) as Href), [router]);

  // 길게 누르기(F6): 팝업은 바로 띄우고 주소는 뒤따라 채운다(실패·없음이면 좌표).
  const [pressedCoord, setPressedCoord] = useState<LatLng | null>(null);
  const reverse = useReverseGeocodeQuery(pressedCoord);
  const pressed = pressedCoord
    ? { coord: pressedCoord, label: reverse.data ?? null, loading: reverse.isLoading }
    : null;
  const onDismissPressed = useCallback(() => setPressedCoord(null), []);
  const onRouteFromPressed = useCallback(
    (role: 'origin' | 'destination') => {
      if (!pressedCoord) return;
      const stop = {
        coord: pressedCoord,
        label: reverse.data ?? `${pressedCoord.lat.toFixed(5)}, ${pressedCoord.lng.toFixed(5)}`,
      };
      setPressedCoord(null);
      router.push(`/route/input${routeQuery(role === 'origin' ? { origin: stop } : { destination: stop })}` as Href);
    },
    [pressedCoord, reverse.data, router],
  );

  const markers: MapMarker[] = [
    ...(categoryPlaces ?? [])
      .filter((p) => p.id !== selectedPlace?.id)
      .map((p): MapMarker => ({ id: p.id, coord: p.coord, title: p.name, kind: 'place' })),
    ...(selectedPlace
      ? [{ id: selectedPlace.id, coord: selectedPlace.coord, title: selectedPlace.name, kind: 'place' as const, selected: true }]
      : []),
    ...(pressedCoord ? [{ id: PRESSED_MARKER_ID, coord: pressedCoord, kind: 'destination' as const }] : []),
  ];
  const onMarkerPress = useCallback(
    (id: string) => {
      const place = categoryPlaces?.find((p) => p.id === id);
      if (place) onOpenPlace(place);
    },
    [categoryPlaces, onOpenPlace],
  );

  /** 내 위치를 구해 파란 점을 찍고, shouldMove()가 참이면 카메라도 옮긴다(거부·실패는 토스트). explicit = 버튼을 직접 누름. */
  const locate = useCallback(
    (shouldMove: () => boolean, explicit = false) =>
      getUserLocation().then((result) => {
        if (result.status !== 'ok') {
          showNotice(!explicit ? LOCATION_NOTICE : result.status === 'denied' ? LOCATION_DENIED_HELP : LOCATION_ERROR);
          return;
        }
        setUserLocation(result.coord);
        if (shouldMove()) setCamera({ center: result.coord, zoom: USER_ZOOM });
      }),
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
      onBoundsChange={setBounds}
      markers={markers.length ? markers : undefined}
      onMarkerPress={onMarkerPress}
      activeCategory={categoryReq?.code ?? null}
      categoryPlaces={categoryPlaces}
      categoryStatus={!categoryReq ? 'idle' : categoryQuery.isError ? 'error' : categoryQuery.isLoading ? 'loading' : 'ready'}
      canResearch={canResearch}
      onSelectCategory={onSelectCategory}
      onResearch={onResearch}
      onOpenPlace={onOpenPlace}
      onLongPress={setPressedCoord}
      pressed={pressed}
      onRouteFromPressed={onRouteFromPressed}
      onDismissPressed={onDismissPressed}
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
