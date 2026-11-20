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
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  FlatList,
  ScrollView,
  StyleSheet,
} from 'react-native';
import type { Place, RouteRequest, LatLng, TravelMode } from '@wayfinder/shared';
import type { Capabilities } from '@wayfinder/shared/api';
import { routeRegion } from '@wayfinder/shared/region';
import type { PlaceProvider } from '@wayfinder/shared/mocks';
import { mockPlaceProvider } from '@wayfinder/shared/mocks';
import type { ModeTabId } from '../route/modeTabs.js';
import { DEFAULT_MODE_TAB, tabToMode } from '../route/modeTabs.js';
import { usePlaceSearch } from '../state/placeSearch.js';
import { placeSubtitle } from '../search/format.js';
import { ModeTabs } from '../route/ModeTabsBar.js';
import { availableModes } from '../route/capabilities.js';
import { loadLastMode, saveLastMode } from '../route/lastMode.js';
import type { RouteUrlState } from '../route/routeUrl.js';
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
  /**
   * 경로 탐색 제출 시 호출. stops가 최소 2개(출발+도착)여야 활성화된다.
   * 두 번째 인자는 이름이 붙은 입력 상태 — 결과 화면 URL(routeQuery)에 쓴다.
   */
  onSubmit?: (req: RouteRequest, urlState: RouteUrlState) => void;
  /** 프리필(URL ?o&d&mode 등). */
  initial?: { origin?: StopEntry; destination?: StopEntry; mode?: TravelMode };
  /** 현재 위치 조회 — 성공하면 출발지를 "내 위치"로 채운다(출발지 프리필이 없을 때만). null=실패/폴백. */
  locate?: () => Promise<LatLng | null>;
  /** 프록시 지원 모드 — undefined면 전 모드 노출. */
  capabilities?: Capabilities;
  /** 선택된 이동수단이 바뀔 때(초기값 포함) 호출. */
  onModeChange?: (mode: TravelMode) => void;
  /** 뒤로/취소. */
  onCancel?: () => void;
}

/** 어느 입력 필드가 검색 포커스를 받고 있는지. */
type FocusedField = 'origin' | 'destination' | { waypoint: number } | null;

/** 경유지 엔트리 + 좌표를 저장하는 로컬 상태용 타입. */
export interface StopEntry {
  label: string;
  coord: LatLng;
}

export function RouteInputScreen({
  provider = mockPlaceProvider,
  onSubmit,
  onCancel,
  initial,
  locate,
  capabilities,
  onModeChange,
}: RouteInputScreenProps): React.ReactElement {
  const [origin, setOrigin] = useState<StopEntry | null>(initial?.origin ?? null);
  const [destination, setDestination] = useState<StopEntry | null>(initial?.destination ?? null);
  const [waypoints, setWaypoints] = useState<WaypointEntry[]>([]);
  const [mode, setMode] = useState<ModeTabId>(initial?.mode ?? DEFAULT_MODE_TAB);

  // 기본 출발지 = 내 위치. 사용자가 먼저 고른 출발지는 덮어쓰지 않는다.
  useEffect(() => {
    if (initial?.origin || !locate) return;
    let alive = true;
    void locate().then((coord) => {
      if (alive && coord) setOrigin((cur) => cur ?? { label: '내 위치', coord });
    });
    return () => {
      alive = false;
    };
  }, [initial?.origin, locate]);

  // 마지막 이동수단 복원 — SSR 하이드레이션 불일치를 피해 마운트 후 적용(URL mode가 우선).
  useEffect(() => {
    if (initial?.mode) return;
    const last = loadLastMode();
    if (last) setMode(last);
  }, [initial?.mode]);

  const selectMode = useCallback((m: TravelMode) => {
    setMode(m);
    saveLastMode(m);
  }, []);

  // 경로 지역(출발·도착·경유지 중 정해진 것)에서 지원하는 모드만 탭에 노출.
  const stopCoords = [origin?.coord, destination?.coord, ...filterSetWaypoints(waypoints).map((w) => w.coord)].filter(
    (c): c is LatLng => c !== undefined,
  );
  const region = stopCoords.length >= 2 ? routeRegion(stopCoords) : undefined;
  const modes = useMemo(() => availableModes(capabilities, region), [capabilities, region]);
  useEffect(() => {
    if (!modes.includes(mode)) setMode(modes[0]!);
  }, [modes, mode]);
  useEffect(() => {
    onModeChange?.(mode);
  }, [mode, onModeChange]);

  // A→W1→W2→B ⇄ B→W2→W1→A — 경유지 순서도 뒤집는다.
  const swapStops = useCallback(() => {
    setOrigin(destination);
    setDestination(origin);
    setWaypoints((prev) => [...prev].reverse());
  }, [origin, destination]);

  const [focusedField, setFocusedField] = useState<FocusedField>(null);
  const [searchQuery, setSearchQuery] = useState('');
  // 출발지(보통 내 위치) 기준 거리 — 메인 검색 행과 같은 `업종 · 거리 · 주소`.
  const { results: searchResults, status: searchStatus, setQuery: runSearch } = usePlaceSearch(provider, origin?.coord);

  const handleFocus = useCallback((field: FocusedField) => {
    setFocusedField(field);
    setSearchQuery('');
    runSearch('');
  }, [runSearch]);

  const handleSearchChange = useCallback(
    (text: string) => {
      setSearchQuery(text);
      runSearch(text);
    },
    [runSearch],
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
      runSearch('');
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
      runSearch('');
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
    const setWaypointsOnly = filterSetWaypoints(waypoints);
    onSubmit?.(
      { stops, mode: tabToMode(mode) },
      { origin, destination, waypoints: setWaypointsOnly, mode: tabToMode(mode) },
    );
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
      <ModeTabs active={mode} onChange={selectMode} modes={modes} />

      {/* 정지점 입력 섹션 */}
      <ScrollView style={styles.stopsScroll} keyboardShouldPersistTaps="handled">
        {/* 출발지 */}
        <View style={styles.originRow}>
          <Pressable
            style={[styles.stopRow, styles.stopRowFlex, styles.originPress]}
            onPress={() => handleFocus('origin')}
            accessibilityRole="button"
            accessibilityLabel="출발지 선택"
          >
            <View style={[styles.dot, styles.dotOrigin]} />
            <Text style={origin ? styles.stopLabel : styles.stopPlaceholder}>
              {origin ? origin.label : '출발지를 입력하세요'}
            </Text>
          </Pressable>
          <Pressable
            onPress={swapStops}
            disabled={!origin && !destination}
            style={[styles.swapBtn, !origin && !destination && styles.actionBtnDisabled]}
            accessibilityRole="button"
            accessibilityLabel="출발지와 도착지 바꾸기"
          >
            <Text style={styles.swapText}>⇅</Text>
          </Pressable>
        </View>

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
                runSearch('');
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
              searchStatus === 'idle' ? null : <Text style={styles.empty}>{EMPTY_TEXT[searchStatus]}</Text>
            }
            renderItem={({ item }) => (
              <Pressable
                style={styles.resultRow}
                onPress={() => handleSelectPlace(item)}
                accessibilityRole="button"
                accessibilityLabel={item.name}
              >
                <Text style={styles.resultName} numberOfLines={1}>{item.name}</Text>
                <Text style={styles.resultSub} numberOfLines={1}>
                  {placeSubtitle(item)}
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

// ponytail: SearchScreen의 EMPTY_TEXT와 같은 문구(그 파일은 비공개 상수) — 바뀌면 함께.
const EMPTY_TEXT = {
  loading: '검색 중…',
  done: '검색 결과가 없어요.',
  error: '검색에 실패했어요. 잠시 후 다시 시도해 주세요.',
} as const;

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
  stopPlaceholder: { fontSize: 15, color: '#6b7280' },
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
    minWidth: 44,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  originRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#eee',
  },
  originPress: { borderBottomWidth: 0 },
  swapBtn: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center', marginRight: 8 },
  swapText: { fontSize: 20, color: '#1a73e8' },
  actionBtnDisabled: { opacity: 0.3 },
  actionText: { fontSize: 12, color: '#555' },
  removeText: { color: '#e53935' },
  addWaypointBtn: {
    paddingHorizontal: 16,
    minHeight: 44,
    justifyContent: 'center',
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
  cancelBtn: { paddingLeft: 12, minHeight: 44, justifyContent: 'center' },
  cancelText: { fontSize: 15, color: '#1a73e8' },
  empty: { padding: 24, textAlign: 'center', color: '#6b7280', fontSize: 14 },
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
