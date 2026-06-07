/**
 * HomeScreen — 지도 홈 화면 (C1).
 *
 * <MapView>는 **F5 stub 고정 경로(`../map/MapView`)만 import**한다. 소유권 핸드오프(M2):
 * 이 화면은 어떤 시점에도 src/map/ 파일을 생성/수정하지 않는다(B4가 동일 경로를 실제
 * 디스패처로 덮어씀). 검색바(검색 화면 진입) + 현재 위치 버튼을 오버레이로 얹는다.
 *
 * 카메라/마커/콜백은 props 주입(통합은 E). 데모 모드 기본 카메라는 서울 시청 근처.
 */
import React, { useRef, useState } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import type {
  CameraState,
  LatLng,
  MapMarker,
  MapViewRef,
} from '@wayfinder/shared';
import MapView from '../map/MapView';

/** 데모 모드 기본 카메라 — 서울 시청 근처. */
export const DEFAULT_CAMERA: CameraState = {
  center: { lat: 37.5665, lng: 126.978 },
  zoom: 11,
};

export interface HomeScreenProps {
  /** 초기 카메라(미지정 시 서울). */
  initialCamera?: CameraState;
  /** 지도 위 마커(선택 장소 핀 등). */
  markers?: MapMarker[];
  /** 검색바 탭 — 검색 화면 진입(E가 배선). */
  onOpenSearch?: () => void;
  /** 현재 위치 버튼 — LocationService가 제공한 좌표로 카메라 이동(D/E가 배선). */
  onRequestLocation?: () => void;
}

export function HomeScreen({
  initialCamera = DEFAULT_CAMERA,
  markers,
  onOpenSearch,
  onRequestLocation,
}: HomeScreenProps): React.ReactElement {
  const mapRef = useRef<MapViewRef>(null);
  const [camera, setCamera] = useState<CameraState>(initialCamera);

  const handlePress = (_coord: LatLng): void => {
    // P1: 지도 탭은 no-op (선택 동작은 검색·핀에서). 콜백 계약만 유지.
  };

  return (
    <View style={styles.root}>
      <MapView
        ref={mapRef}
        camera={camera}
        markers={markers}
        showUserLocation
        onPress={handlePress}
        onCameraChange={setCamera}
      />

      <View style={styles.searchBarWrap} pointerEvents="box-none">
        <Pressable
          style={styles.searchBar}
          onPress={onOpenSearch}
          accessibilityRole="search"
          accessibilityLabel="장소 검색"
        >
          <Text style={styles.searchIcon}>🔍</Text>
          <Text style={styles.searchPlaceholder}>장소·주소 검색</Text>
        </Pressable>
      </View>

      <View style={styles.fabWrap} pointerEvents="box-none">
        <Pressable
          style={styles.fab}
          onPress={onRequestLocation}
          accessibilityRole="button"
          accessibilityLabel="현재 위치"
        >
          <Text style={styles.fabIcon}>◎</Text>
        </Pressable>
      </View>
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
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 24,
    paddingHorizontal: 16,
    paddingVertical: 12,
    shadowColor: '#000',
    shadowOpacity: 0.12,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 3,
  },
  searchIcon: { fontSize: 15, marginRight: 8 },
  searchPlaceholder: { fontSize: 15, color: '#888' },
  fabWrap: {
    position: 'absolute',
    right: 16,
    bottom: 24,
  },
  fab: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 4,
  },
  fabIcon: { fontSize: 22, color: '#1a73e8' },
});
