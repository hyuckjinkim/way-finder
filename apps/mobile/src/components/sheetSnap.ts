/**
 * 바텀시트 스냅 계산·홈 화면 크롬 배치 — 순수 로직.
 */
import type { Insets } from '@wayfinder/shared';

/** 이 너비 이상이면 좌측 플로팅 카드, 미만이면 바텀시트. */
export const SIDE_PANEL_MIN_WIDTH = 768;

export type PanelPlacement = 'side' | 'bottom';

export function panelPlacement(windowWidth: number): PanelPlacement {
  return windowWidth >= SIDE_PANEL_MIN_WIDTH ? 'side' : 'bottom';
}

/** 시트 높이 비율: 엿보기 / 중간 / 전체. */
export const SNAP_FRACTIONS = { peek: 0.3, half: 0.6, full: 0.9 } as const;
export type SnapName = keyof typeof SNAP_FRACTIONS;

/** 데스크톱 플로팅 카드 치수. */
export const CARD_INSET = 16;
export const CARD_WIDTH = 380;

export function snapHeights(windowHeight: number): [peek: number, half: number, full: number] {
  const h = (f: number): number => Math.round(windowHeight * f);
  return [h(SNAP_FRACTIONS.peek), h(SNAP_FRACTIONS.half), h(SNAP_FRACTIONS.full)];
}

/**
 * 손을 뗐을 때 도착할 스냅 높이. 속도(px/ms, 위로 드래그=양수)가 충분하면 진행 방향의
 * 다음 스냅으로, 아니면 가장 가까운 스냅으로 간다.
 */
export function pickSnap(height: number, velocity: number, snaps: number[]): number {
  const sorted = [...snaps].sort((a, b) => a - b);
  if (Math.abs(velocity) > 0.5) {
    const next = velocity > 0 ? sorted.find((s) => s > height + 1) : [...sorted].reverse().find((s) => s < height - 1);
    if (next !== undefined) return next;
  }
  return sorted.reduce((best, s) => (Math.abs(s - height) < Math.abs(best - height) ? s : best));
}

export type HomePanel = 'none' | 'peek' | 'full';

/** 현재 경로(pathname) → 홈 위에 떠 있는 패널 종류. 장소 상세는 엿보기, 검색·경로 입력은 전체. */
export function panelForPath(pathname: string): HomePanel {
  if (pathname === '/' || pathname === '') return 'none';
  return pathname.startsWith('/place') ? 'peek' : 'full';
}

export interface HomeChrome {
  showSearchBar: boolean;
  showFabs: boolean;
  /** FAB 아래 여백(시트 위로 띄움). */
  fabBottom: number;
  /** 시트·카드에 가려지지 않게 장소를 맞출 때 쓰는 여백. */
  fitPadding: Insets;
}

const BASE_PAD = 48;
const FAB_BASE_BOTTOM = 24;

/** 폰: 시트가 아래에서 올라오므로 bottom 여백·FAB 상승. 데스크톱: 카드가 왼쪽을 차지하므로 left 여백. */
export function homeChrome(panel: HomePanel, windowWidth: number, windowHeight: number): HomeChrome {
  const desktop = panelPlacement(windowWidth) === 'side';
  const pad: Insets = { top: BASE_PAD, right: BASE_PAD, bottom: BASE_PAD, left: BASE_PAD };
  if (panel === 'none') {
    return { showSearchBar: true, showFabs: true, fabBottom: FAB_BASE_BOTTOM, fitPadding: pad };
  }
  if (desktop) {
    return {
      showSearchBar: false,
      showFabs: true,
      fabBottom: FAB_BASE_BOTTOM,
      fitPadding: { ...pad, left: CARD_INSET * 2 + CARD_WIDTH + BASE_PAD / 2 },
    };
  }
  if (panel === 'peek') {
    const sheet = Math.round(windowHeight * SNAP_FRACTIONS.peek);
    return {
      showSearchBar: true,
      showFabs: true,
      fabBottom: sheet + 12,
      fitPadding: { ...pad, bottom: sheet + BASE_PAD / 2 },
    };
  }
  return { showSearchBar: false, showFabs: false, fabBottom: FAB_BASE_BOTTOM, fitPadding: pad };
}
