/**
 * 경로 입력 라우트 — /route/input (E1).
 *
 * C2 RouteInputScreen이 완성되면 import하여 교체한다.
 * 현재는 placeholder stub — 홈→경로입력 네비 배선 검증용.
 */
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

export default function RouteInputRoute() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>경로 입력</Text>
      <Text style={styles.sub}>C2 RouteInputScreen 연결 대기 중</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 20, fontWeight: '600', marginBottom: 8 },
  sub: { fontSize: 14, color: '#666' },
});
