/**
 * C2 — 경로 입력 화면.
 *
 * - 출발·도착·경유지(≤5) 입력 필드
 * - 경유지 추가·삭제·위/아래 이동 (C1 waypoints.ts 순수 함수 사용)
 * - 이동 수단 탭 (C3 ModeTabs)
 * - 제출 시 onSubmit(RouteRequest) 콜백
 *
 * 검색은 P1 PlaceService(PlaceProvider 계약)를 재사용한다.
 * 라우트 배선·실 서비스 연결은 E 스트림. 이 화면은 provider·콜백 계약만 노출한다.
 * plain RN만 사용 — Reanimated·gesture-handler 비의존.
 */
import React, { useCallback, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  FlatList,
  ScrollView,
  StyleSheet,
} from 'react-native';
import type { Place, RouteRequest, LatLng } from '@wayfinder/shared';
import type { PlaceProvider } from '@wayfinder/shared/mocks';
import { mockPlaceProvider } from '@wayfinder/shared/mocks';
import type { ModeTabId } from '../route/modeTabs.js';
import { DEFAULT_MODE_TAB, tabToMode } from '../route/modeTabs.js';
import { ModeTabs } from '../route/ModeTabsBar.js';
import type { WaypointEntry } from '../route/waypoints.js';
import {
  addWaypoint,
  removeWaypoint,
  moveWaypointUp,
  moveWaypointDown,
  toStops,
  filterSetWaypoints,
  MAX_WAYPOINTS,
} from '../route/waypoints.js';

export interface RouteInputScreenProps {
  /** 검색 공급자 (기본: 데모 모드 mock provider). */
  provider?: PlaceProvider;
  /** 경로 탐색 제출 시 호출. stops가 최소 2개(출발+도착)여야 활성화된다. */
  onSubmit?: (req: RouteRequest) => void;
  /** 뒤로/취소. */
  onCancel?: () => void;
}

/** 어느 입력 필드가 검색 포커스를 받고 있는지. */
type FocusedField = 'origin' | 'destination' | { waypoint: number } | null;

/** 경유지 엔트리 + 좌표를 저장하는 로컬 상태용 타입. */
interface StopEntry {
  label: string;
  coord: LatLng;
}

export function RouteInputScreen({
  provider = mockPlaceProvider,
  onSubmit,
  onCancel,
}: RouteInputScreenProps): React.ReactElement {
  const [origin, setOrigin] = useState<StopEntry | null>(null);
  const [destination, setDestination] = useState<StopEntry | null>(null);
  const [waypoints, setWaypoints] = useState<WaypointEntry[]>([]);
  const [mode, setMode] = useState<ModeTabId>(DEFAULT_MODE_TAB);

  const [focusedField, setFocusedField] = useState<FocusedField>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<Place[]>([]);

  const handleFocus = useCallback((field: FocusedField) => {
    setFocusedField(field);
    setSearchQuery('');
    setSearchResults([]);
  }, []);

  const handleSearchChange = useCallback(
    (text: string) => {
      setSearchQuery(text);
      if (text.trim().length === 0) {
        setSearchResults([]);
        return;
      }
      void provider.search(text).then(setSearchResults);
    },
    [provider],
  );

  const handleSelectPlace = useCallback(
    (place: Place) => {
      const entry: StopEntry = { label: place.name, coord: place.coord };
      if (focusedField === 'origin') {
        setOrigin(entry);
      } else if (focusedField === 'destination') {
        setDestination(entry);
      } else if (focusedField !== null && typeof focusedField === 'object') {
        // 경유지 수정 — 해당 인덱스를 교체
        const idx = focusedField.waypoint;
        setWaypoints((prev) => {
          const next = [...prev];
          next[idx] = { label: entry.label, coord: entry.coord };
          return next;
        });
      }
      setFocusedField(null);
      setSearchQuery('');
      setSearchResults([]);
    },
    [focusedField],
  );

  const handleAddWaypoint = useCallback(() => {
    // 빈 경유지를 추가하고 즉시 포커스
    const newIndex = waypoints.length;
    const added = addWaypoint(waypoints, { label: '', coord: { lat: 0, lng: 0 } });
    if (added.length > waypoints.length) {
      setWaypoints(added);
      setFocusedField({ waypoint: newIndex });
      setSearchQuery('');
      setSearchResults([]);
    }
  }, [waypoints]);

  const handleRemoveWaypoint = useCallback((index: number) => {
    setWaypoints((prev) => removeWaypoint(prev, index));
    setFocusedField(null);
  }, []);

  const handleMoveUp = useCallback((index: number) => {
    setWaypoints((prev) => moveWaypointUp(prev, index));
  }, []);

  const handleMoveDown = useCallback((index: number) => {
    setWaypoints((prev) => moveWaypointDown(prev, index));
  }, []);

  const handleSubmit = useCallback(() => {
    if (!origin || !destination) return;
    // 미설정 경유지({0,0} placeholder, label='')는 제출에서 제외 — 장소를 고른 경유지만 stops에 포함.
    const stops = toStops(origin.coord, filterSetWaypoints(waypoints), destination.coord);
    onSubmit?.({ stops, mode: tabToMode(mode) });
  }, [origin, destination, waypoints, mode, onSubmit]);

  const canSubmit = origin !== null && destination !== null;
  const isSearchOpen = focusedField !== null;

  // 현재 포커스된 필드의 라벨
  const searchPlaceholder =
    focusedField === 'origin'
      ? '출발지 검색'
      : focusedField === 'destination'
        ? '도착지 검색'
        : '경유지 검색';

  return (
    <View style={styles.root}>
      {/* 이동 수단 탭 */}
      <ModeTabs active={mode} onChange={setMode} />

      {/* 정지점 입력 섹션 */}
      <ScrollView style={styles.stopsScroll} keyboardShouldPersistTaps="handled">
        {/* 출발지 */}
        <Pressable
          style={styles.stopRow}
          onPress={() => handleFocus('origin')}
          accessibilityRole="button"
          accessibilityLabel="출발지 선택"
        >
          <View style={[styles.dot, styles.dotOrigin]} />
          <Text style={origin ? styles.stopLabel : styles.stopPlaceholder}>
            {origin ? origin.label : '출발지를 입력하세요'}
          </Text>
        </Pressable>

        {/* 경유지 */}
        {waypoints.map((wp, idx) => (
          <View key={idx} style={styles.waypointRow}>
            <Pressable
              style={styles.stopRowFlex}
              onPress={() => handleFocus({ waypoint: idx })}
              accessibilityRole="button"
              accessibilityLabel={`경유지 ${idx + 1} 선택`}
            >
              <View style={[styles.dot, styles.dotWaypoint]} />
              <Text style={wp.label ? styles.stopLabel : styles.stopPlaceholder}>
                {wp.label || '경유지를 검색하세요'}
              </Text>
            </Pressable>
            <View style={styles.waypointActions}>
              <Pressable
                onPress={() => handleMoveUp(idx)}
                disabled={idx === 0}
                accessibilityRole="button"
                accessibilityLabel="위로 이동"
                style={[styles.actionBtn, idx === 0 && styles.actionBtnDisabled]}
              >
                <Text style={styles.actionText}>▲</Text>
              </Pressable>
              <Pressable
                onPress={() => handleMoveDown(idx)}
                disabled={idx === waypoints.length - 1}
                accessibilityRole="button"
                accessibilityLabel="아래로 이동"
                style={[
                  styles.actionBtn,
                  idx === waypoints.length - 1 && styles.actionBtnDisabled,
                ]}
              >
                <Text style={styles.actionText}>▼</Text>
              </Pressable>
              <Pressable
                onPress={() => handleRemoveWaypoint(idx)}
                accessibilityRole="button"
                accessibilityLabel="경유지 삭제"
                style={styles.actionBtn}
              >
                <Text style={[styles.actionText, styles.removeText]}>✕</Text>
              </Pressable>
            </View>
          </View>
        ))}

        {/* 경유지 추가 버튼 (≤MAX_WAYPOINTS 한도) */}
        {waypoints.length < MAX_WAYPOINTS ? (
          <Pressable
            style={styles.addWaypointBtn}
            onPress={handleAddWaypoint}
            accessibilityRole="button"
            accessibilityLabel="경유지 추가"
          >
            <Text style={styles.addWaypointText}>+ 경유지 추가</Text>
          </Pressable>
        ) : null}

        {/* 도착지 */}
        <Pressable
          style={styles.stopRow}
          onPress={() => handleFocus('destination')}
          accessibilityRole="button"
          accessibilityLabel="도착지 선택"
        >
          <View style={[styles.dot, styles.dotDestination]} />
          <Text style={destination ? styles.stopLabel : styles.stopPlaceholder}>
            {destination ? destination.label : '도착지를 입력하세요'}
          </Text>
        </Pressable>
      </ScrollView>

      {/* 검색 오버레이 */}
      {isSearchOpen ? (
        <View style={styles.searchOverlay}>
          <View style={styles.searchBar}>
            <TextInput
              style={styles.searchInput}
              value={searchQuery}
              onChangeText={handleSearchChange}
              placeholder={searchPlaceholder}
              placeholderTextColor="#999"
              autoFocus
              accessibilityLabel={searchPlaceholder}
            />
            <Pressable
              onPress={() => {
                setFocusedField(null);
                setSearchQuery('');
                setSearchResults([]);
              }}
              accessibilityRole="button"
              accessibilityLabel="검색 취소"
              style={styles.cancelBtn}
            >
              <Text style={styles.cancelText}>취소</Text>
            </Pressable>
          </View>
          <FlatList
            data={searchResults}
            keyExtractor={(item) => item.id}
            keyboardShouldPersistTaps="handled"
            ListEmptyComponent={
              searchQuery.trim().length > 0 ? (
                <Text style={styles.empty}>검색 결과가 없어요.</Text>
              ) : null
            }
            renderItem={({ item }) => (
              <Pressable
                style={styles.resultRow}
                onPress={() => handleSelectPlace(item)}
                accessibilityRole="button"
                accessibilityLabel={item.name}
              >
                <Text style={styles.resultName}>{item.name}</Text>
                <Text style={styles.resultSub}>
                  {item.category} · {item.address}
                </Text>
              </Pressable>
            )}
          />
        </View>
      ) : null}

      {/* 하단 액션 바 */}
      <View style={styles.actionBar}>
        {onCancel ? (
          <Pressable
            onPress={onCancel}
            style={styles.cancelBarBtn}
            accessibilityRole="button"
            accessibilityLabel="취소"
          >
            <Text style={styles.cancelBarText}>취소</Text>
          </Pressable>
        ) : null}
        <Pressable
          onPress={handleSubmit}
          disabled={!canSubmit}
          style={[styles.submitBtn, !canSubmit && styles.submitBtnDisabled]}
          accessibilityRole="button"
          accessibilityLabel="경로 탐색"
          accessibilityState={{ disabled: !canSubmit }}
        >
          <Text style={styles.submitText}>경로 탐색</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#fff' },
  stopsScroll: { flex: 1 },
  stopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#eee',
  },
  stopRowFlex: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  dot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginRight: 12,
  },
  dotOrigin: { backgroundColor: '#1a73e8' },
  dotWaypoint: { backgroundColor: '#888' },
  dotDestination: { backgroundColor: '#e53935' },
  stopLabel: { fontSize: 15, color: '#111' },
  stopPlaceholder: { fontSize: 15, color: '#aaa' },
  waypointRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingLeft: 16,
    paddingRight: 8,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#eee',
  },
  waypointActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  actionBtn: {
    padding: 6,
  },
  actionBtnDisabled: { opacity: 0.3 },
  actionText: { fontSize: 12, color: '#555' },
  removeText: { color: '#e53935' },
  addWaypointBtn: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#eee',
  },
  addWaypointText: { fontSize: 14, color: '#1a73e8' },
  searchOverlay: {
    ...StyleSheet.absoluteFill,
    backgroundColor: '#fff',
    zIndex: 10,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#eee',
  },
  searchInput: {
    flex: 1,
    height: 40,
    backgroundColor: '#f2f3f5',
    borderRadius: 8,
    paddingHorizontal: 12,
    fontSize: 15,
    color: '#111',
  },
  cancelBtn: { paddingLeft: 12 },
  cancelText: { fontSize: 15, color: '#1a73e8' },
  empty: { padding: 24, textAlign: 'center', color: '#999', fontSize: 14 },
  resultRow: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#f0f0f0',
  },
  resultName: { fontSize: 16, color: '#111', fontWeight: '500' },
  resultSub: { fontSize: 13, color: '#777', marginTop: 2 },
  actionBar: {
    flexDirection: 'row',
    padding: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#eee',
    gap: 8,
  },
  cancelBarBtn: {
    flex: 1,
    paddingVertical: 14,
    alignItems: 'center',
    backgroundColor: '#f0f0f0',
    borderRadius: 8,
  },
  cancelBarText: { fontSize: 15, color: '#555', fontWeight: '500' },
  submitBtn: {
    flex: 2,
    paddingVertical: 14,
    alignItems: 'center',
    backgroundColor: '#1a73e8',
    borderRadius: 8,
  },
  submitBtnDisabled: { backgroundColor: '#b0c8f0' },
  submitText: { fontSize: 15, color: '#fff', fontWeight: '600' },
});
