/**
 * D4 — RouteResultScreen.
 *
 * 경로 탐색 결과를 지도(폴리라인·마커·fitTo) + 결과 패널로 표시한다.
 * - 패널: 폰=하단 시트(내용 높이, 최대 55%, 스크롤) / 데스크톱(≥768)=좌측 카드.
 * - 대안 경로 목록(route + route.alternatives): 소요·도착 예정·요금·환승·도보 + 구간 바.
 *   선택한 경로의 단계 목록을 펼치고, 지도는 선택 경로로 다시 그린다.
 * - <MapView>는 src/map/MapView import만 (수정 금지, §8 D4 경계).
 */
import React, { useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  Pressable,
  StyleSheet,
  Platform,
  Linking,
  useWindowDimensions,
} from 'react-native';
import type { Route, RoutePreference, TravelMode } from '@wayfinder/shared';
import { transitErrorCode } from '@wayfinder/shared/transit';
import MapView from '../map/MapView';
import { routeToPolylines, boundsForRoute } from '../route/routeToPolylines.js';
import { routeSummary } from '../route/routeSummary.js';
import {
  DESKTOP_MIN_WIDTH,
  SIDE_CARD_WIDTH,
  arrivalTime,
  canStartNav,
  fitInsets,
  formatDistance,
  formatDuration,
  formatFare,
  formatMinutes,
  hasTransit,
  kakaoMapLink,
  readableTextColor,
  routeMarkers,
  routeStepItems,
  segmentBar,
  transitStepText,
  walkMinutes,
  type LinkStop,
} from '../route/routeResultView.js';
import { isModeUnavailable } from '../services/RouteService.js';

/** 선호 프로필 → 한국어 라벨 (C3 로컬 맵 — B1 routePreference.ts import 금지). */
const PREFERENCE_LABEL: Record<RoutePreference, string> = {
  fastest: '빠른',
  walkable: '걷기좋은',
  safe: '안전',
  quiet: '한적',
  scenic: '풍경',
};

export interface RouteResultScreenProps {
  /** 표시할 경로. null이면 로딩/빈 상태 표시. */
  route: Route | null;
  /** 뒤로 가기 콜백. 지정 시 지도 위 ← 버튼을 렌더(스택 헤더가 없는 화면용). */
  onBack?: () => void;
  /** 안내 시작 콜백(P3). 네이티브 + route 있을 때만 "안내 시작" 버튼 렌더. */
  onStartNav?: () => void;
  /** 경로 탐색 오류. 있으면 "탐색 중" 대신 안내 문구 (이전엔 오류 시 로딩 문구가 영구 표시됨). */
  error?: unknown;
  /** 선택된(지도에 그려진) 경로가 바뀔 때 호출 — 안내 시작이 읽는 스토어 동기화용. */
  onSelectedRouteChange?: (route: Route) => void;
  /** 일시 오류(upstream·네트워크) 시 "다시 시도" 버튼. */
  onRetry?: () => void;
  /** too_close(출·도착 700m 이내) 시 "도보로 보기" 버튼. */
  onSwitchToWalk?: () => void;
  /** 쿼터 소진 시 "카카오맵에서 보기" 링크용 출발·도착·모드. */
  origin?: LinkStop;
  destination?: LinkStop;
  mode?: TravelMode;
}

/** 오류 → 사용자 안내 문구. 501(프록시 MODE_UNAVAILABLE)은 이동수단 미지원, 대중교통은 TransitError 코드별. */
export function routeErrorMessage(error: unknown): string {
  if (isModeUnavailable(error)) return '이 이동수단은 아직 준비 중이에요';
  switch (transitErrorCode(error)) {
    case 'quota':
      return '오늘 길찾기 이용량이 많아 잠시 쉬고 있어요';
    case 'too_close':
      return '가까운 거리예요. 도보로 안내할까요?';
    case 'no_route':
      return '이 구간은 대중교통 경로가 없어요';
    default:
      return '경로를 찾지 못했어요. 잠시 후 다시 시도해 주세요.';
  }
}

/** 오류별 행동 버튼 — quota: 카카오맵 링크(쿼터 0), too_close: 도보 전환, 일시 오류: 다시 시도. */
function ErrorAction({
  error,
  onRetry,
  onSwitchToWalk,
  origin,
  destination,
  mode,
}: Pick<RouteResultScreenProps, 'error' | 'onRetry' | 'onSwitchToWalk' | 'origin' | 'destination' | 'mode'>): React.ReactElement | null {
  if (isModeUnavailable(error)) return null;
  const code = transitErrorCode(error);
  let action: { label: string; onPress: () => void; role: 'link' | 'button' } | null = null;
  if (code === 'quota') {
    if (origin && destination) {
      const url = kakaoMapLink(origin, destination, mode ?? 'transit');
      action = { label: '카카오맵에서 보기', onPress: () => void Linking.openURL(url), role: 'link' };
    }
  } else if (code === 'too_close') {
    if (onSwitchToWalk) action = { label: '도보로 보기', onPress: onSwitchToWalk, role: 'button' };
  } else if (code !== 'no_route' && onRetry) {
    action = { label: '다시 시도', onPress: onRetry, role: 'button' };
  }
  if (!action) return null;
  return (
    <Pressable style={styles.errorBtn} onPress={action.onPress} accessibilityRole={action.role} accessibilityLabel={action.label}>
      <Text style={styles.errorBtnText}>{action.label}</Text>
    </Pressable>
  );
}

function SegmentBar({ route }: { route: Route }): React.ReactElement {
  return (
    <View style={styles.bar} accessibilityLabel="구간 구성">
      {segmentBar(route).map((seg, i) => (
        <View key={i} style={[styles.barSeg, { flex: seg.weight, backgroundColor: seg.color }]} />
      ))}
    </View>
  );
}

function StepList({ route }: { route: Route }): React.ReactElement {
  return (
    <View style={styles.steps}>
      {routeStepItems(route).map((step, i) => (
        <View key={i} style={styles.stepRow}>
          {step.kind === 'transit' ? (
            <>
              <View style={[styles.badge, { backgroundColor: step.color }]}>
                <Text style={[styles.badgeText, { color: readableTextColor(step.color) }]}>
                  {step.lineName}
                </Text>
              </View>
              <Text style={styles.stepText} numberOfLines={1}>
                {transitStepText(step)}
              </Text>
            </>
          ) : (
            <Text style={styles.stepText}>
              {step.kind === 'walk' ? '도보' : step.mode === 'bike' ? '자전거' : '자동차'} {formatMinutes(step.minutes)}
            </Text>
          )}
        </View>
      ))}
    </View>
  );
}

export function RouteResultScreen({
  route,
  onBack,
  onStartNav,
  error,
  onSelectedRouteChange,
  onRetry,
  onSwitchToWalk,
  origin,
  destination,
  mode,
}: RouteResultScreenProps): React.ReactElement {
  const win = useWindowDimensions();
  // 웹 정적 렌더(SSR)는 폭을 모르므로 마운트 후 실제 폭으로 레이아웃을 정한다(OverlayPanel과 동일 이유).
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const isDesktop = mounted && win.width >= DESKTOP_MIN_WIDTH;

  const [selected, setSelected] = useState(0);
  const [panelHeight, setPanelHeight] = useState(0);
  // 도착 예정 시각이 화면을 오래 열어 둬도 맞도록 1분마다 갱신.
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(id);
  }, []);

  // 새 탐색 결과가 오면 첫 경로부터.
  useEffect(() => setSelected(0), [route]);

  const routes = useMemo(() => (route ? [route, ...(route.alternatives ?? [])] : []), [route]);
  const active = routes[selected] ?? route;
  const customMeta = active ? routeSummary(active).customMeta : undefined;

  useEffect(() => {
    if (active) onSelectedRouteChange?.(active);
  }, [active, onSelectedRouteChange]);

  const polylines = useMemo(() => (active ? routeToPolylines(active) : []), [active]);
  const markers = useMemo(() => (active ? routeMarkers(active) : []), [active]);
  const bounds = useMemo(() => (active ? boundsForRoute(active.legs) : null), [active]);
  const insets = useMemo(() => fitInsets(isDesktop, win.height, panelHeight), [isDesktop, win.height, panelHeight]);
  const fitTo = useMemo(() => (bounds ? { bounds, padding: insets } : undefined), [bounds, insets]);

  // 지도 카메라 초기값 — 경로 첫 좌표 기준 (fitTo가 이후 조정)
  const camera = { center: active?.legs[0]?.start ?? { lat: 37.5665, lng: 126.978 }, zoom: 12 };

  const panelStyle = isDesktop ? styles.panelSide : styles.panelSheet;

  return (
    <View style={styles.root}>
      <View style={styles.mapWrap}>
        <MapView camera={camera} polylines={polylines} markers={markers} fitTo={fitTo} />
      </View>

      {/* 스택 헤더가 없는 화면(웹 안내 폴백 등)에서만 */}
      {onBack && (
        <View style={styles.topBar} pointerEvents="box-none">
          <Pressable
            style={styles.backBtn}
            onPress={onBack}
            accessibilityRole="button"
            accessibilityLabel="뒤로"
          >
            <Text style={styles.backIcon}>←</Text>
          </Pressable>
        </View>
      )}

      <View style={panelStyle} onLayout={(e) => setPanelHeight(Math.round(e.nativeEvent.layout.height))}>
        {active ? (
          <ScrollView showsVerticalScrollIndicator={false}>
            {routes.map((r, idx) => {
              const isActive = r === active;
              const s = routeSummary(r);
              const walk = walkMinutes(r);
              const duration = formatDuration(s.totalDurationSec);
              const arrival = `${arrivalTime(now, s.totalDurationSec)} 도착`;
              const a11y = [
                `경로 ${idx + 1}`,
                duration,
                arrival,
                r.fare !== undefined ? `요금 ${formatFare(r.fare)}` : null,
                hasTransit(r) ? `환승 ${s.transfers}회` : null,
              ]
                .filter(Boolean)
                .join(', ');
              return (
                <Pressable
                  key={idx}
                  style={[styles.card, isActive && styles.cardActive]}
                  onPress={() => setSelected(idx)}
                  accessibilityRole="button"
                  accessibilityState={{ selected: isActive }}
                  accessibilityLabel={a11y}
                >
                  <View style={styles.headerRow}>
                    <Text style={styles.duration}>{duration}</Text>
                    <Text style={styles.arrival}>{arrival}</Text>
                    {r.fare !== undefined && <Text style={styles.fare}>{formatFare(r.fare)}</Text>}
                  </View>
                  <SegmentBar route={r} />
                  <Text style={styles.meta}>
                    {[
                      hasTransit(r) ? `환승 ${s.transfers}회` : null,
                      walk > 0 ? `도보 ${formatMinutes(walk)}` : null,
                      formatDistance(s.totalDistanceM),
                    ]
                      .filter(Boolean)
                      .join(' · ')}
                  </Text>
                  {isActive && <StepList route={r} />}
                </Pressable>
              );
            })}

            {/* 커스텀 경로 메타 — 선호 프로필 + 예산 플래그 (C3 P4). fastest/미존재 시 미표시(하위호환). */}
            {customMeta && (
              <View style={styles.customMetaRow}>
                <Text style={styles.customMetaProfile}>{PREFERENCE_LABEL[customMeta.preference]}</Text>
                <Text style={customMeta.withinBudget ? styles.withinBudget : styles.overBudget}>
                  {customMeta.withinBudget ? '예산 내' : '예산 초과'}
                </Text>
              </View>
            )}

            {/* 안내 시작 — 웹은 GPS 안내 불가라 숨긴다. */}
            {onStartNav && canStartNav(Platform.OS) && (
              <Pressable
                style={styles.startNavBtn}
                onPress={onStartNav}
                accessibilityRole="button"
                accessibilityLabel="안내 시작"
              >
                <Text style={styles.startNavText}>안내 시작</Text>
              </Pressable>
            )}
          </ScrollView>
        ) : (
          <View>
            <Text style={styles.emptyText} accessibilityRole={error ? 'alert' : undefined}>
              {error ? routeErrorMessage(error) : '경로를 탐색 중이에요…'}
            </Text>
            {error ? (
              <ErrorAction
                error={error}
                onRetry={onRetry}
                onSwitchToWalk={onSwitchToWalk}
                origin={origin}
                destination={destination}
                mode={mode}
              />
            ) : null}
          </View>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  mapWrap: { flex: 1 },
  topBar: { position: 'absolute', top: 12, left: 12 },
  backBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
    elevation: 3,
  },
  backIcon: { fontSize: 18, color: '#333' },
  panelSheet: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    maxHeight: '55%', // = SHEET_MAX_HEIGHT_RATIO (fitInsets가 같은 값을 가정)
    backgroundColor: '#fff',
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 12,
    shadowColor: '#000',
    shadowOpacity: 0.12,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: -2 },
    elevation: 8,
  },
  panelSide: {
    position: 'absolute',
    top: 12,
    bottom: 12,
    left: 12,
    width: SIDE_CARD_WIDTH,
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
    shadowColor: '#000',
    shadowOpacity: 0.18,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 2 },
    elevation: 8,
  },
  card: {
    minHeight: 44,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    padding: 12,
    marginBottom: 8,
  },
  cardActive: { borderColor: '#1565c0', backgroundColor: '#f5f9ff' },
  headerRow: { flexDirection: 'row', alignItems: 'baseline', gap: 10, marginBottom: 8 },
  duration: { fontSize: 22, fontWeight: '700', color: '#1a1a1a' },
  arrival: { fontSize: 13, color: '#555', flex: 1 },
  fare: { fontSize: 14, color: '#1a1a1a', fontWeight: '600' },
  bar: { flexDirection: 'row', height: 8, borderRadius: 4, overflow: 'hidden', gap: 1 },
  barSeg: { height: 8 },
  meta: { fontSize: 13, color: '#666', marginTop: 8 },
  steps: { marginTop: 10, gap: 8 },
  stepRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  badge: { borderRadius: 10, paddingHorizontal: 8, paddingVertical: 3 },
  badgeText: { fontSize: 12, fontWeight: '700' },
  stepText: { fontSize: 13, color: '#333', flexShrink: 1 },
  emptyText: { fontSize: 14, color: '#999', textAlign: 'center', paddingVertical: 8 },
  customMetaRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginVertical: 6 },
  customMetaProfile: { fontSize: 13, color: '#555', fontWeight: '600' },
  withinBudget: { fontSize: 13, color: '#2e7d32' },
  overBudget: { fontSize: 13, color: '#c62828' },
  startNavBtn: {
    marginTop: 4,
    backgroundColor: '#1565c0',
    borderRadius: 10,
    minHeight: 48,
    justifyContent: 'center',
    alignItems: 'center',
  },
  startNavText: { color: '#fff', fontSize: 15, fontWeight: '700' },
  errorBtn: {
    alignSelf: 'center',
    marginTop: 4,
    minHeight: 44,
    paddingHorizontal: 20,
    borderRadius: 10,
    backgroundColor: '#1565c0',
    justifyContent: 'center',
    alignItems: 'center',
  },
  errorBtnText: { color: '#fff', fontSize: 14, fontWeight: '700' },
});
