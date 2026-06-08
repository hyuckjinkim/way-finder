/**
 * D2 — NavScreen 웹 비활성 안내 (.web.tsx Expo 플랫폼 분기).
 *
 * 스펙 §1: "P3+ 모바일 전용, 웹은 경로 표시까지."
 * 웹에서 NavScreen import 시 이 파일이 해석된다(vitest/Expo Metro 모두
 * .web.tsx를 .tsx보다 먼저 해석 — vitest.config.mts extensions 배열 참조).
 *
 * 동일 props 시그니처를 받아:
 * - "네비게이션은 모바일 앱에서 이용하세요" 안내 표시
 * - 경로 표시 폴백: RouteResultScreen 재사용 (P4 패턴)
 *
 * **expo-location 및 네이티브 nav 서비스를 절대 import하지 않는다.**
 * 이 파일은 웹 번들의 NavScreen 엔트리포인트 — 여기서 expo-location을
 * transitively라도 끌어오면 키 0개 웹 export가 깨진다.
 */
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import type { Route, NavState } from '@wayfinder/shared';
import { RouteResultScreen } from './RouteResultScreen.js';

export interface NavScreenProps {
  route: Route | null;
  navState: NavState;
  onExit?: () => void;
}

export function NavScreen({ route, onExit }: NavScreenProps): React.ReactElement {
  return (
    <View style={styles.root}>
      {/* 웹 비활성 안내 배너 */}
      <View style={styles.notice}>
        <Text style={styles.noticeTitle}>모바일 앱에서 이용하세요</Text>
        <Text style={styles.noticeBody}>
          네비게이션은 모바일 앱에서 이용할 수 있습니다.
        </Text>
      </View>

      {/* 경로 표시 폴백 — RouteResultScreen 재사용 */}
      <View style={styles.routeFallback}>
        <RouteResultScreen route={route} onBack={onExit ?? (() => {})} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  notice: {
    backgroundColor: '#e3f2fd',
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#90caf9',
    alignItems: 'center',
  },
  noticeTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#1565c0',
    marginBottom: 4,
  },
  noticeBody: {
    fontSize: 13,
    color: '#1976d2',
    textAlign: 'center',
  },
  routeFallback: { flex: 1 },
});
