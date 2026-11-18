/**
 * GoogleTab — 구글 평점 + 리뷰5 탭 (C4, lazy).
 *
 * 과금 방어선(§11): 구글 데이터는 **이 탭이 활성화될 때만** 요청한다. 따라서
 * 컴포넌트는 rating/reviews를 직접 props로 받지 않고, 마운트(=탭 활성화) 시
 * `onRequestLoad()`를 호출해 상위에 로드를 요청한다. 데이터는 load 상태로 주입된다.
 *
 * 상위(PlaceDetailSheet)는 구글 탭이 활성일 때만 이 컴포넌트를 마운트하므로,
 * 검색·상세 진입 단계에서는 구글 데이터 요청이 발생하지 않는다.
 * lazy 트리거 판정 로직은 ./platformTabs.ts(shouldLoadGoogle)에 분리되어 단위 검증된다.
 */
import React, { useEffect } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import type { Rating, Review } from '@wayfinder/shared';
import type { GoogleLoadState } from './platformTabs.js';

export interface GoogleTabProps {
  state: GoogleLoadState;
  rating?: Rating;
  reviews: Review[];
  /** 마운트(탭 활성화) 시 상위에 구글 데이터 로드를 요청. */
  onRequestLoad: () => void;
}

export function GoogleTab({
  state,
  rating,
  reviews,
  onRequestLoad,
}: GoogleTabProps): React.ReactElement {
  useEffect(() => {
    onRequestLoad();
  }, [onRequestLoad]);

  if (state === 'loading' || state === 'idle') {
    return (
      <View style={styles.empty}>
        <Text style={styles.emptyText}>구글 평점·리뷰를 불러오는 중…</Text>
      </View>
    );
  }

  // 쿼터 초과/실패 → degradation: 이 탭만 안내, 다른 탭 정상(§11).
  if (state === 'error') {
    return (
      <View style={styles.empty}>
        <Text style={styles.emptyText}>
          구글 평점·리뷰를 지금 불러올 수 없어요. 다른 탭을 확인해 주세요.
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {rating ? (
        <View style={styles.ratingRow}>
          <Text style={styles.score}>★ {rating.score.toFixed(1)}</Text>
          <Text style={styles.count}>리뷰 {rating.count.toLocaleString()}개</Text>
        </View>
      ) : null}
      {reviews.slice(0, 5).map((review, idx) => (
        <View key={`${review.author}-${idx}`} style={styles.review}>
          <Text style={styles.author}>
            {review.author} · ★ {review.rating}
          </Text>
          <Text style={styles.text}>{review.text}</Text>
        </View>
      ))}
      {!rating && reviews.length === 0 ? (
        <Text style={styles.emptyText}>구글 평점·리뷰가 없어요.</Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { paddingVertical: 4 },
  empty: { padding: 24, alignItems: 'center' },
  emptyText: { fontSize: 14, color: '#6b7280' },
  ratingRow: { flexDirection: 'row', alignItems: 'baseline', marginBottom: 8 },
  score: { fontSize: 20, fontWeight: '700', color: '#f5a623' },
  count: { fontSize: 13, color: '#6b7280', marginLeft: 8 },
  review: {
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#eee',
  },
  author: { fontSize: 13, fontWeight: '600', color: '#444' },
  text: { fontSize: 14, color: '#333', marginTop: 2 },
});
