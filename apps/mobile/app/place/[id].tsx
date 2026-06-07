/**
 * PlaceDetail 라우트 — /place/[id] (E2).
 *
 * 모달 presentation으로 진입 (_layout.tsx에서 설정).
 * src/screens/PlaceDetailSheet 미존재: 인라인 placeholder.
 * 스트림 C(C3)가 PlaceDetailSheet를 완성하면 아래 import로 교체한다:
 *   import PlaceDetailSheet from '../../src/screens/PlaceDetailSheet';
 */
import React from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';

export default function PlaceDetailRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();

  return (
    <View style={styles.container}>
      <Text style={styles.title}>장소 상세</Text>
      <Text style={styles.subtitle}>PlaceDetailSheet (placeholder)</Text>
      <Text style={styles.id}>id: {id}</Text>
      <Pressable
        style={styles.button}
        onPress={() => router.push(`/roadview/${id}`)}
      >
        <Text style={styles.buttonText}>로드뷰 보기</Text>
      </Pressable>
      <Pressable style={[styles.button, styles.back]} onPress={() => router.back()}>
        <Text style={styles.buttonText}>닫기</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#fff', padding: 24 },
  title: { fontSize: 22, fontWeight: 'bold', color: '#333' },
  subtitle: { fontSize: 13, color: '#888', marginTop: 4, marginBottom: 12 },
  id: { fontSize: 12, color: '#aaa', marginBottom: 24 },
  button: { backgroundColor: '#2563eb', paddingHorizontal: 20, paddingVertical: 10, borderRadius: 8, marginBottom: 12, width: 200, alignItems: 'center' },
  back: { backgroundColor: '#6b7280' },
  buttonText: { color: '#fff', fontSize: 16 },
});
