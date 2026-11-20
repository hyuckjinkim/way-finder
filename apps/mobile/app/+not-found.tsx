/**
 * 없는 주소 — expo-router 기본(영어·다크 "Unmatched Route") 대신 앱 톤(해요체·라이트)으로.
 */
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Link, Stack } from 'expo-router';

export default function NotFound() {
  return (
    <View style={styles.root}>
      <Stack.Screen options={{ title: '페이지를 찾을 수 없어요', headerShown: false }} />
      <Text style={styles.title} role="heading">
        페이지를 찾을 수 없어요
      </Text>
      <Text style={styles.body}>주소가 바뀌었거나 잘못 입력된 것 같아요.</Text>
      <Link href="/" replace style={styles.link}>
        지도로 돌아가기
      </Link>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, backgroundColor: '#fff' },
  title: { fontSize: 20, fontWeight: '700', color: '#111' },
  body: { fontSize: 15, color: '#4b5563', marginTop: 8, textAlign: 'center' },
  link: { marginTop: 24, paddingVertical: 12, paddingHorizontal: 20, fontSize: 15, fontWeight: '600', color: '#1a73e8' },
});
