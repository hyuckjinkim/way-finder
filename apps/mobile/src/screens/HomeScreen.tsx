/**
 * HomeScreen — 지도 홈 화면 (C1).
 *
 * <MapView>는 **F5 stub 고정 경로(`../map/MapView`)만 import**한다. 소유권 핸드오프(M2):
 * 이 화면은 어떤 시점에도 src/map/ 파일을 생성/수정하지 않는다(B4가 동일 경로를 실제
 * 디스패처로 덮어씀). 검색바(검색 화면 진입) + 길찾기/내 위치 버튼을 오버레이로 얹는다.
 *
 * 카메라는 `camera` prop이 주어지면 **제어형**(스토어 카메라가 지도를 움직임), 없으면
 * initialCamera로 시작하는 내부 상태. 선택 장소(`focus`)가 생기면 패널에 가려지지 않게 맞춘다.
 * 패널(검색·경로·장소 상세)이 열려 있으면(`panel`) 검색바·FAB 배치를 비켜 준다.
 *
 * Wave C: 카테고리 칩·결과 목록·'이 지역 재검색'(F5), 길게 누르기 팝업(F6), 레이어 토글(F7).
 * 데이터·내비게이션은 라우트(app/index.tsx)가 넘긴다 — 이 화면은 Provider 없이 렌더돼야 한다(SSR 테스트).
 * 폰에서 아래 시트·목록이 열리면 지도 자체를 그 높이만큼 줄여 카카오 로고가 시트에 가리지 않게 한다.
 */
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, Pressable, Platform, ScrollView, StyleSheet, useWindowDimensions } from 'react-native';
import type {
  BBox,
  CameraState,
  LatLng,
  MapLayers,
  MapMarker,
  MapViewRef,
  Place,
} from '@wayfinder/shared';
import type { PlaceCategoryCode } from '@wayfinder/shared/api';
import MapView from '../map/MapView';
import { Toast } from '../components/Toast';
import { CARD_INSET, CARD_WIDTH, SNAP_FRACTIONS, homeChrome, panelPlacement, type HomePanel } from '../components/sheetSnap';
import { placeFitBounds } from '../search/placeUrl';
import { formatDistance } from '../search/format';

/** 홈 칩(F5) — 카카오 category_group_code. */
export const CATEGORY_CHIPS: readonly { code: PlaceCategoryCode; label: string }[] = [
  { code: 'CE7', label: '카페' },
  { code: 'CS2', label: '편의점' },
  { code: 'FD6', label: '음식점' },
  { code: 'PM9', label: '약국' },
  { code: 'PK6', label: '주차장' },
  { code: 'SW8', label: '지하철역' },
];

const LAYER_TOGGLES: readonly { key: keyof MapLayers; label: string }[] = [
  { key: 'traffic', label: '교통정보' },
  { key: 'satellite', label: '위성' },
  { key: 'bicycle', label: '자전거' },
];
const LAYERS_STORAGE_KEY = 'wayfinder.mapLayers';

function readStoredLayers(): MapLayers {
  try {
    const v: unknown = JSON.parse(globalThis.localStorage?.getItem(LAYERS_STORAGE_KEY) ?? '{}');
    return v && typeof v === 'object' ? (v as MapLayers) : {};
  } catch {
    return {};
  }
}

function storeLayers(layers: MapLayers): void {
  try {
    globalThis.localStorage?.setItem(LAYERS_STORAGE_KEY, JSON.stringify(layers));
  } catch {
    // 사파리 비공개 모드 등 — 이번 세션만 유지
  }
}

/** 길게 누른 지점 팝업 상태(F6). label=null이면 좌표로 표시. */
export interface PressedPoint {
  coord: LatLng;
  label: string | null;
  loading: boolean;
}

/** 데모 모드 기본 카메라 — 서울 시청 근처. */
export const DEFAULT_CAMERA: CameraState = {
  center: { lat: 37.5665, lng: 126.978 },
  zoom: 11,
};

export interface HomeScreenProps {
  /** 초기 카메라(미지정 시 서울). `camera`가 있으면 무시. */
  initialCamera?: CameraState;
  /** 제어형 카메라 — 바뀌면 지도가 따라 움직인다. */
  camera?: CameraState;
  /** 지도 이동 후 카메라 보고. */
  onCameraChange?: (camera: CameraState) => void;
  /** 지도 위 마커(선택 장소 핀 등). */
  markers?: MapMarker[];
  /** 내 위치 — 있으면 파란 점. */
  userLocation?: LatLng;
  /** 선택 장소 좌표 — 패널에 안 가리게 화면에 맞춘다(처음 + focusSeq가 바뀔 때). */
  focus?: LatLng;
  /** 같은 장소를 다시 골라도 다시 맞추도록 하는 신호. */
  focusSeq?: number;
  /** 지금 홈 위에 떠 있는 패널(검색바·FAB 배치용). */
  panel?: HomePanel;
  /** 상단 토스트 문구(예: 위치 권한 안내). */
  notice?: string | null;
  /** 바뀌면 같은 문구라도 토스트를 다시 띄운다(타이머 재시작). */
  noticeId?: number;
  /**
   * 홈 위에 지도를 가리지 않는 패널(검색·장소·경로 입력)이 떠 있음 — 웹에서 스택이 홈 화면에 거는
   * aria-hidden을 걷어 보이고 눌리는 FAB·지도를 스크린리더도 읽게 한다.
   */
  revealBehindPanel?: boolean;
  onDismissNotice?: () => void;
  /** 검색바 탭 — 검색 화면 진입(E가 배선). */
  onOpenSearch?: () => void;
  /** 현재 위치 버튼 — LocationService가 제공한 좌표로 카메라 이동(D/E가 배선). */
  onRequestLocation?: () => void;
  /** 길찾기 버튼 — 경로 입력 화면 진입(E가 배선). */
  onOpenRoute?: () => void;
  /** 지도 이동 후 보이는 영역('이 지역 재검색' 기준). */
  onBoundsChange?: (bounds: BBox) => void;
  onMarkerPress?: (id: string) => void;
  /** 고른 카테고리 칩(없으면 null). */
  activeCategory?: PlaceCategoryCode | null;
  categoryPlaces?: Place[];
  categoryStatus?: 'idle' | 'loading' | 'error' | 'ready';
  /** 검색한 뒤 지도를 옮김 → '이 지역 재검색' 노출. */
  canResearch?: boolean;
  /** 칩 탭 — 같은 칩을 다시 누르면 null(해제). */
  onSelectCategory?: (code: PlaceCategoryCode | null) => void;
  onResearch?: () => void;
  onOpenPlace?: (place: Place) => void;
  /** 지도 길게 누르기·우클릭 — 패널이 없을 때만 받는다. */
  onLongPress?: (coord: LatLng) => void;
  pressed?: PressedPoint | null;
  onRouteFromPressed?: (role: 'origin' | 'destination') => void;
  onDismissPressed?: () => void;
}

export function HomeScreen({
  initialCamera = DEFAULT_CAMERA,
  camera: controlledCamera,
  onCameraChange,
  markers,
  userLocation,
  focus,
  focusSeq = 0,
  panel = 'none',
  notice,
  noticeId,
  revealBehindPanel = false,
  onDismissNotice,
  onOpenSearch,
  onRequestLocation,
  onOpenRoute,
  onBoundsChange,
  onMarkerPress,
  activeCategory = null,
  categoryPlaces,
  categoryStatus = 'idle',
  canResearch = false,
  onSelectCategory,
  onResearch,
  onOpenPlace,
  onLongPress,
  pressed,
  onRouteFromPressed,
  onDismissPressed,
}: HomeScreenProps): React.ReactElement {
  const mapRef = useRef<MapViewRef>(null);
  const [localCamera, setLocalCamera] = useState<CameraState>(initialCamera);
  const camera = controlledCamera ?? localCamera;
  const { width, height } = useWindowDimensions();
  // 웹 정적 렌더(SSR)는 창 크기 0으로 그린다 — 첫 클라이언트 렌더도 0으로 맞춰야 하이드레이션(#418)이 안 깨진다.
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const chrome = homeChrome(panel, mounted ? width : 0, mounted ? height : 0);
  const rootRef = useRef<View>(null);
  const phone = panelPlacement(mounted ? width : 0) === 'bottom';
  const sheetHeight = Math.round((mounted ? height : 0) * SNAP_FRACTIONS.peek);

  // 레이어(F7) — 저장값은 마운트 후에만 읽는다(SSR 하이드레이션 일치).
  const [layers, setLayers] = useState<MapLayers>({});
  const [layersOpen, setLayersOpen] = useState(false);
  useEffect(() => setLayers(readStoredLayers()), []);
  const toggleLayer = (key: keyof MapLayers): void => {
    const next = { ...layers, [key]: !layers[key] };
    setLayers(next);
    storeLayers(next);
  };

  // 카테고리 결과 목록은 패널이 없고 팝업이 없을 때만(장소를 열면 시트가 그 자리를 쓴다).
  const showList = panel === 'none' && !!activeCategory && categoryStatus !== 'idle' && !pressed;
  const showPressed = panel === 'none' && !!pressed;
  // 폰: 아래를 덮는 시트·목록 높이만큼 지도를 줄인다 → 카카오 로고가 그 위에 보인다(데스크톱은 카드가 왼쪽 위라 그대로).
  const mapBottomInset = phone && (panel === 'peek' || showList || showPressed) ? sheetHeight : 0;
  const fabBottom = showList && phone ? sheetHeight + 12 : chrome.fabBottom;

  useEffect(() => {
    if (Platform.OS !== 'web' || !revealBehindPanel) return;
    const root = rootRef.current as unknown as HTMLElement | null;
    if (!root?.parentElement) return;
    const unhide = (): void => {
      for (let el = root.parentElement; el; el = el.parentElement) {
        if (el.getAttribute('aria-hidden') === 'true') el.removeAttribute('aria-hidden');
      }
    };
    unhide();
    // ponytail: 스택이 포커스 변화 때 aria-hidden을 다시 거는 걸 관찰로 되돌린다 — 라이브러리가 inert를 쓰기 시작하면 여기도.
    const mo = new MutationObserver(unhide);
    mo.observe(document.body, { subtree: true, attributes: true, attributeFilter: ['aria-hidden'] });
    return () => mo.disconnect();
  }, [revealBehindPanel]);

  // 장소를 고르면 항상 '엿보기' 시트가 뜬다 → 그 여백으로 맞춘다. 좌표가 바뀔 때만 다시 계산
  // (패널이 바뀌거나 사용자가 지도를 옮긴 뒤 검색을 열어도 되돌아가지 않게).
  const size = useRef({ width, height });
  size.current = { width, height };
  const fitTo = useMemo(
    () =>
      focus
        ? {
            bounds: placeFitBounds(focus),
            // 폰은 시트만큼 지도가 줄어드므로 시트 여백을 또 뺄 필요가 없다.
            padding: homeChrome(
              panelPlacement(size.current.width) === 'bottom' ? 'none' : 'peek',
              size.current.width,
              size.current.height,
            ).fitPadding,
          }
        : undefined,
    [focus?.lat, focus?.lng], // eslint-disable-line react-hooks/exhaustive-deps
  );

  // 마운트 후 같은 장소를 다시 고르면(fitTo 값이 그대로라 렌더러가 무시) 명령형으로 다시 맞춘다.
  const firstFocus = useRef(true);
  useEffect(() => {
    if (firstFocus.current) {
      firstFocus.current = false;
      return;
    }
    if (fitTo) mapRef.current?.fitBounds(fitTo.bounds, fitTo.padding);
  }, [focusSeq]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleCamera = (next: CameraState): void => {
    setLocalCamera(next);
    onCameraChange?.(next);
  };

  return (
    <View style={styles.root} ref={rootRef}>
      <View style={[styles.mapWrap, { bottom: mapBottomInset }]}>
        <MapView
          ref={mapRef}
          camera={camera}
          markers={markers}
          userLocation={userLocation}
          fitTo={fitTo}
          showUserLocation
          layers={layers}
          onCameraChange={handleCamera}
          onBoundsChange={onBoundsChange}
          onMarkerPress={onMarkerPress}
          onLongPress={panel === 'none' ? onLongPress : undefined}
        />
      </View>

      {chrome.showSearchBar ? (
        <View style={styles.searchBarWrap} pointerEvents="box-none">
          <Pressable
            style={styles.searchBar}
            onPress={onOpenSearch}
            accessibilityRole="search"
            accessibilityLabel="장소 검색"
          >
            <Text style={styles.searchPlaceholder}>장소·주소 검색</Text>
          </Pressable>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipRow} contentContainerStyle={styles.chipRowContent}>
            {CATEGORY_CHIPS.map((c) => {
              const active = c.code === activeCategory;
              return (
                <Pressable
                  key={c.code}
                  style={[styles.chip, active && styles.chipActive]}
                  onPress={() => onSelectCategory?.(active ? null : c.code)}
                  accessibilityRole="button"
                  accessibilityState={{ selected: active }}
                  accessibilityLabel={`${c.label} 찾기`}
                >
                  <Text style={[styles.chipLabel, active && styles.chipLabelActive]}>{c.label}</Text>
                </Pressable>
              );
            })}
          </ScrollView>
          {canResearch && panel === 'none' ? (
            <Pressable style={styles.research} onPress={onResearch} accessibilityRole="button" accessibilityLabel="이 지역 재검색">
              <Text style={styles.researchLabel}>↻ 이 지역 재검색</Text>
            </Pressable>
          ) : null}
        </View>
      ) : null}

      {chrome.showSearchBar ? (
        <View style={styles.layersWrap} pointerEvents="box-none">
          <Pressable
            style={styles.layersButton}
            onPress={() => setLayersOpen((o) => !o)}
            accessibilityRole="button"
            accessibilityLabel="지도 레이어"
            accessibilityState={{ expanded: layersOpen }}
          >
            <Text style={styles.layersIcon}>◫</Text>
          </Pressable>
          {layersOpen ? (
            <View style={styles.layersMenu}>
              {LAYER_TOGGLES.map((l) => (
                <Pressable
                  key={l.key}
                  style={styles.layerRow}
                  onPress={() => toggleLayer(l.key)}
                  accessibilityRole="switch"
                  accessibilityState={{ checked: !!layers[l.key] }}
                  accessibilityLabel={l.label}
                >
                  <Text style={styles.layerCheck}>{layers[l.key] ? '☑' : '☐'}</Text>
                  <Text style={styles.layerLabel}>{l.label}</Text>
                </Pressable>
              ))}
            </View>
          ) : null}
        </View>
      ) : null}

      {chrome.showFabs ? (
        <View style={[styles.fabWrap, { bottom: fabBottom }]} pointerEvents="box-none">
          <Pressable
            style={styles.fab}
            onPress={onOpenRoute}
            accessibilityRole="button"
            accessibilityLabel="길찾기"
          >
            <Text style={styles.fabLabel}>길찾기</Text>
          </Pressable>
          <Pressable
            style={styles.fab}
            onPress={onRequestLocation}
            accessibilityRole="button"
            accessibilityLabel="현재 위치"
          >
            <Text style={styles.fabLabel}>내 위치</Text>
          </Pressable>
        </View>
      ) : null}

      {showList ? (
        <View
          style={[styles.bottomCard, phone ? [styles.bottomCardPhone, { height: sheetHeight }] : styles.bottomCardDesktop]}
          accessibilityLabel="카테고리 검색 결과"
        >
          <View style={styles.cardHeader}>
            <Text style={styles.cardTitle}>
              {CATEGORY_CHIPS.find((c) => c.code === activeCategory)?.label}
              {categoryStatus === 'ready' ? ` ${categoryPlaces?.length ?? 0}곳` : ''}
            </Text>
            <Pressable onPress={() => onSelectCategory?.(null)} accessibilityRole="button" accessibilityLabel="카테고리 닫기" style={styles.closeButton}>
              <Text style={styles.closeLabel}>✕</Text>
            </Pressable>
          </View>
          {categoryStatus === 'loading' ? <Text style={styles.cardNote}>찾는 중…</Text> : null}
          {categoryStatus === 'error' ? (
            <Pressable onPress={onResearch} accessibilityRole="button" accessibilityLabel="다시 시도">
              <Text style={styles.cardNote}>불러오지 못했어요. 눌러서 다시 시도</Text>
            </Pressable>
          ) : null}
          {categoryStatus === 'ready' && !categoryPlaces?.length ? (
            <Text style={styles.cardNote}>이 지역엔 결과가 없어요. 지도를 옮겨 재검색해 보세요.</Text>
          ) : null}
          <ScrollView>
            {(categoryPlaces ?? []).map((p) => (
              <Pressable key={p.id} style={styles.resultRow} onPress={() => onOpenPlace?.(p)} accessibilityRole="button" accessibilityLabel={p.name}>
                <Text style={styles.resultName} numberOfLines={1}>{p.name}</Text>
                <Text style={styles.resultMeta} numberOfLines={1}>
                  {[p.distanceM !== undefined ? formatDistance(p.distanceM) : null, p.category, p.address].filter(Boolean).join(' · ')}
                </Text>
              </Pressable>
            ))}
          </ScrollView>
        </View>
      ) : null}

      {showPressed && pressed ? (
        <View style={[styles.bottomCard, styles.pressedCard, phone ? styles.bottomCardPhone : styles.bottomCardDesktop]} accessibilityLabel="선택한 위치">
          <View style={styles.cardHeader}>
            <Text style={styles.cardTitle} numberOfLines={2}>
              {pressed.label ?? (pressed.loading ? '주소 찾는 중…' : `${pressed.coord.lat.toFixed(5)}, ${pressed.coord.lng.toFixed(5)}`)}
            </Text>
            <Pressable onPress={onDismissPressed} accessibilityRole="button" accessibilityLabel="위치 선택 닫기" style={styles.closeButton}>
              <Text style={styles.closeLabel}>✕</Text>
            </Pressable>
          </View>
          <View style={styles.pressedActions}>
            <Pressable style={styles.pressedAction} onPress={() => onRouteFromPressed?.('origin')} accessibilityRole="button" accessibilityLabel="여기서 출발">
              <Text style={styles.pressedActionLabel}>여기서 출발</Text>
            </Pressable>
            <Pressable style={[styles.pressedAction, styles.pressedActionPrimary]} onPress={() => onRouteFromPressed?.('destination')} accessibilityRole="button" accessibilityLabel="여기로 도착">
              <Text style={[styles.pressedActionLabel, styles.pressedActionLabelPrimary]}>여기로 도착</Text>
            </Pressable>
          </View>
        </View>
      ) : null}

      {notice && onDismissNotice ? (
        <Toast key={noticeId} message={notice} onDismiss={onDismissNotice} top={chrome.showSearchBar ? 116 : 12} />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  mapWrap: { position: 'absolute', top: 0, left: 0, right: 0 },
  chipRow: { alignSelf: 'stretch', maxWidth: 420, marginTop: 8, flexGrow: 0 },
  chipRowContent: { gap: 6, paddingRight: 4 },
  chip: {
    minHeight: 36,
    paddingHorizontal: 14,
    borderRadius: 18,
    justifyContent: 'center',
    backgroundColor: '#fff',
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 1 },
    elevation: 2,
  },
  chipActive: { backgroundColor: '#1a73e8' },
  chipLabel: { fontSize: 13, fontWeight: '600', color: '#374151' },
  chipLabelActive: { color: '#fff' },
  research: {
    alignSelf: 'center',
    marginTop: 8,
    minHeight: 36,
    paddingHorizontal: 16,
    borderRadius: 18,
    justifyContent: 'center',
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#1a73e8',
  },
  researchLabel: { fontSize: 13, fontWeight: '600', color: '#1a73e8' },
  layersWrap: { position: 'absolute', top: 112, right: 12, alignItems: 'flex-end' },
  layersButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 4,
  },
  layersIcon: { fontSize: 20, color: '#374151' },
  layersMenu: {
    marginTop: 8,
    paddingVertical: 4,
    borderRadius: 12,
    backgroundColor: '#fff',
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 4,
  },
  layerRow: { flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: 44, paddingHorizontal: 14 },
  layerCheck: { fontSize: 16, color: '#1a73e8' },
  layerLabel: { fontSize: 14, color: '#111827' },
  bottomCard: {
    position: 'absolute',
    bottom: 0,
    backgroundColor: '#fff',
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    paddingTop: 8,
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: -2 },
    elevation: 8,
  },
  bottomCardPhone: { left: 0, right: 0 },
  bottomCardDesktop: {
    left: CARD_INSET,
    bottom: CARD_INSET + 32, // 왼쪽 아래 카카오 로고를 비운다
    width: CARD_WIDTH,
    maxHeight: '45%',
    borderRadius: 16,
  },
  cardHeader: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16 },
  cardTitle: { flex: 1, fontSize: 16, fontWeight: '700', color: '#111827' },
  closeButton: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  closeLabel: { fontSize: 18, color: '#6b7280' },
  cardNote: { paddingHorizontal: 16, paddingVertical: 8, fontSize: 14, color: '#6b7280' },
  resultRow: { paddingHorizontal: 16, paddingVertical: 10, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: '#e5e7eb' },
  resultName: { fontSize: 15, fontWeight: '600', color: '#111827' },
  resultMeta: { marginTop: 2, fontSize: 13, color: '#6b7280' },
  pressedCard: { paddingBottom: 16 },
  pressedActions: { flexDirection: 'row', gap: 8, paddingHorizontal: 16, paddingTop: 4 },
  pressedAction: {
    flex: 1,
    minHeight: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#1a73e8',
  },
  pressedActionPrimary: { backgroundColor: '#1a73e8' },
  pressedActionLabel: { fontSize: 15, fontWeight: '600', color: '#1a73e8' },
  pressedActionLabelPrimary: { color: '#fff' },
  searchBarWrap: {
    position: 'absolute',
    top: 12,
    left: 12,
    right: 12,
    alignItems: 'flex-start',
  },
  searchBar: {
    alignSelf: 'stretch',
    maxWidth: 420,
    minHeight: 48,
    justifyContent: 'center',
    backgroundColor: '#fff',
    borderRadius: 24,
    paddingHorizontal: 20,
    shadowColor: '#000',
    shadowOpacity: 0.12,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 3,
  },
  searchPlaceholder: { fontSize: 15, color: '#6b7280' },
  fabWrap: {
    position: 'absolute',
    right: 16,
    gap: 12,
    alignItems: 'flex-end',
  },
  fab: {
    minWidth: 64,
    minHeight: 44,
    paddingHorizontal: 16,
    borderRadius: 22,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 4,
  },
  fabLabel: { fontSize: 14, fontWeight: '600', color: '#1a73e8' },
});
