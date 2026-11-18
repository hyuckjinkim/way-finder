/**
 * SearchScreen — 검색 화면 (C2).
 *
 * 입력 전엔 최근 검색(최대 10, 개별 삭제), 입력하면 자동완성 리스트.
 * 결과 행: `업종 · 거리 · 주소`, 일치한 글자는 굵게. 검색은 PlaceProvider.search(query, near)에
 * 위임한다(near = 지도 중심/GPS, 기본은 mockPlaceProvider).
 *
 * 데이터는 PlaceProvider 계약으로 주입. 라우트 배선·실 서비스 연결은 app/search.tsx.
 * **구글 데이터 요청 없음**(§11 lazy 방어선 — 검색은 카카오/구글 장소 리스트만).
 */
import React, { useCallback, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  FlatList,
  StyleSheet,
} from 'react-native';
import type { CameraState, LatLng, Place } from '@wayfinder/shared';
import { mockPlaceProvider } from '@wayfinder/shared/mocks';
import { cameraForPlace } from './searchCamera.js';
import { usePlaceSearch } from '../state/placeSearch.js';
import { placeSubtitle, splitMatch } from '../search/format.js';
import { pushRecent, recentStore, removeRecent } from '../search/recentSearches.js';

export const SEARCH_PLACEHOLDER = '장소·주소 검색';

export interface SearchScreenProps {
  /** 검색 공급자 (기본: 데모 모드 mock provider). */
  provider?: { search(query: string, near?: LatLng): Promise<Place[]> };
  /** 검색 기준 좌표(지도 중심 또는 GPS) — 프록시가 거리순 정렬·거리 표시에 쓴다. */
  near?: LatLng;
  /** 장소 선택 시 호출 — 핀 표시 + 카메라 이동(HomeScreen이 소비). */
  onSelectPlace?: (place: Place, camera: CameraState) => void;
  /** 뒤로/취소. */
  onCancel?: () => void;
}

export function SearchScreen({
  provider = mockPlaceProvider,
  near,
  onSelectPlace,
  onCancel,
}: SearchScreenProps): React.ReactElement {
  const [query, setQuery] = useState('');
  const [recents, setRecents] = useState<string[]>(() => recentStore.load());
  const { results, status, setQuery: runSearch } = usePlaceSearch(provider, near);

  const handleChange = (text: string): void => {
    setQuery(text);
    runSearch(text);
  };

  const remember = useCallback((q: string) => {
    setRecents((prev) => {
      const next = pushRecent(prev, q);
      recentStore.save(next);
      return next;
    });
  }, []);

  const handleSelect = useCallback(
    (place: Place) => {
      remember(query);
      onSelectPlace?.(place, cameraForPlace(place));
    },
    [onSelectPlace, remember, query],
  );

  const handleDeleteRecent = useCallback((q: string) => {
    setRecents((prev) => {
      const next = removeRecent(prev, q);
      recentStore.save(next);
      return next;
    });
  }, []);

  const showRecents = query.trim().length === 0;

  return (
    <View style={styles.root}>
      <View style={styles.searchBar}>
        <TextInput
          style={styles.input}
          value={query}
          onChangeText={handleChange}
          onSubmitEditing={() => remember(query)}
          placeholder={SEARCH_PLACEHOLDER}
          placeholderTextColor="#6b7280"
          autoFocus
          returnKeyType="search"
          accessibilityLabel="검색어 입력"
        />
        {onCancel ? (
          <Pressable
            onPress={onCancel}
            accessibilityRole="button"
            accessibilityLabel="검색 취소"
            style={styles.cancel}
          >
            <Text style={styles.cancelText}>취소</Text>
          </Pressable>
        ) : null}
      </View>

      {showRecents ? (
        <FlatList
          data={recents}
          keyExtractor={(q) => q}
          keyboardShouldPersistTaps="handled"
          ListHeaderComponent={recents.length > 0 ? <Text style={styles.sectionTitle}>최근 검색</Text> : null}
          ListEmptyComponent={<Text style={styles.empty}>최근 검색 기록이 없어요.</Text>}
          renderItem={({ item }) => (
            <View style={styles.recentRow}>
              <Pressable
                style={styles.recentMain}
                onPress={() => handleChange(item)}
                accessibilityRole="button"
                accessibilityLabel={`최근 검색어 ${item}`}
              >
                <Text style={styles.recentText} numberOfLines={1}>
                  {item}
                </Text>
              </Pressable>
              <Pressable
                style={styles.recentDelete}
                onPress={() => handleDeleteRecent(item)}
                accessibilityRole="button"
                accessibilityLabel={`${item} 삭제`}
              >
                <Text style={styles.recentDeleteText}>✕</Text>
              </Pressable>
            </View>
          )}
        />
      ) : (
        <FlatList
          data={results}
          keyExtractor={(item) => item.id}
          keyboardShouldPersistTaps="handled"
          ListEmptyComponent={
            status === 'idle' ? null : <Text style={styles.empty}>{EMPTY_TEXT[status]}</Text>
          }
          renderItem={({ item }) => (
            <Pressable
              style={styles.row}
              onPress={() => handleSelect(item)}
              accessibilityRole="button"
              accessibilityLabel={item.name}
            >
              <Text style={styles.name} numberOfLines={1}>
                {splitMatch(item.name, query).map((seg, i) => (
                  <Text key={i} style={seg.match ? styles.nameMatch : undefined}>
                    {seg.text}
                  </Text>
                ))}
              </Text>
              <Text style={styles.sub} numberOfLines={1}>
                {placeSubtitle(item)}
              </Text>
            </Pressable>
          )}
        />
      )}
    </View>
  );
}

const EMPTY_TEXT = {
  loading: '검색 중…',
  done: '검색 결과가 없어요.',
  error: '검색에 실패했어요. 잠시 후 다시 시도해 주세요.',
} as const;

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#fff' },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#e5e7eb',
  },
  input: {
    flex: 1,
    minHeight: 44,
    backgroundColor: '#f2f3f5',
    borderRadius: 8,
    paddingHorizontal: 12,
    fontSize: 16,
    color: '#111',
  },
  cancel: { minWidth: 44, minHeight: 44, paddingLeft: 12, justifyContent: 'center', alignItems: 'flex-end' },
  cancelText: { fontSize: 15, color: '#1a73e8' },
  sectionTitle: { paddingHorizontal: 16, paddingTop: 12, paddingBottom: 4, fontSize: 13, fontWeight: '600', color: '#6b7280' },
  empty: { padding: 24, textAlign: 'center', color: '#6b7280', fontSize: 14 },
  row: {
    minHeight: 56,
    justifyContent: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#f0f0f0',
  },
  name: { fontSize: 16, color: '#111', fontWeight: '400' },
  nameMatch: { fontWeight: '700' },
  sub: { fontSize: 13, color: '#6b7280', marginTop: 2 },
  recentRow: { flexDirection: 'row', alignItems: 'center', minHeight: 48 },
  recentMain: { flex: 1, minHeight: 48, justifyContent: 'center', paddingHorizontal: 16 },
  recentText: { fontSize: 15, color: '#111' },
  recentDelete: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  recentDeleteText: { fontSize: 14, color: '#6b7280' },
});
