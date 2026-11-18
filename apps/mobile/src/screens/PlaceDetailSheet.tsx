/**
 * PlaceDetailSheet — 장소 상세 바텀시트 (C3).
 *
 * 라이브러리 확정(계획 C3): Reanimated 의존 없는 **plain RN View 기반**. 시트의 드래그 핸들·스냅·
 * 데스크톱 카드는 바깥 OverlayPanel이 담당하고, 이 컴포넌트는 내용(헤더·액션·탭)만 그린다.
 * gorhom/BottomSheet 금지(Reanimated 4 / gesture-handler 네이티브 피어가 WSL 웹 export 위협).
 * 탭도 View 기반 segmented control 자체 구현(SegmentedTabs).
 *
 * 데이터는 props 주입(PlaceDetail). 구글 평점·리뷰는 **구글 탭이 활성일 때만** 마운트되는
 * GoogleTab을 통해 lazy 로드된다(§11). 구글 로더는 props(loadGoogle)로 주입되어
 * 검색·상세 진입 단계에서 호출되지 않음을 테스트로 검증한다.
 *
 * 통합(E3): 라우트 배선·실제 데이터 연결은 스트림 E가 담당. 이 화면은 props/계약만 노출.
 */
import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, ScrollView, Pressable, Platform, StyleSheet } from 'react-native';
import * as Linking from 'expo-linking';
import type { PlaceDetail, Rating, Review } from '@wayfinder/shared';
import { SegmentedTabs } from '../components/SegmentedTabs.js';
import { GoogleTab } from '../components/GoogleTab.js';
import { NaverTab } from '../components/NaverTab.js';
import { KakaoTab } from '../components/KakaoTab.js';
import { canCopyText, copyText, telUrl } from '../search/placeActions.js';
import type { GoogleLoadState, PlatformTabId } from '../components/platformTabs.js';
import {
  defaultActiveTab,
  shouldLoadGoogle,
  visibleTabs,
} from '../components/platformTabs.js';

/** 구글 lazy 로드 결과. */
export interface GoogleData {
  rating?: Rating;
  reviews: Review[];
}

export interface PlaceDetailSheetProps {
  detail: PlaceDetail;
  /**
   * 구글 평점·리뷰 lazy 로더 (구글 탭 활성화 시에만 호출, §11).
   * 미주입 시 detail에 이미 담긴 값을 즉시 사용(데모 모드 — 단, 호출은 여전히 탭 활성 시점).
   */
  loadGoogle?: () => Promise<GoogleData>;
  /** 로드뷰 전용 화면 진입 (C5 RoadviewScreen으로 네비게이션 — 타깃은 E가 배선). */
  onOpenRoadview?: (detail: PlaceDetail) => void;
  /** 이 장소를 출발지로 경로 입력 열기. */
  onSetOrigin?: (detail: PlaceDetail) => void;
  /** 이 장소를 도착지로 경로 입력 열기. */
  onSetDestination?: (detail: PlaceDetail) => void;
  /** 외부 딥링크 열기 주입(테스트용). */
  onOpenLink?: (url: string) => void;
  /** 시트 닫기. */
  onClose?: () => void;
}

export function PlaceDetailSheet({
  detail,
  loadGoogle,
  onOpenRoadview,
  onSetOrigin,
  onSetDestination,
  onOpenLink,
  onClose,
}: PlaceDetailSheetProps): React.ReactElement {
  const tabs = visibleTabs(detail);
  const [active, setActive] = useState<PlatformTabId>(() => defaultActiveTab(detail));
  const [googleState, setGoogleState] = useState<GoogleLoadState>('idle');
  const [googleData, setGoogleData] = useState<GoogleData>({ reviews: [] });
  const [copied, setCopied] = useState<boolean | null>(null);
  const phoneUrl = detail.phone ? telUrl(detail.phone) : undefined;

  // 구글 데이터 lazy 로드: 구글 탭이 활성이고 아직 idle일 때만 1회 요청.
  const requestGoogle = useCallback(() => {
    if (!shouldLoadGoogle('google', googleState)) {
      return;
    }
    setGoogleState('loading');
    const loader =
      loadGoogle ??
      (async (): Promise<GoogleData> => ({
        rating: detail.rating,
        reviews: detail.reviews,
      }));
    loader()
      .then((data) => {
        setGoogleData(data);
        setGoogleState('loaded');
      })
      .catch(() => {
        setGoogleState('error');
      });
  }, [googleState, loadGoogle, detail.rating, detail.reviews]);

  // 활성 탭이 가시 탭에서 사라지면(외부 detail 교체 등) 기본 탭으로 복구.
  useEffect(() => {
    if (!tabs.includes(active)) {
      setActive(defaultActiveTab(detail));
    }
  }, [tabs, active, detail]);

  const callPhone = (): void => {
    if (!phoneUrl) return;
    if (onOpenLink) onOpenLink(phoneUrl);
    else if (Platform.OS === 'web') window.location.href = phoneUrl;
    else void Linking.openURL(phoneUrl);
  };

  const copyAddress = (): void => {
    void copyText(detail.address).then((ok) => {
      setCopied(ok);
      setTimeout(() => setCopied(null), 2000);
    });
  };

  return (
    <ScrollView style={styles.sheet} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <View style={styles.headerText}>
          <Text style={styles.name}>{detail.name}</Text>
          <Text style={styles.meta}>
            {detail.category} · {detail.address}
          </Text>
          {detail.phone ? (
            <Pressable
              onPress={callPhone}
              accessibilityRole="link"
              accessibilityLabel={`전화 걸기 ${detail.phone}`}
              style={styles.phoneRow}
            >
              <Text style={styles.phone}>{detail.phone}</Text>
            </Pressable>
          ) : null}
        </View>
        {onClose ? (
          <Pressable
            onPress={onClose}
            accessibilityRole="button"
            accessibilityLabel="닫기"
            style={styles.close}
          >
            <Text style={styles.closeText}>✕</Text>
          </Pressable>
        ) : null}
      </View>

      <View style={styles.routeRow}>
        <Pressable
          style={[styles.routeBtn, styles.routeBtnOutline]}
          onPress={() => onSetOrigin?.(detail)}
          accessibilityRole="button"
          accessibilityLabel="출발지로 설정"
        >
          <Text style={styles.routeBtnOutlineText}>출발</Text>
        </Pressable>
        <Pressable
          style={[styles.routeBtn, styles.routeBtnFilled]}
          onPress={() => onSetDestination?.(detail)}
          accessibilityRole="button"
          accessibilityLabel="도착지로 설정"
        >
          <Text style={styles.routeBtnFilledText}>도착</Text>
        </Pressable>
      </View>

      <View style={styles.chipRow}>
        {canCopyText() ? (
          <Pressable
            style={styles.chip}
            onPress={copyAddress}
            accessibilityRole="button"
            accessibilityLabel="주소 복사"
          >
            <Text style={styles.chipText}>
              {copied === null ? '주소 복사' : copied ? '복사했어요' : '복사하지 못했어요'}
            </Text>
          </Pressable>
        ) : null}
        <Pressable
          style={styles.chip}
          onPress={() => onOpenRoadview?.(detail)}
          accessibilityRole="button"
          accessibilityLabel={detail.roadview ? '로드뷰 보기' : '스트리트뷰 보기'}
        >
          <Text style={styles.chipText}>{detail.roadview ? '로드뷰 보기' : '스트리트뷰 보기'}</Text>
        </Pressable>
      </View>

      <SegmentedTabs tabs={tabs} active={active} onChange={setActive} />

      <View style={styles.body}>
        {active === 'naver' ? (
          <NaverTab
            posts={detail.blogs.naver}
            moreUrl={detail.links.naverPlace}
            onOpenLink={onOpenLink}
          />
        ) : null}
        {active === 'kakao' ? (
          <KakaoTab
            posts={detail.blogs.kakao}
            moreUrl={detail.links.kakaoMap}
            onOpenLink={onOpenLink}
          />
        ) : null}
        {active === 'google' ? (
          <GoogleTab
            state={googleState}
            rating={googleData.rating}
            reviews={googleData.reviews}
            onRequestLoad={requestGoogle}
          />
        ) : null}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  sheet: { flexShrink: 1 },
  content: { paddingHorizontal: 16, paddingBottom: 16 },
  header: { flexDirection: 'row', alignItems: 'flex-start' },
  headerText: { flex: 1 },
  name: { fontSize: 20, fontWeight: '700', color: '#111' },
  meta: { fontSize: 13, color: '#6b7280', marginTop: 4 },
  phoneRow: { minHeight: 44, justifyContent: 'center', alignSelf: 'flex-start' },
  phone: { fontSize: 14, color: '#1a56db', textDecorationLine: 'underline' },
  close: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center', marginRight: -8 },
  closeText: { fontSize: 18, color: '#4b5563' },
  routeRow: { flexDirection: 'row', gap: 8, marginTop: 8 },
  routeBtn: { flex: 1, minHeight: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  routeBtnOutline: { borderWidth: 1, borderColor: '#1a56db', backgroundColor: '#fff' },
  routeBtnOutlineText: { fontSize: 15, fontWeight: '700', color: '#1a56db' },
  routeBtnFilled: { backgroundColor: '#1a56db' },
  routeBtnFilledText: { fontSize: 15, fontWeight: '700', color: '#fff' },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 8, marginBottom: 8 },
  chip: {
    minHeight: 44,
    paddingHorizontal: 14,
    borderRadius: 8,
    backgroundColor: '#f2f4f7',
    alignItems: 'center',
    justifyContent: 'center',
  },
  chipText: { fontSize: 14, fontWeight: '600', color: '#374151' },
  body: { marginTop: 8 },
});
