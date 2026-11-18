/**
 * 장소 상세 시트의 로딩·오류 상태 — 이름은 URL 힌트로 바로 보여주고,
 * 실패하면 [다시 시도] [닫기]를 낸다(404는 재시도 없이 바로 여기로).
 */
import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';

export interface PlaceSheetStatusProps {
  name?: string;
  state: 'loading' | 'error';
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
  return (
    <View style={styles.root}>
      <Text style={styles.name} numberOfLines={2}>
        {name ?? '장소 정보'}
      </Text>
      <Text style={styles.message}>{failed ? '장소 정보를 불러오지 못했어요.' : '불러오는 중이에요…'}</Text>
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
