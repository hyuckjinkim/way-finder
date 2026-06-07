/**
 * Search 라우트 — /search (E2).
 *
 * src/screens/SearchScreen 미존재: 인라인 placeholder.
 * 스트림 C(C2)가 SearchScreen을 완성하면 아래 import로 교체한다:
 *   import SearchScreen from '../src/screens/SearchScreen';
 */
import React from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { useRouter } from 'expo-router';

export default function SearchRoute() {
  const router = useRouter();

  return (
    <View style={styles.container}>
      <Text style={styles.title}>검색</Text>
      <Text style={styles.subtitle}>SearchScreen (placeholder)</Text>
      <Pressable
        style={styles.button}
        onPress={() => router.push('/place/kakao:26338954')}
      >
        <Text style={styles.buttonText}>장소 상세 (demo)</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#f5f5f5' },
  title: { fontSize: 24, fontWeight: 'bold', color: '#333' },
  subtitle: { fontSize: 14, color: '#888', marginTop: 4, marginBottom: 24 },
  button: { backgroundColor: '#2563eb', paddingHorizontal: 20, paddingVertical: 10, borderRadius: 8 },
  buttonText: { color: '#fff', fontSize: 16 },
});
