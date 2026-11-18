/**
 * 닫을 수 있는 토스트 — 일정 시간 뒤 자동으로 사라진다.
 */
import React, { useEffect } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

export const TOAST_DURATION_MS = 6000;

export function Toast({
  message,
  onDismiss,
  top = 12,
}: {
  message: string;
  onDismiss: () => void;
  top?: number;
}): React.ReactElement {
  useEffect(() => {
    const t = setTimeout(onDismiss, TOAST_DURATION_MS);
    return () => clearTimeout(t);
  }, [message, onDismiss]);

  return (
    <View style={[styles.wrap, { top }]} pointerEvents="box-none">
      <View style={styles.toast} accessibilityRole="alert">
        <Text style={styles.text}>{message}</Text>
        <Pressable
          onPress={onDismiss}
          accessibilityRole="button"
          accessibilityLabel="알림 닫기"
          style={styles.close}
        >
          <Text style={styles.closeText}>✕</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { position: 'absolute', left: 12, right: 12, alignItems: 'center' },
  toast: {
    flexDirection: 'row',
    alignItems: 'center',
    maxWidth: 420,
    backgroundColor: '#1f2937',
    borderRadius: 12,
    paddingLeft: 16,
  },
  text: { flexShrink: 1, fontSize: 14, color: '#fff', paddingVertical: 12 },
  close: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  closeText: { fontSize: 14, color: '#d1d5db' },
});
