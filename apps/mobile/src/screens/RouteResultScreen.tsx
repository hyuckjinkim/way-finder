/**
 * D4 — RouteResultScreen.
 *
 * 경로 탐색 결과를 지도(폴리라인·마커·fitTo) + 결과 패널로 표시한다.
 * - 패널: 다른 화면과 같은 OverlayPanel — 폰=바텀시트(처음 60%, 드래그), 데스크톱(≥768)=내용 높이 플로팅 카드.
 *   뒤로 가기는 패널 안 첫 줄(스택 헤더 없음).
 * - 대안 경로 목록(route + route.alternatives): 소요·도착 예정·요금·환승·도보 + 구간 바.
 *   선택한 경로의 단계 목록을 펼치고, 지도는 선택 경로로 다시 그린다.
 * - <MapView>는 src/map/MapView import만 (수정 금지, §8 D4 경계).
 */
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  Pressable,
  StyleSheet,
  Platform,
  Linking,
  useWindowDimensions,
  type ViewStyle,
} from 'react-native';
import type { LatLng, Route, RoutePreference, TravelMode } from '@wayfinder/shared';
import { routeRegion } from '@wayfinder/shared/region';
import { transitErrorCode } from '@wayfinder/shared/transit';
import MapView from '../map/MapView';
import { OverlayPanel, panelPlacement } from '../components/OverlayPanel';
import { routeToPolylines, boundsForRoute } from '../route/routeToPolylines.js';
import { routeSummary } from '../route/routeSummary.js';
import {
  LONG_WALK_SEC,
  RESULT_SHEET_SNAP,
  arrivalTime,
  canStartNav,
  fitInsets,
  formatDistance,
  formatDuration,
  formatFare,
  formatMinutes,
  hasTransit,
  isSameStop,
  kakaoMapLink,
  linkStop,
  readableTextColor,
  routeMarkers,
  routeStepItems,
  segmentBar,
  transitStepText,
  walkMinutes,
  type LinkStop,
} from '../route/routeResultView.js';
import { isModeUnavailable } from '../services/RouteService.js';
import { arrangeRoutes, FILTER_LABEL, SORT_LABEL, type RouteFilter, type RouteSort } from '../route/routeSort.js';
import { deviceFromUA, handoffPlan, openHandoff, type HandoffApp } from '../route/appHandoff.js';
import { SHARE_TOAST } from '../route/routeShare.js';
import { canShare, sharePlace, type SharePayload } from '../share/share';
import { Toast } from '../components/Toast';

const HANDOFF_LABEL: Record<HandoffApp, string> = { kakao: '카카오맵으로 안내', naver: '네이버지도로 안내' };

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
  /** 뒤로 가기 콜백. 지정 시 패널 첫 줄에 ← 버튼을 렌더. */
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
  /** 입력 지점 [출발, …경유, 도착] — 출·도 마커·도보 연결선·지역(도착 시각 시간대)·링크 폴백에 쓴다. */
  stops?: LatLng[];
  /** 쿼터 소진 시 "카카오맵에서 보기" 링크용 출발·도착·모드(없으면 stops 좌표로 폴백). */
  origin?: LinkStop;
  destination?: LinkStop;
  mode?: TravelMode;
  /** 경로 공유 페이로드(웹). 공유 시트 또는 링크 복사가 가능할 때만 "공유" 버튼. */
  share?: SharePayload;
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
  stops,
  origin,
  destination,
  mode,
  share,
}: RouteResultScreenProps): React.ReactElement {
  const win = useWindowDimensions();
  // 웹 정적 렌더(SSR)는 폭을 모르므로 마운트 후 실제 폭으로 여백을 정한다(OverlayPanel과 동일 이유).
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const isDesktop = mounted && panelPlacement(win.width) === 'side';

  // 선택은 경로 객체로 — 정렬·필터로 순서가 바뀌어도 유지, 걸러지거나 새 결과가 오면 첫 경로로.
  const [picked, setPicked] = useState<Route | null>(null);
  const [sort, setSort] = useState<RouteSort>('time');
  const [filter, setFilter] = useState<RouteFilter>('all');
  const [toast, setToast] = useState<string | null>(null);
  const dismissToast = useCallback(() => setToast(null), []);
  // 도착 예정 시각이 화면을 오래 열어 둬도 맞도록 1분마다 갱신.
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(id);
  }, []);

  const firstStop = stops?.[0];
  const lastStop = stops?.[stops.length - 1];
  // 경유지 있는 왕복(A→W→A)은 정상 — 경유지 없이 출발=도착일 때만.
  const sameStops = stops?.length === 2 && isSameStop(stops[0]!, stops[1]!);

  const routes = useMemo(() => (route ? [route, ...(route.alternatives ?? [])] : []), [route]);
  const visible = useMemo(() => arrangeRoutes(routes, sort, filter), [routes, sort, filter]);
  const active = sameStops ? null : picked && visible.includes(picked) ? picked : (visible[0] ?? null);
  const customMeta = active ? routeSummary(active).customMeta : undefined;

  useEffect(() => {
    if (active) onSelectedRouteChange?.(active);
  }, [active, onSelectedRouteChange]);

  const polylines = useMemo(() => (active ? routeToPolylines(active, stops) : []), [active, stops]);
  const markers = useMemo(() => (active ? routeMarkers(active, stops) : []), [active, stops]);
  const bounds = useMemo(
    () => (active ? boundsForRoute(active.legs, stops ?? []) : null),
    [active, stops],
  );
  const insets = useMemo(() => fitInsets(isDesktop, win.height), [isDesktop, win.height]);
  const fitTo = useMemo(() => (bounds ? { bounds, padding: insets } : undefined), [bounds, insets]);

  // 지도 카메라 초기값 — 입력 출발지(없으면 경로 첫 좌표) 기준, fitTo가 이후 조정.
  // 출발=도착이면 fitTo 없이 그 지점에 가깝게(수도권 전체로 줌아웃하지 않게).
  const camera = {
    center: firstStop ?? active?.legs[0]?.start ?? { lat: 37.5665, lng: 126.978 },
    zoom: sameStops ? 16 : 12,
  };
  // 국내 경로만 KST, 해외는 기기 시간대.
  const region = active ? routeRegion(stops ?? [active.legs[0]!.start, active.legs[active.legs.length - 1]!.end]) : 'kr';
  const isLongWalk =
    !!active && active.legs.every((l) => l.mode === 'walk') && active.totalDurationSec > LONG_WALK_SEC;

  // navigator.share는 사용자 제스처 안에서만 열린다 — 핸들러에서 바로 호출.
  const onShare = useCallback(() => {
    if (share) void sharePlace(share).then((r) => setToast(SHARE_TOAST[r]));
  }, [share]);
  const linkOrigin = linkStop(origin, firstStop);
  const linkDestination = linkStop(destination, lastStop);
  const onHandoff = (app: HandoffApp): void => {
    if (!linkOrigin || !linkDestination) return;
    openHandoff(
      handoffPlan(app, deviceFromUA(navigator.userAgent), {
        origin: linkOrigin,
        destination: linkDestination,
        waypoints: stops?.slice(1, -1) ?? [],
        mode: mode ?? 'transit',
        appname: window.location.host,
      }),
    );
  };
  const chip = (label: string, isOn: boolean, onPress: () => void): React.ReactElement => (
    <Pressable
      key={label}
      style={[styles.chip, isOn && styles.chipOn]}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected: isOn }}
    >
      <Text style={[styles.chipText, isOn && styles.chipTextOn]}>{label}</Text>
    </Pressable>
  );

  return (
    <View style={styles.root}>
      {/* OverlayPanel 웹 통과 CSS가 이 루트까지 pointer-events:none을 걸므로 지도는 명시적으로 auto. */}
      <View style={styles.mapWrap}>
        <MapView camera={camera} polylines={polylines} markers={markers} fitTo={fitTo} />
      </View>

      <OverlayPanel initialSnap={RESULT_SHEET_SNAP} title="경로 결과">
        <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollBody} showsVerticalScrollIndicator={false}>
          <View style={styles.topRow}>
            {onBack && (
              <Pressable
                style={styles.backRow}
                onPress={onBack}
                accessibilityRole="button"
                accessibilityLabel="뒤로 가기"
              >
                <Text style={styles.backIcon}>←</Text>
                <Text style={styles.backText}>경로 수정</Text>
              </Pressable>
            )}
            {/* OverlayPanel은 마운트 후에만 내용을 그려 canShare(navigator)가 하이드레이션을 깨지 않는다. */}
            {share && canShare() && (
              <Pressable style={styles.shareBtn} onPress={onShare} accessibilityRole="button" accessibilityLabel="경로 공유">
                <Text style={styles.backText}>공유</Text>
              </Pressable>
            )}
          </View>
          {sameStops ? (
            <Text style={styles.emptyText} accessibilityRole="alert">
              출발지와 도착지가 같아요. 다른 도착지를 골라 주세요.
            </Text>
          ) : route ? (
            <>
              {routes.length > 1 && (
                <View style={styles.chips} accessibilityLabel="경로 정렬·필터">
                  {(Object.keys(SORT_LABEL) as RouteSort[]).map((k) => chip(SORT_LABEL[k], sort === k, () => setSort(k)))}
                  <View style={styles.chipGap} />
                  {(Object.keys(FILTER_LABEL) as RouteFilter[]).map((k) =>
                    chip(FILTER_LABEL[k], filter === k, () => setFilter(k)),
                  )}
                </View>
              )}
              {visible.length === 0 && <Text style={styles.emptyText}>조건에 맞는 경로가 없어요.</Text>}
              {visible.map((r, idx) => {
                const isActive = r === active;
                const s = routeSummary(r);
                const walk = walkMinutes(r);
                const duration = formatDuration(s.totalDurationSec);
                const arrival = `${arrivalTime(now, s.totalDurationSec, region)} 도착`;
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
                    onPress={() => setPicked(r)}
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

              {isLongWalk && <Text style={styles.hint}>걸어가기엔 너무 멀어요. 대중교통을 이용해 보세요.</Text>}

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
              {active && onStartNav && canStartNav(Platform.OS) && (
                <Pressable
                  style={styles.startNavBtn}
                  onPress={onStartNav}
                  accessibilityRole="button"
                  accessibilityLabel="안내 시작"
                >
                  <Text style={styles.startNavText}>안내 시작</Text>
                </Pressable>
              )}
              {/* 웹은 대신 지도 앱으로 넘긴다(앱 없으면 웹 길찾기). */}
              {active && Platform.OS === 'web' && linkOrigin && linkDestination && (
                <View style={styles.handoffRow}>
                  {/* 데스크톱 네이버는 경로를 넘길 웹 URL이 없어 빈 지도만 열린다 → 카카오만. */}
                  {(typeof navigator !== 'undefined' && deviceFromUA(navigator.userAgent) === 'desktop'
                    ? (['kakao'] as const)
                    : (['kakao', 'naver'] as const)
                  ).map((app) => (
                    <Pressable
                      key={app}
                      style={styles.handoffBtn}
                      onPress={() => onHandoff(app)}
                      accessibilityRole="link"
                      accessibilityLabel={HANDOFF_LABEL[app]}
                    >
                      <Text style={styles.handoffText}>{HANDOFF_LABEL[app]}</Text>
                    </Pressable>
                  ))}
                </View>
              )}
            </>
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
                  origin={linkOrigin}
                  destination={linkDestination}
                  mode={mode}
                />
              ) : null}
            </View>
          )}
        </ScrollView>
      </OverlayPanel>
      {toast ? <Toast message={toast} onDismiss={dismissToast} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  // 웹 전용 의미 — 네이티브는 기본값이 auto라 무해.
  mapWrap: { flex: 1, pointerEvents: 'auto' } as ViewStyle,
  scroll: { flexShrink: 1 },
  scrollBody: { paddingHorizontal: 16, paddingBottom: 16 },
  topRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  shareBtn: { minHeight: 44, minWidth: 44, paddingHorizontal: 12, justifyContent: 'center', alignItems: 'center' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 8 },
  chipGap: { width: 6 },
  chip: { minHeight: 32, paddingHorizontal: 12, borderRadius: 16, borderWidth: 1, borderColor: '#d1d5db', justifyContent: 'center' },
  chipOn: { borderColor: '#1565c0', backgroundColor: '#1565c0' },
  chipText: { fontSize: 13, color: '#374151' },
  chipTextOn: { color: '#fff', fontWeight: '700' },
  handoffRow: { flexDirection: 'row', gap: 8, marginTop: 4 },
  handoffBtn: {
    flex: 1,
    minHeight: 48,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#1565c0',
    justifyContent: 'center',
    alignItems: 'center',
  },
  handoffText: { color: '#1565c0', fontSize: 14, fontWeight: '700' },
  backRow: { flexDirection: 'row', alignItems: 'center', gap: 6, minHeight: 44, alignSelf: 'flex-start', paddingRight: 12 },
  backIcon: { fontSize: 18, color: '#374151' },
  backText: { fontSize: 14, color: '#374151', fontWeight: '600' },
  hint: { fontSize: 13, color: '#b45309', marginBottom: 8 },
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
  emptyText: { fontSize: 14, color: '#6b7280', textAlign: 'center', paddingVertical: 8 },
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
