/**
 * 지도를 가리지 않는 오버레이 패널 — 검색·경로 입력·장소 상세용.
 *
 * 라우트를 transparentModal로 띄우면 아래 홈 지도가 계속 렌더되고, 이 패널만 그 위에 얹힌다.
 * - 폰(<768): 네이버식 바텀시트. 스냅 30%(엿보기) / 60% / 90%, 핸들을 드래그(터치·마우스 모두).
 * - 넓은 화면(≥768): 좌측 플로팅 카드(여백 16, 폭 380, 라운드 16, 그림자). 높이는 내용에 맞고
 *   화면-32까지, 헤더의 화살표로 접는다.
 * 패널 밖(지도 영역) 터치는 아래 지도로 통과한다(box-none + 아래 웹 CSS).
 */
import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated,
  PanResponder,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
  type ViewStyle,
} from 'react-native';
import {
  CARD_INSET,
  CARD_WIDTH,
  SNAP_FRACTIONS,
  cardMaxHeight,
  cycleSnap,
  panelPlacement,
  pickSnap,
  snapHeights,
  stepSnap,
  type SnapName,
} from './sheetSnap';

export { SIDE_PANEL_MIN_WIDTH, panelPlacement } from './sheetSnap';

export interface OverlayPanelProps {
  children: React.ReactNode;
  /** 폰 바텀시트의 처음 높이(기본 full — 검색·경로 입력). 장소 상세는 'peek'. */
  initialSnap?: SnapName;
  /** 데스크톱 카드 헤더 제목(웹에선 패널 영역의 접근성 이름도). */
  title?: string;
  /** 스택에서 위에 다른 패널이 덮었을 때 — 상태는 유지한 채 숨긴다(카드가 겹쳐 비치지 않게). */
  hidden?: boolean;
}

const HANDLE_ZONE = 44;
const HANDLE_ACTIONS = [
  { name: 'increment', label: '시트 올리기' },
  { name: 'decrement', label: '시트 내리기' },
] as const;
// 웹: 시트 핸들을 Tab으로 갈 수 있게.
const WEB_TAB_STOP = Platform.select({ web: { tabIndex: 0 as const }, default: {} });
// 웹 터치 드래그 시 브라우저 스크롤이 제스처를 가로채지 않게.
const NO_TOUCH_ACTION = Platform.select({ web: { touchAction: 'none' } as unknown as ViewStyle, default: {} });

// 웹: react-navigation(native-stack 웹)이 transparentModal 화면을 전체화면 div 3겹
// (Screen 배경 · content · contentContainer)으로 감싸 패널 밖 휠·드래그·클릭과 홈 FAB를 막는다.
// 옵션(contentStyle)은 가장 안쪽 한 겹에만 닿아, 패널 루트(testID→data-testid)의 바로 위 3겹만 통과시킨다.
// ponytail: 깊이 3 고정 — 라이브러리가 래퍼를 바꾸면 e2e(패널 열린 채 지도 휠·드래그)가 잡는다.
const OVERLAY_TEST_ID = 'overlay-panel';
// 패널 루트는 프로그램 포커스만 받는다(Tab 순서엔 안 들어감, 포커스 링은 webFocus.ts가 끔).
const WEB_FOCUSABLE = Platform.select({ web: { tabIndex: -1 as const }, default: {} });
const PASSTHROUGH_STYLE_ID = 'wayfinder-overlay-passthrough';
const M = `[data-testid="${OVERLAY_TEST_ID}"]`;
const PASSTHROUGH_CSS = `div:has(>${M}),div:has(>div>${M}),div:has(>div>div>${M}){pointer-events:none}`;

function installOverlayPassthrough(): void {
  if (Platform.OS !== 'web' || typeof document === 'undefined' || document.getElementById(PASSTHROUGH_STYLE_ID)) return;
  const el = document.createElement('style');
  el.id = PASSTHROUGH_STYLE_ID;
  el.textContent = PASSTHROUGH_CSS;
  document.head.appendChild(el);
}

/** 웹: 패널이 보이게 되면 포커스를 패널 안으로(이미 안에 있으면 — 예: 검색 autoFocus — 그대로). */
function focusInto(el: HTMLElement | null): void {
  if (!el || el.contains(document.activeElement)) return;
  el.focus({ preventScroll: true });
}

export function OverlayPanel({ children, initialSnap = 'full', title = '', hidden = false }: OverlayPanelProps): React.ReactElement {
  const { width, height } = useWindowDimensions();
  // 웹 정적 렌더(SSR)는 폭을 모른 채 그리고, 하이드레이션은 서버 스타일을 고치지 않는다.
  // 마운트 후 한 번 더 렌더해 실제 폭을 반영한다.
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    installOverlayPassthrough();
    setMounted(true);
  }, []);
  const placement = panelPlacement(width);
  const rootRef = useRef<View>(null);
  useEffect(() => {
    if (!mounted || hidden || Platform.OS !== 'web') return;
    // 자식 autoFocus가 먼저 잡도록 한 틱 뒤에.
    const t = setTimeout(() => focusInto(rootRef.current as unknown as HTMLElement | null), 0);
    return () => clearTimeout(t);
  }, [mounted, hidden]);

  return (
    <View
      ref={rootRef}
      style={[StyleSheet.absoluteFill, hidden && styles.hidden]}
      pointerEvents="box-none"
      testID={OVERLAY_TEST_ID}
      role="region"
      aria-label={title || undefined}
      {...WEB_FOCUSABLE}
    >
      {/* SSR은 창 높이 0으로 시트 height:0을 굽고 하이드레이션이 그 인라인 스타일을 안 고친다 —
          직접 진입(/route/input 새로고침) 시 시트가 안 보였다. 마운트 후에만 그린다. */}
      {!mounted ? null : placement === 'side' ? (
        <FloatingCard title={title} maxHeight={cardMaxHeight(height)}>
          {children}
        </FloatingCard>
      ) : (
        <BottomSheet windowHeight={height} initialSnap={initialSnap}>
          {children}
        </BottomSheet>
      )}
    </View>
  );
}

function FloatingCard({
  children,
  title,
  maxHeight,
}: {
  children: React.ReactNode;
  title: string;
  maxHeight: number;
}): React.ReactElement {
  const [collapsed, setCollapsed] = useState(false);
  return (
    <View style={[styles.card, { maxHeight }]}>
      <View style={styles.cardHeader}>
        <Text style={styles.cardTitle} numberOfLines={1}>
          {title}
        </Text>
        <Pressable
          onPress={() => setCollapsed((c) => !c)}
          accessibilityRole="button"
          accessibilityLabel={collapsed ? '패널 펼치기' : '패널 접기'}
          accessibilityState={{ expanded: !collapsed }}
          style={styles.chevron}
        >
          <Text style={styles.chevronText}>{collapsed ? '▾' : '▴'}</Text>
        </Pressable>
      </View>
      {/* display:none으로 접어 내부 상태(입력값·스크롤)를 보존한다. */}
      <View style={collapsed ? styles.hidden : styles.cardBody}>{children}</View>
    </View>
  );
}

function BottomSheet({
  children,
  windowHeight,
  initialSnap,
}: {
  children: React.ReactNode;
  windowHeight: number;
  initialSnap: SnapName;
}): React.ReactElement {
  const snaps = useMemo(() => snapHeights(windowHeight), [windowHeight]);
  const [minH, , maxH] = snaps;
  const sheetH = useRef(new Animated.Value(Math.round(windowHeight * SNAP_FRACTIONS[initialSnap]))).current;
  const current = useRef(Math.round(windowHeight * SNAP_FRACTIONS[initialSnap]));
  const startH = useRef(current.current);
  const snapsRef = useRef(snaps);
  snapsRef.current = snaps;
  const bodyRef = useRef<View>(null);
  const handleRef = useRef<View>(null);

  const moveTo = (h: number): void => {
    current.current = h;
    // 엿보기로 내리면 내용 스크롤을 맨 위로 — 안 그러면 제목이 잘린 채 남는다.
    // ponytail: 웹만(RN-web ref = DOM). 네이티브는 자식 ScrollView ref가 필요해 보류.
    if (h === snapsRef.current[0] && Platform.OS === 'web') {
      (bodyRef.current as unknown as HTMLElement | null)?.querySelectorAll('*').forEach((el) => {
        if (el.scrollTop) el.scrollTop = 0;
      });
    }
    Animated.timing(sheetH, { toValue: h, duration: 180, useNativeDriver: false }).start();
  };

  // 화면 크기(회전·리사이즈)가 바뀌면 가장 가까운 스냅으로 다시 맞춘다.
  useEffect(() => {
    moveTo(pickSnap(current.current, 0, snaps));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [snaps]);

  const pan = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: () => true,
        onPanResponderGrant: () => {
          startH.current = current.current;
        },
        onPanResponderMove: (_e, g) => {
          const h = Math.min(maxH, Math.max(minH, startH.current - g.dy));
          current.current = h;
          sheetH.setValue(h);
        },
        onPanResponderRelease: (_e, g) => {
          // 탭(거의 안 움직임)은 다음 스냅으로 순환 — 마우스 사용자용.
          if (Math.abs(g.dy) < 4 && Math.abs(g.dx) < 4) {
            moveTo(cycleSnap(startH.current, snapsRef.current));
            return;
          }
          moveTo(pickSnap(current.current, -g.vy, snapsRef.current, startH.current));
        },
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [minH, maxH],
  );

  // 웹 키보드: 핸들에 Tab으로 와서 Enter/Space = 순환, ↑/↓ = 한 칸.
  useEffect(() => {
    const el = handleRef.current as unknown as HTMLElement | null;
    if (Platform.OS !== 'web' || !el?.addEventListener) return;
    const onKey = (e: KeyboardEvent): void => {
      const next =
        e.key === 'ArrowUp' ? stepSnap(current.current, 1, snapsRef.current)
        : e.key === 'ArrowDown' ? stepSnap(current.current, -1, snapsRef.current)
        : e.key === 'Enter' || e.key === ' ' ? cycleSnap(current.current, snapsRef.current)
        : null;
      if (next === null) return;
      e.preventDefault();
      moveTo(next);
    };
    el.addEventListener('keydown', onKey);
    return () => el.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <Animated.View style={[styles.sheet, { height: sheetH }]}>
      <View
        {...pan.panHandlers}
        ref={handleRef}
        style={[styles.handleZone, NO_TOUCH_ACTION]}
        accessibilityRole="adjustable"
        accessibilityLabel="시트 높이 조절"
        accessibilityHint="위아래로 조절해 시트 높이를 바꿔요"
        accessibilityActions={HANDLE_ACTIONS}
        onAccessibilityAction={(e) =>
          moveTo(stepSnap(current.current, e.nativeEvent.actionName === 'increment' ? 1 : -1, snapsRef.current))
        }
        {...WEB_TAB_STOP}
      >
        <View style={styles.handle} />
      </View>
      <View ref={bodyRef} style={styles.sheetBody}>
        {children}
      </View>
    </Animated.View>
  );
}

const shadow = {
  shadowColor: '#000',
  shadowOpacity: 0.18,
  shadowRadius: 12,
  shadowOffset: { width: 0, height: 2 },
  elevation: 8,
} as const;

const styles = StyleSheet.create({
  sheet: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: '#fff',
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    overflow: 'hidden',
    ...shadow,
  },
  handleZone: { height: HANDLE_ZONE, alignItems: 'center', justifyContent: 'center' },
  handle: { width: 40, height: 4, borderRadius: 2, backgroundColor: '#c4c7cc' },
  sheetBody: { flex: 1 },
  card: {
    position: 'absolute',
    top: CARD_INSET,
    left: CARD_INSET,
    width: CARD_WIDTH,
    backgroundColor: '#fff',
    borderRadius: 16,
    overflow: 'hidden',
    ...shadow,
  },
  cardHeader: { flexDirection: 'row', alignItems: 'center', minHeight: 44, paddingLeft: 16 },
  cardTitle: { flex: 1, fontSize: 14, fontWeight: '600', color: '#374151' },
  chevron: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  chevronText: { fontSize: 16, color: '#4b5563' },
  cardBody: { flexShrink: 1, minHeight: 0, overflow: 'hidden' },
  hidden: { display: 'none' },
});
