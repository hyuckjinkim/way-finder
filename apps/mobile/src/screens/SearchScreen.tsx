/**
 * SearchScreen — 검색 화면 (C2).
 *
 * 자동완성 리스트(목 검색 결과) → 선택 시 핀 + 카메라 이동 콜백.
 * 한국어/영어 입력 모두 결과 표시(검색은 PlaceProvider.search에 위임 — 기본은 mockPlaceProvider).
 *
 * 데이터는 PlaceProvider 계약으로 주입(@wayfinder/shared/mocks의 mockPlaceProvider 기본).
 * 라우트 배선·실 서비스 연결은 스트림 D/E. 이 화면은 provider·콜백 계약만 노출한다.
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
import type { CameraState, Place } from '@wayfinder/shared';
import type { PlaceProvider } from '@wayfinder/shared/mocks';
import { mockPlaceProvider } from '@wayfinder/shared/mocks';
import { cameraForPlace } from './searchCamera.js';

export interface SearchScreenProps {
  /** 검색 공급자 (기본: 데모 모드 mock provider). */
  provider?: PlaceProvider;
  /** 장소 선택 시 호출 — 핀 표시 + 카메라 이동(HomeScreen이 소비). */
  onSelectPlace?: (place: Place, camera: CameraState) => void;
  /** 뒤로/취소. */
  onCancel?: () => void;
}

export function SearchScreen({
  provider = mockPlaceProvider,
  onSelectPlace,
  onCancel,
}: SearchScreenProps): React.ReactElement {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Place[]>([]);

  const handleChange = useCallback(
    (text: string) => {
      setQuery(text);
      void provider.search(text).then(setResults);
    },
    [provider],
  );

  const handleSelect = useCallback(
    (place: Place) => {
      onSelectPlace?.(place, cameraForPlace(place));
    },
    [onSelectPlace],
  );

  return (
    <View style={styles.root}>
      <View style={styles.searchBar}>
        <TextInput
          style={styles.input}
          value={query}
          onChangeText={handleChange}
          placeholder="장소·주소 검색 (한/영)"
          placeholderTextColor="#999"
          autoFocus
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

      <FlatList
        data={results}
        keyExtractor={(item) => item.id}
        keyboardShouldPersistTaps="handled"
        ListEmptyComponent={
          query.trim().length > 0 ? (
            <Text style={styles.empty}>검색 결과가 없어요.</Text>
          ) : null
        }
        renderItem={({ item }) => (
          <Pressable
            style={styles.row}
            onPress={() => handleSelect(item)}
            accessibilityRole="button"
            accessibilityLabel={item.name}
          >
            <Text style={styles.name}>{item.name}</Text>
            <Text style={styles.sub}>
              {item.category} · {item.address}
            </Text>
          </Pressable>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#fff' },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#eee',
  },
  input: {
    flex: 1,
    height: 40,
    backgroundColor: '#f2f3f5',
    borderRadius: 8,
    paddingHorizontal: 12,
    fontSize: 15,
    color: '#111',
  },
  cancel: { paddingLeft: 12 },
  cancelText: { fontSize: 15, color: '#1a73e8' },
  empty: { padding: 24, textAlign: 'center', color: '#999', fontSize: 14 },
  row: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#f0f0f0',
  },
  name: { fontSize: 16, color: '#111', fontWeight: '500' },
  sub: { fontSize: 13, color: '#777', marginTop: 2 },
});
