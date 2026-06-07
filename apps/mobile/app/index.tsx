/**
 * Home 라우트 — / (E2).
 *
 * src/screens/HomeScreen 미존재: 인라인 placeholder.
 * 스트림 C(C1)가 HomeScreen을 완성하면 아래 import로 교체한다:
 *   import HomeScreen from '../src/screens/HomeScreen';
 */
import React from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { useRouter } from 'expo-router';

export default function HomeRoute() {
  const router = useRouter();

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Wayfinder</Text>
      <Text style={styles.subtitle}>지도 홈 (placeholder)</Text>
      <Pressable style={styles.button} onPress={() => router.push('/search')}>
        <Text style={styles.buttonText}>검색으로 이동</Text>
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
