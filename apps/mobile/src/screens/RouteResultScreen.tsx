/**
 * D4 — RouteResultScreen.
 *
 * 경로 탐색 결과를 지도 폴리라인 + 요약 패널로 표시한다.
 * - <MapView polylines={...}>: P1 MapView(src/map/MapView) import만, 수정 금지 (§8 D4 경계).
 * - fitBounds: 전체 경로가 화면에 들어오도록 BBox 계산 후 명령형 호출.
 * - 요약 패널: 총 시간/거리, 환승 수, 대중교통 노선명.
 * - 데모 모드: Route prop 직접 주입 (상태 의존 없음 → 단위 테스트 용이).
 */
import React, { useRef, useEffect } from 'react';
import { View, Text, ScrollView, Pressable, StyleSheet } from 'react-native';
import type { Route, MapViewRef, RoutePreference } from '@wayfinder/shared';
import MapView from '../map/MapView';
import { routeToPolylines, boundsForRoute } from '../route/routeToPolylines.js';
import { routeSummary } from '../route/routeSummary.js';

/** 선호 프로필 → 한국어 라벨 (C3 로컬 맵 — B1 routePreference.ts import 금지). */
const PREFERENCE_LABEL: Record<RoutePreference, string> = {
  fastest: '빠른',
  walkable: '걷기좋은',
  safe: '안전',
  quiet: '한적',
  scenic: '풍경',
};

export interface RouteResultScreenProps {
  /** 표시할 경로. null이면 로딩/빈 상태 표시. */
  route: Route | null;
  /** 뒤로 가기 콜백. */
  onBack: () => void;
}

/** 초(seconds) → "N분" 또는 "N시간 M분" 문자열. */
function formatDuration(sec: number): string {
  const totalMin = Math.round(sec / 60);
  if (totalMin < 60) return `${totalMin}분`;
  const hours = Math.floor(totalMin / 60);
  const mins = totalMin % 60;
  return mins > 0 ? `${hours}시간 ${mins}분` : `${hours}시간`;
}

/** 미터 → "N km" 또는 "N m" 문자열. */
function formatDistance(meters: number): string {
  if (meters >= 1000) return `${(meters / 1000).toFixed(1)} km`;
  return `${meters} m`;
}

export function RouteResultScreen({
  route,
  onBack,
}: RouteResultScreenProps): React.ReactElement {
  const mapRef = useRef<MapViewRef>(null);

  // 경로가 있을 때 fitBounds로 전체 경로 뷰
  useEffect(() => {
    if (!route) return;
    const bbox = boundsForRoute(route.legs);
    if (bbox) {
      mapRef.current?.fitBounds(bbox, 40);
    }
  }, [route]);

  const polylines = route ? routeToPolylines(route) : [];
  const summary = route ? routeSummary(route) : null;

  // 지도 카메라 초기값 — 경로 첫 좌표 기준 (fitBounds가 이후 조정)
  const initialCenter =
    route?.legs[0]?.start ?? { lat: 37.5665, lng: 126.978 };
  const camera = { center: initialCenter, zoom: 12 };

  return (
    <View style={styles.root}>
      {/* 지도 — 폴리라인 표시 */}
      <View style={styles.mapWrap}>
        <MapView
          ref={mapRef}
          camera={camera}
          polylines={polylines}
        />
      </View>

      {/* 상단 뒤로 가기 버튼 */}
      <View style={styles.topBar} pointerEvents="box-none">
        <Pressable
          style={styles.backBtn}
          onPress={onBack}
          accessibilityRole="button"
          accessibilityLabel="뒤로"
        >
          <Text style={styles.backIcon}>←</Text>
        </Pressable>
      </View>

      {/* 요약 패널 */}
      <View style={styles.panel}>
        {summary ? (
          <ScrollView showsVerticalScrollIndicator={false}>
            {/* 총 시간 / 거리 */}
            <View style={styles.headerRow}>
              <Text style={styles.duration}>
                {formatDuration(summary.totalDurationSec)}
              </Text>
              <Text style={styles.distance}>
                {formatDistance(summary.totalDistanceM)}
              </Text>
            </View>

            {/* 환승 정보 (대중교통만) */}
            {summary.transfers > 0 && (
              <Text style={styles.transfers}>
                환승 {summary.transfers}회
              </Text>
            )}

            {/* 노선명 목록 */}
            {summary.lineNames.length > 0 && (
              <View style={styles.linesRow}>
                {summary.lineNames.map((name, idx) => (
                  <View key={`${name}-${idx}`} style={styles.lineTag}>
                    <Text style={styles.lineTagText}>{name}</Text>
                  </View>
                ))}
              </View>
            )}

            {/* 커스텀 경로 메타 — 선호 프로필 + 예산 플래그 (C3 P4). fastest/미존재 시 미표시(하위호환). */}
            {summary.customMeta && (
              <View style={styles.customMetaRow}>
                <Text style={styles.customMetaProfile}>
                  {PREFERENCE_LABEL[summary.customMeta.preference]}
                </Text>
                <Text
                  style={
                    summary.customMeta.withinBudget
                      ? styles.withinBudget
                      : styles.overBudget
                  }
                >
                  {summary.customMeta.withinBudget ? '예산 내' : '예산 초과'}
                </Text>
              </View>
            )}
          </ScrollView>
        ) : (
          <Text style={styles.emptyText}>경로를 탐색 중입니다…</Text>
        )}
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
  panel: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    maxHeight: 200,
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
  headerRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 12,
    marginBottom: 6,
  },
  duration: { fontSize: 24, fontWeight: '700', color: '#1a1a1a' },
  distance: { fontSize: 14, color: '#666' },
  transfers: { fontSize: 13, color: '#888', marginBottom: 8 },
  linesRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 4,
  },
  lineTag: {
    backgroundColor: '#f0f4ff',
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  lineTagText: { fontSize: 12, color: '#3949AB' },
  emptyText: { fontSize: 14, color: '#999', textAlign: 'center' },
  customMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 6,
  },
  customMetaProfile: { fontSize: 13, color: '#555', fontWeight: '600' },
  withinBudget: { fontSize: 13, color: '#2e7d32' },
  overBudget: { fontSize: 13, color: '#c62828' },
});
