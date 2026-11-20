/**
 * 장소 상세 시트의 로딩·오류 상태 — 이름은 URL 힌트로 바로 보여주고,
 * 실패하면 [다시 시도] [닫기]를 낸다. 404(없는 장소·힌트 없는 링크)는 다시 해도 같아 [닫기]만.
 */
import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';

export interface PlaceSheetStatusProps {
  name?: string;
  state: 'loading' | 'error' | 'notFound';
  /** 다시 시도 중이면 로딩 문구로 바꾼다. */
  retrying?: boolean;
  onRetry?: () => void;
  onClose?: () => void;
}

export function PlaceSheetStatus({
  name,
  state,
  retrying = false,
  onRetry,
  onClose,
}: PlaceSheetStatusProps): React.ReactElement {
  const failed = state === 'error' && !retrying;
  const message =
    state === 'notFound' ? NOT_FOUND_TEXT : failed ? '장소 정보를 불러오지 못했어요.' : '불러오는 중이에요…';
  return (
    <View style={styles.root}>
      <Text style={styles.name} numberOfLines={2}>
        {name ?? '장소 정보'}
      </Text>
      <Text style={styles.message}>{message}</Text>
      <View style={styles.row}>
        {failed ? (
          <Pressable
            style={[styles.btn, styles.btnFilled]}
            onPress={onRetry}
            accessibilityRole="button"
            accessibilityLabel="다시 시도"
          >
            <Text style={styles.btnFilledText}>다시 시도</Text>
          </Pressable>
        ) : null}
        <Pressable
          style={[styles.btn, styles.btnOutline]}
          onPress={onClose}
          accessibilityRole="button"
          accessibilityLabel="닫기"
        >
          <Text style={styles.btnOutlineText}>닫기</Text>
        </Pressable>
      </View>
    </View>
  );
}

export const NOT_FOUND_TEXT = '이 장소를 찾을 수 없어요. 링크가 잘못됐거나 장소 정보가 바뀌었을 수 있어요.';

const styles = StyleSheet.create({
  root: { paddingHorizontal: 16, paddingBottom: 16 },
  name: { fontSize: 20, fontWeight: '700', color: '#111' },
  message: { fontSize: 14, color: '#6b7280', marginTop: 6 },
  row: { flexDirection: 'row', gap: 8, marginTop: 12 },
  btn: { flex: 1, minHeight: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  btnFilled: { backgroundColor: '#1a56db' },
  btnFilledText: { fontSize: 15, fontWeight: '700', color: '#fff' },
  btnOutline: { borderWidth: 1, borderColor: '#9ca3af', backgroundColor: '#fff' },
  btnOutlineText: { fontSize: 15, fontWeight: '600', color: '#374151' },
});
