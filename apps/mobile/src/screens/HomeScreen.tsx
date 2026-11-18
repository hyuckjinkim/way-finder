/**
 * HomeScreen — 지도 홈 화면 (C1).
 *
 * <MapView>는 **F5 stub 고정 경로(`../map/MapView`)만 import**한다. 소유권 핸드오프(M2):
 * 이 화면은 어떤 시점에도 src/map/ 파일을 생성/수정하지 않는다(B4가 동일 경로를 실제
 * 디스패처로 덮어씀). 검색바(검색 화면 진입) + 길찾기/내 위치 버튼을 오버레이로 얹는다.
 *
 * 카메라는 `camera` prop이 주어지면 **제어형**(스토어 카메라가 지도를 움직임), 없으면
 * initialCamera로 시작하는 내부 상태. 선택 장소(`focus`)가 생기면 패널에 가려지지 않게 맞춘다.
 * 패널(검색·경로·장소 상세)이 열려 있으면(`panel`) 검색바·FAB 배치를 비켜 준다.
 */
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, Pressable, StyleSheet, useWindowDimensions } from 'react-native';
import type {
  CameraState,
  LatLng,
  MapMarker,
  MapViewRef,
} from '@wayfinder/shared';
import MapView from '../map/MapView';
import { Toast } from '../components/Toast';
import { homeChrome, type HomePanel } from '../components/sheetSnap';
import { placeFitBounds } from '../search/placeUrl';

/** 데모 모드 기본 카메라 — 서울 시청 근처. */
export const DEFAULT_CAMERA: CameraState = {
  center: { lat: 37.5665, lng: 126.978 },
  zoom: 11,
};

export interface HomeScreenProps {
  /** 초기 카메라(미지정 시 서울). `camera`가 있으면 무시. */
  initialCamera?: CameraState;
  /** 제어형 카메라 — 바뀌면 지도가 따라 움직인다. */
  camera?: CameraState;
  /** 지도 이동 후 카메라 보고. */
  onCameraChange?: (camera: CameraState) => void;
  /** 지도 위 마커(선택 장소 핀 등). */
  markers?: MapMarker[];
  /** 내 위치 — 있으면 파란 점. */
  userLocation?: LatLng;
  /** 선택 장소 좌표 — 패널에 안 가리게 화면에 맞춘다(처음 + focusSeq가 바뀔 때). */
  focus?: LatLng;
  /** 같은 장소를 다시 골라도 다시 맞추도록 하는 신호. */
  focusSeq?: number;
  /** 지금 홈 위에 떠 있는 패널(검색바·FAB 배치용). */
  panel?: HomePanel;
  /** 상단 토스트 문구(예: 위치 권한 안내). */
  notice?: string | null;
  onDismissNotice?: () => void;
  /** 검색바 탭 — 검색 화면 진입(E가 배선). */
  onOpenSearch?: () => void;
  /** 현재 위치 버튼 — LocationService가 제공한 좌표로 카메라 이동(D/E가 배선). */
  onRequestLocation?: () => void;
  /** 길찾기 버튼 — 경로 입력 화면 진입(E가 배선). */
  onOpenRoute?: () => void;
}

export function HomeScreen({
  initialCamera = DEFAULT_CAMERA,
  camera: controlledCamera,
  onCameraChange,
  markers,
  userLocation,
  focus,
  focusSeq = 0,
  panel = 'none',
  notice,
  onDismissNotice,
  onOpenSearch,
  onRequestLocation,
  onOpenRoute,
}: HomeScreenProps): React.ReactElement {
  const mapRef = useRef<MapViewRef>(null);
  const [localCamera, setLocalCamera] = useState<CameraState>(initialCamera);
  const camera = controlledCamera ?? localCamera;
  const { width, height } = useWindowDimensions();
  const chrome = homeChrome(panel, width, height);

  // 장소를 고르면 항상 '엿보기' 시트가 뜬다 → 그 여백으로 맞춘다. 좌표가 바뀔 때만 다시 계산
  // (패널이 바뀌거나 사용자가 지도를 옮긴 뒤 검색을 열어도 되돌아가지 않게).
  const size = useRef({ width, height });
  size.current = { width, height };
  const fitTo = useMemo(
    () =>
      focus
        ? {
            bounds: placeFitBounds(focus),
            padding: homeChrome('peek', size.current.width, size.current.height).fitPadding,
          }
        : undefined,
    [focus?.lat, focus?.lng], // eslint-disable-line react-hooks/exhaustive-deps
  );

  // 마운트 후 같은 장소를 다시 고르면(fitTo 값이 그대로라 렌더러가 무시) 명령형으로 다시 맞춘다.
  const firstFocus = useRef(true);
  useEffect(() => {
    if (firstFocus.current) {
      firstFocus.current = false;
      return;
    }
    if (fitTo) mapRef.current?.fitBounds(fitTo.bounds, fitTo.padding);
  }, [focusSeq]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleCamera = (next: CameraState): void => {
    setLocalCamera(next);
    onCameraChange?.(next);
  };

  return (
    <View style={styles.root}>
      <MapView
        ref={mapRef}
        camera={camera}
        markers={markers}
        userLocation={userLocation}
        fitTo={fitTo}
        showUserLocation
        onCameraChange={handleCamera}
      />

      {chrome.showSearchBar ? (
        <View style={styles.searchBarWrap} pointerEvents="box-none">
          <Pressable
            style={styles.searchBar}
            onPress={onOpenSearch}
            accessibilityRole="search"
            accessibilityLabel="장소 검색"
          >
            <Text style={styles.searchPlaceholder}>장소·주소 검색</Text>
          </Pressable>
        </View>
      ) : null}

      {chrome.showFabs ? (
        <View style={[styles.fabWrap, { bottom: chrome.fabBottom }]} pointerEvents="box-none">
          <Pressable
            style={styles.fab}
            onPress={onOpenRoute}
            accessibilityRole="button"
            accessibilityLabel="길찾기"
          >
            <Text style={styles.fabLabel}>길찾기</Text>
          </Pressable>
          <Pressable
            style={styles.fab}
            onPress={onRequestLocation}
            accessibilityRole="button"
            accessibilityLabel="현재 위치"
          >
            <Text style={styles.fabLabel}>내 위치</Text>
          </Pressable>
        </View>
      ) : null}

      {notice && onDismissNotice ? (
        <Toast message={notice} onDismiss={onDismissNotice} top={chrome.showSearchBar ? 72 : 12} />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  searchBarWrap: {
    position: 'absolute',
    top: 12,
    left: 12,
    right: 12,
    alignItems: 'flex-start',
  },
  searchBar: {
    alignSelf: 'stretch',
    maxWidth: 420,
    minHeight: 48,
    justifyContent: 'center',
    backgroundColor: '#fff',
    borderRadius: 24,
    paddingHorizontal: 20,
    shadowColor: '#000',
    shadowOpacity: 0.12,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 3,
  },
  searchPlaceholder: { fontSize: 15, color: '#6b7280' },
  fabWrap: {
    position: 'absolute',
    right: 16,
    gap: 12,
    alignItems: 'flex-end',
  },
  fab: {
    minWidth: 64,
    minHeight: 44,
    paddingHorizontal: 16,
    borderRadius: 22,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 4,
  },
  fabLabel: { fontSize: 14, fontWeight: '600', color: '#1a73e8' },
});
