/**
 * RoadviewScreen — 로드뷰 전용 화면 (C5, M1).
 *
 * 스펙 §5: 장소 상세에서 **전용 화면**으로 진입.
 * - 한국(detail.roadview 존재): 카카오 로드뷰. 웹 Kakao JS API가 들어갈 자리이나,
 *   JS 키 0개(데모 모드)면 좌표 + 안내 placeholder를 렌더(키 발급 후 실 로드뷰로 교체).
 *   네이티브 SDK는 typecheck-only(§12) — 이 화면은 placeholder/딥링크만 담당.
 * - 글로벌(roadview 없음): 구글 스트리트뷰 **딥링크** 진입 버튼.
 *
 * 데이터는 props 주입. 라우트 배선은 스트림 E(E2/E3)가 담당.
 */
import React, { useCallback } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import * as Linking from 'expo-linking';
import type { PlaceDetail } from '@wayfinder/shared';
import { selectRoadviewMode } from './roadview.js';
import { buildStreetViewUrl } from '../components/deeplinks.js';

export interface RoadviewScreenProps {
  detail: PlaceDetail;
  /**
   * 카카오 JS 지도 키 (웹 로드뷰). 미설정(데모 모드)이면 placeholder 렌더.
   */
  kakaoJsKey?: string;
  /** 스트리트뷰 딥링크 열기 주입(테스트용). 기본은 expo-linking. */
  onOpenLink?: (url: string) => void;
  /** 뒤로가기. */
  onBack?: () => void;
}

export function RoadviewScreen({
  detail,
  kakaoJsKey,
  onOpenLink,
  onBack,
}: RoadviewScreenProps): React.ReactElement {
  const mode = selectRoadviewMode(detail);

  const openStreetView = useCallback(() => {
    const url = buildStreetViewUrl(detail.coord);
    if (onOpenLink) {
      onOpenLink(url);
      return;
    }
    void Linking.openURL(url);
  }, [detail.coord, onOpenLink]);

  return (
    <View style={styles.root}>
      <View style={styles.header}>
        {onBack ? (
          <Pressable
            onPress={onBack}
            accessibilityRole="button"
            accessibilityLabel="뒤로"
            style={styles.back}
          >
            <Text style={styles.backText}>‹ 뒤로</Text>
          </Pressable>
        ) : null}
        <Text style={styles.title} numberOfLines={1}>
          {detail.name}
        </Text>
      </View>

      {mode === 'kakao-roadview' ? (
        <View style={styles.canvas}>
          {kakaoJsKey ? (
            // 실 모드: 여기에 Kakao JS Roadview가 마운트됨(B 스트림 웹 로더 연동).
            <Text style={styles.note}>카카오 로드뷰 (키 연동)</Text>
          ) : (
            <View style={styles.placeholder}>
              <Text style={styles.placeholderTitle}>카카오 로드뷰</Text>
              <Text style={styles.placeholderText}>
                데모 모드 — JS 키가 없어 로드뷰 미리보기를 표시할 수 없어요.
              </Text>
              <Text style={styles.coord}>
                {detail.roadview?.lat.toFixed(5)}, {detail.roadview?.lng.toFixed(5)}
              </Text>
            </View>
          )}
        </View>
      ) : (
        <View style={styles.canvas}>
          <View style={styles.placeholder}>
            <Text style={styles.placeholderTitle}>구글 스트리트뷰</Text>
            <Text style={styles.placeholderText}>
              이 장소는 구글 스트리트뷰에서 볼 수 있어요.
            </Text>
            <Pressable
              style={styles.linkBtn}
              onPress={openStreetView}
              accessibilityRole="link"
              accessibilityLabel="구글 스트리트뷰 열기"
            >
              <Text style={styles.linkBtnText}>스트리트뷰 열기 ›</Text>
            </Pressable>
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#fff' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#eee',
  },
  back: { paddingRight: 8 },
  backText: { fontSize: 16, color: '#1a73e8' },
  title: { flex: 1, fontSize: 16, fontWeight: '600', color: '#111' },
  canvas: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f4f5f7',
  },
  note: { fontSize: 14, color: '#555' },
  placeholder: { alignItems: 'center', padding: 24 },
  placeholderTitle: { fontSize: 18, fontWeight: '700', color: '#333' },
  placeholderText: {
    fontSize: 14,
    color: '#777',
    marginTop: 8,
    textAlign: 'center',
  },
  coord: { fontSize: 13, color: '#999', marginTop: 12 },
  linkBtn: {
    marginTop: 16,
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
    backgroundColor: '#1a73e8',
  },
  linkBtnText: { fontSize: 14, color: '#fff', fontWeight: '600' },
});
