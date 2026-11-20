/**
 * SearchScreen — 검색 화면 (C2).
 *
 * 입력 전엔 저장한 장소(F1, ✕로 삭제) 위에 최근 검색(최대 10, 개별 삭제), 입력하면 자동완성 리스트.
 * ponytail: 저장한 장소는 ✕로만 지운다 — 스와이프 삭제는 제스처 라이브러리 없이 웹·네이티브 둘 다 하려면 비싸다.
 * 결과 행: `업종 · 거리 · 주소`, 일치한 글자는 굵게. 검색은 PlaceProvider.search(query, near)에
 * 위임한다(near = 지도 중심/GPS, 기본은 mockPlaceProvider).
 *
 * 데이터는 PlaceProvider 계약으로 주입. 라우트 배선·실 서비스 연결은 app/search.tsx.
 * **구글 데이터 요청 없음**(§11 lazy 방어선 — 검색은 카카오/구글 장소 리스트만).
 */
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  FlatList,
  Platform,
  StyleSheet,
} from 'react-native';
import type { CameraState, LatLng, Place } from '@wayfinder/shared';
import { mockPlaceProvider } from '@wayfinder/shared/mocks';
import { cameraForPlace } from './searchCamera.js';
import { usePlaceSearch } from '../state/placeSearch.js';
import { placeSubtitle, splitMatch } from '../search/format.js';
import { pushRecent, recentStore, removeRecent } from '../search/recentSearches.js';
import { favoriteStore, removeFavorite, useFavorites, type SavedPlace } from '../favorites/favorites.js';

export const SEARCH_PLACEHOLDER = '장소·주소 검색';
// 결과·최근 검색 행 공통 표식(웹 data-testid) — 방향키 이동 대상.
const ROW_ID = 'search-row';

/** 웹 키보드: 입력창·행에서 ↑/↓로 행 사이 이동(맨 위에서 ↑ = 입력창). Enter는 행(Pressable)이 직접 처리. */
function useArrowNavigation(rootRef: React.RefObject<View | null>): void {
  useEffect(() => {
    const root = rootRef.current as unknown as HTMLElement | null;
    if (Platform.OS !== 'web' || !root?.addEventListener) return;
    const onKey = (e: KeyboardEvent): void => {
      if ((e.key !== 'ArrowDown' && e.key !== 'ArrowUp') || e.isComposing) return;
      const rows = [...root.querySelectorAll<HTMLElement>(`[data-testid="${ROW_ID}"]`)];
      if (rows.length === 0) return;
      e.preventDefault();
      const at = rows.indexOf(document.activeElement as HTMLElement);
      const next = at + (e.key === 'ArrowDown' ? 1 : -1);
      if (next < 0) root.querySelector('input')?.focus();
      else rows[Math.min(next, rows.length - 1)]!.focus();
    };
    root.addEventListener('keydown', onKey);
    return () => root.removeEventListener('keydown', onKey);
  }, [rootRef]);
}

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
  const favorites = useFavorites();
  const { results, status, setQuery: runSearch } = usePlaceSearch(provider, near);
  const rootRef = useRef<View>(null);
  const inputRef = useRef<TextInput>(null);
  useArrowNavigation(rootRef);

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

  // 저장한 장소는 검색어 없이 바로 연다 — 검색 결과와 같은 경로(placeHref 힌트 포함).
  const openSaved = useCallback(
    (place: SavedPlace) => onSelectPlace?.(place, cameraForPlace(place)),
    [onSelectPlace],
  );

  const showRecents = query.trim().length === 0;

  // Enter: 결과가 있으면 첫 결과를 연다.
  const handleSubmit = (): void => {
    if (!showRecents && results[0]) handleSelect(results[0]);
    else remember(query);
  };

  const clear = (): void => {
    handleChange('');
    inputRef.current?.focus();
  };

  return (
    <View style={styles.root} ref={rootRef}>
      <View style={styles.searchBar}>
        <View style={styles.inputWrap}>
          <TextInput
            ref={inputRef}
            style={styles.input}
            value={query}
            onChangeText={handleChange}
            onSubmitEditing={handleSubmit}
            placeholder={SEARCH_PLACEHOLDER}
            placeholderTextColor={PLACEHOLDER_COLOR}
            autoFocus
            returnKeyType="search"
            accessibilityLabel="검색어 입력"
          />
          {query ? (
            <Pressable onPress={clear} accessibilityRole="button" accessibilityLabel="검색어 지우기" style={styles.clear}>
              <Text style={styles.clearText}>✕</Text>
            </Pressable>
          ) : null}
        </View>
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
          ListHeaderComponent={
            <>
              {favorites.length > 0 ? <Text style={styles.sectionTitle}>저장한 장소</Text> : null}
              {favorites.map((p) => (
                <View key={p.id} style={styles.recentRow}>
                  <Pressable
                    testID={ROW_ID}
                    style={styles.recentMain}
                    onPress={() => openSaved(p)}
                    accessibilityRole="button"
                    accessibilityLabel={`저장한 장소 ${p.name}`}
                  >
                    <Text style={styles.recentText} numberOfLines={1}>
                      {p.name}
                    </Text>
                    {p.address ? (
                      <Text style={styles.sub} numberOfLines={1}>
                        {p.address}
                      </Text>
                    ) : null}
                  </Pressable>
                  <Pressable
                    style={styles.recentDelete}
                    onPress={() => favoriteStore.save(removeFavorite(favorites, p.id))}
                    accessibilityRole="button"
                    accessibilityLabel={`저장한 장소 ${p.name} 삭제`}
                  >
                    <Text style={styles.recentDeleteText}>✕</Text>
                  </Pressable>
                </View>
              ))}
              {recents.length > 0 ? <Text style={styles.sectionTitle}>최근 검색</Text> : null}
            </>
          }
          ListEmptyComponent={
            favorites.length === 0 ? <Text style={styles.empty}>최근 검색 기록이 없어요.</Text> : null
          }
          renderItem={({ item }) => (
            <View style={styles.recentRow}>
              <Pressable
                testID={ROW_ID}
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
              testID={ROW_ID}
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
                {placeSubtitle(item, item.name)}
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

// #f2f3f5 입력 배경 위 5.5:1 (WCAG AA 4.5 이상; 이전 #6b7280은 4.39).
export const PLACEHOLDER_COLOR = '#5f6368';

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
  inputWrap: { flex: 1, flexDirection: 'row', alignItems: 'center', backgroundColor: '#f2f3f5', borderRadius: 8 },
  input: {
    flex: 1,
    minHeight: 44,
    borderRadius: 8,
    paddingHorizontal: 12,
    fontSize: 16,
    color: '#111',
  },
  clear: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  clearText: { fontSize: 14, color: '#4b5563' },
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
