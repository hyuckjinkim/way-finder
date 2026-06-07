/**
 * 경로 결과 라우트 — /route/result (E1).
 *
 * D4 RouteResultScreen이 완성되면 import하여 교체한다.
 * 현재는 placeholder stub — 경로입력→결과 네비 배선 검증용.
 */
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

export default function RouteResultRoute() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>경로 결과</Text>
      <Text style={styles.sub}>D4 RouteResultScreen 연결 대기 중</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 20, fontWeight: '600', marginBottom: 8 },
  sub: { fontSize: 14, color: '#666' },
});
