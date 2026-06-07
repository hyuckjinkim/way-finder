/**
 * Roadview 라우트 — /roadview/[id] (E3).
 *
 * 장소 상세에서 전용 화면으로 진입(설계 문서 §5).
 * C5 RoadviewScreen에 배선(시그니처 불변). 상세 데이터는 D4 usePlaceDetailQuery(데모 모드 →
 * mockPlaceProvider). 데모 모드는 kakaoJsKey 미주입 → placeholder 렌더.
 *
 * 정적 export 시 detail이 한동안 undefined이므로 가드 후 렌더한다(detail.coord 참조 보호).
 */
import React, { useCallback } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { RoadviewScreen } from '../../src/screens/RoadviewScreen';
import { usePlaceDetailQuery } from '../../src/state/queries';

export default function RoadviewRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const placeId = id ?? null;
  const { data: detail, isError } = usePlaceDetailQuery(placeId);

  const onBack = useCallback(() => router.back(), [router]);

  if (isError) {
    return (
      <View style={styles.fallback}>
        <Text style={styles.fallbackText}>장소를 불러올 수 없어요.</Text>
      </View>
    );
  }

  if (!detail) {
    return (
      <View style={styles.fallback}>
        <Text style={styles.fallbackText}>불러오는 중…</Text>
      </View>
    );
  }

  return <RoadviewScreen detail={detail} onBack={onBack} />;
}

const styles = StyleSheet.create({
  fallback: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#111' },
  fallbackText: { fontSize: 14, color: '#aaa' },
});
