/**
 * PlaceDetail 라우트 — /place/[id] (E3).
 *
 * 모달 presentation으로 진입(_layout.tsx 설정).
 * C3 PlaceDetailSheet에 배선(시그니처 불변). 상세 데이터는 D4 usePlaceDetailQuery(데모 모드 →
 * mockPlaceProvider). 구글 평점·리뷰는 PlaceDetailSheet 내부에서 lazy 로드되며,
 * loadGoogle 어댑터로 getGoogleData(id)를 주입한다(구글 탭 활성 시에만 호출).
 *
 * 정적 export(SSR/prerender) 시 detail은 한동안 undefined이므로 가드 후 렌더한다 —
 * 가드 없이 detail.name을 참조하면 export가 크래시한다.
 */
import React, { useCallback } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import type { PlaceDetail } from '@wayfinder/shared';
import { PlaceDetailSheet, type GoogleData } from '../../src/screens/PlaceDetailSheet';
import { usePlaceDetailQuery } from '../../src/state/queries';
import { getGoogleData } from '../../src/services/PlaceService';

export default function PlaceDetailRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const placeId = id ?? null;
  const { data: detail, isError } = usePlaceDetailQuery(placeId);

  const loadGoogle = useCallback(
    (): Promise<GoogleData> => getGoogleData(id),
    [id],
  );

  const onOpenRoadview = useCallback(
    (d: PlaceDetail) => router.push(`/roadview/${encodeURIComponent(d.id)}`),
    [router],
  );

  const onClose = useCallback(() => router.back(), [router]);

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

  return (
    <PlaceDetailSheet
      detail={detail}
      loadGoogle={loadGoogle}
      onOpenRoadview={onOpenRoadview}
      onClose={onClose}
    />
  );
}

const styles = StyleSheet.create({
  fallback: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#fff' },
  fallbackText: { fontSize: 14, color: '#888' },
});
