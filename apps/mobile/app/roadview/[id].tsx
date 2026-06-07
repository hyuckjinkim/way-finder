/**
 * Roadview 라우트 — /roadview/[id] (E2).
 *
 * 장소 상세(PlaceDetailSheet)에서 전용 화면으로 진입 (설계 문서 §5).
 * src/screens/RoadviewScreen 미존재: 인라인 placeholder.
 * 스트림 C(C5)가 RoadviewScreen을 완성하면 아래 import로 교체한다:
 *   import RoadviewScreen from '../../src/screens/RoadviewScreen';
 */
import React from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';

export default function RoadviewRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();

  return (
    <View style={styles.container}>
      <Text style={styles.title}>로드뷰</Text>
      <Text style={styles.subtitle}>RoadviewScreen (placeholder)</Text>
      <Text style={styles.id}>id: {id}</Text>
      <Pressable style={styles.button} onPress={() => router.back()}>
        <Text style={styles.buttonText}>뒤로</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#111', padding: 24 },
  title: { fontSize: 22, fontWeight: 'bold', color: '#fff' },
  subtitle: { fontSize: 13, color: '#aaa', marginTop: 4, marginBottom: 12 },
  id: { fontSize: 12, color: '#666', marginBottom: 24 },
  button: { backgroundColor: '#2563eb', paddingHorizontal: 20, paddingVertical: 10, borderRadius: 8 },
  buttonText: { color: '#fff', fontSize: 16 },
});
