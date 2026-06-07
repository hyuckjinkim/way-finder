/**
 * Deeplink — "더보기" 외부 링크 버튼 (C4).
 *
 * 플랫폼 탭 하단의 "더보기" 동작. URL은 props로 주입(또는 PlaceLinks에서 해석),
 * 실제 열기는 expo-linking으로 위임한다. URL 생성 로직은 ./deeplink.ts(순수)에 있다.
 */
import React, { useCallback } from 'react';
import { Pressable, Text, StyleSheet } from 'react-native';
import * as Linking from 'expo-linking';

export interface DeeplinkProps {
  /** 열 외부 URL. undefined면 버튼을 렌더하지 않는다(링크 미제공). */
  url: string | undefined;
  /** 버튼 라벨 (예: "네이버에서 더보기"). */
  label: string;
  /**
   * 열기 동작 주입 훅 (테스트/스토리북용). 기본은 expo-linking.
   */
  onOpen?: (url: string) => void;
}

export function Deeplink({ url, label, onOpen }: DeeplinkProps): React.ReactElement | null {
  const handlePress = useCallback(() => {
    if (!url) {
      return;
    }
    if (onOpen) {
      onOpen(url);
      return;
    }
    void Linking.openURL(url);
  }, [url, onOpen]);

  if (!url) {
    return null;
  }

  return (
    <Pressable
      style={styles.button}
      onPress={handlePress}
      accessibilityRole="link"
      accessibilityLabel={label}
    >
      <Text style={styles.label}>{label} ›</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    paddingVertical: 10,
    paddingHorizontal: 12,
    alignSelf: 'flex-start',
  },
  label: {
    fontSize: 14,
    color: '#1a73e8',
    fontWeight: '500',
  },
});
