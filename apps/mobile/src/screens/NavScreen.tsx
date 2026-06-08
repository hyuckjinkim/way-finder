/**
 * D1 — NavScreen (턴바이턴 네비게이션 UI).
 *
 * NavState prop 직접 주입 — 실 GPS/LocationProvider 의존 없음(렌더 테스트 가능).
 * expo-location 및 nav 서비스를 일절 import하지 않는다(웹 export 안전 — D2 경계).
 *
 * 구성:
 * - MapView + 폴리라인 (RouteResultScreen 패턴 재사용, MapView 불변)
 * - 다음 턴 안내 카드 (nextStep.instruction + distanceToNextTurnM)
 * - 남은 거리/시간 패널 (distanceRemainingM + durationRemainingSec)
 * - 이탈/재탐색 배너 (off_route / rerouting 상태)
 * - 상단 뒤로 가기 버튼
 *
 * plain RN — 신규 네이티브 의존 0.
 */
import React, { useRef, useEffect } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import type { Route, NavState, MapViewRef } from '@wayfinder/shared';
import MapView from '../map/MapView';
import { routeToPolylines, boundsForRoute } from '../route/routeToPolylines.js';

export interface NavScreenProps {
  /** 표시할 경로. null이면 폴리라인 없음. */
  route: Route | null;
  /** 현재 네비 상태. */
  navState: NavState;
  /** 네비 종료(뒤로 가기) 콜백. */
  onExit?: () => void;
}

/** 초 → "N분" / "N시간 M분" */
function formatDuration(sec: number): string {
  const totalMin = Math.round(sec / 60);
  if (totalMin < 60) return `${totalMin}분`;
  const hours = Math.floor(totalMin / 60);
  const mins = totalMin % 60;
  return mins > 0 ? `${hours}시간 ${mins}분` : `${hours}시간`;
}

/** 미터 → "N km" / "N m" */
function formatDistance(meters: number): string {
  if (meters >= 1000) return `${(meters / 1000).toFixed(1)} km`;
  return `${Math.round(meters)} m`;
}

export function NavScreen({ route, navState, onExit }: NavScreenProps): React.ReactElement {
  const mapRef = useRef<MapViewRef>(null);

  useEffect(() => {
    if (!route) return;
    const bbox = boundsForRoute(route.legs);
    if (bbox) {
      mapRef.current?.fitBounds(bbox, 40);
    }
  }, [route]);

  const polylines = route ? routeToPolylines(route) : [];
  const initialCenter = route?.legs[0]?.start ?? { lat: 37.5665, lng: 126.978 };
  const camera = { center: initialCenter, zoom: 15 };

  const isOffRoute = navState.status === 'off_route';
  const isRerouting = navState.status === 'rerouting';
  const isArrived = navState.status === 'arrived';

  return (
    <View style={styles.root}>
      {/* 지도 — 폴리라인 표시 */}
      <View style={styles.mapWrap}>
        <MapView ref={mapRef} camera={camera} polylines={polylines} />
      </View>

      {/* 상단 뒤로 가기 버튼 */}
      <View style={styles.topBar} pointerEvents="box-none">
        <Pressable
          style={styles.backBtn}
          onPress={onExit}
          accessibilityRole="button"
          accessibilityLabel="네비 종료"
        >
          <Text style={styles.backIcon}>←</Text>
        </Pressable>
      </View>

      {/* 이탈/재탐색 배너 */}
      {(isOffRoute || isRerouting) && (
        <View style={[styles.banner, isRerouting ? styles.bannerRerouting : styles.bannerOffRoute]}>
          <Text style={styles.bannerText}>
            {isRerouting ? '경로를 재탐색 중입니다…' : '경로를 이탈했습니다'}
          </Text>
        </View>
      )}

      {/* 도착 배너 */}
      {isArrived && (
        <View style={[styles.banner, styles.bannerArrived]}>
          <Text style={styles.bannerText}>목적지에 도착했습니다</Text>
        </View>
      )}

      {/* 하단 패널 */}
      <View style={styles.panel}>
        {/* 다음 턴 안내 카드 */}
        {navState.nextStep && !isArrived && (
          <View style={styles.turnCard}>
            <Text style={styles.turnInstruction} numberOfLines={2}>
              {navState.nextStep.instruction}
            </Text>
            <Text style={styles.turnDistance}>
              {formatDistance(navState.distanceToNextTurnM)}
            </Text>
          </View>
        )}

        {/* 남은 거리/시간 */}
        <View style={styles.progressRow}>
          <Text style={styles.remainingDuration}>
            {formatDuration(navState.durationRemainingSec)}
          </Text>
          <Text style={styles.remainingDistance}>
            {formatDistance(navState.distanceRemainingM)}
          </Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  mapWrap: { flex: 1 },
  topBar: {
    position: 'absolute',
    top: 12,
    left: 12,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
    elevation: 3,
  },
  backIcon: { fontSize: 18, color: '#333' },
  banner: {
    position: 'absolute',
    top: 64,
    left: 16,
    right: 16,
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 10,
    alignItems: 'center',
  },
  bannerOffRoute: { backgroundColor: '#ff6f00' },
  bannerRerouting: { backgroundColor: '#1565c0' },
  bannerArrived: { backgroundColor: '#2e7d32' },
  bannerText: { color: '#fff', fontSize: 14, fontWeight: '600' },
  panel: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#fff',
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    paddingHorizontal: 20,
    paddingVertical: 16,
    shadowColor: '#000',
    shadowOpacity: 0.12,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: -2 },
    elevation: 8,
  },
  turnCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
    paddingBottom: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#e0e0e0',
  },
  turnInstruction: {
    flex: 1,
    fontSize: 16,
    fontWeight: '600',
    color: '#1a1a1a',
    marginRight: 12,
  },
  turnDistance: {
    fontSize: 15,
    fontWeight: '700',
    color: '#1565c0',
  },
  progressRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 12,
  },
  remainingDuration: { fontSize: 22, fontWeight: '700', color: '#1a1a1a' },
  remainingDistance: { fontSize: 13, color: '#666' },
});
