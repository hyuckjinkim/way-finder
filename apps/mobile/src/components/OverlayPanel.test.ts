import { describe, it, expect } from 'vitest';
import {
  panelPlacement,
  SIDE_PANEL_MIN_WIDTH,
  snapHeights,
  pickSnap,
  panelForPath,
  homeChrome,
  stepSnap,
  cycleSnap,
  cardMaxHeight,
  MAP_LOGO_CLEARANCE,
  isOverlayPath,
} from './sheetSnap';

describe('panelPlacement — 폰은 바텀시트, 넓은 화면은 플로팅 카드', () => {
  it('폰 폭은 바텀시트', () => expect(panelPlacement(390)).toBe('bottom'));
  it('태블릿·PC 폭은 좌측 카드', () => expect(panelPlacement(1280)).toBe('side'));
  it('경계값', () => {
    expect(panelPlacement(SIDE_PANEL_MIN_WIDTH - 1)).toBe('bottom');
    expect(panelPlacement(SIDE_PANEL_MIN_WIDTH)).toBe('side');
  });
});

describe('snapHeights / pickSnap', () => {
  const snaps = snapHeights(800); // 240 / 480 / 720
  it('화면 높이의 30% / 60% / 90%', () => expect(snaps).toEqual([240, 480, 720]));
  it('느린 드래그는 가장 가까운 스냅', () => {
    expect(pickSnap(300, 0, snaps)).toBe(240);
    expect(pickSnap(400, 0.1, snaps)).toBe(480);
  });
  it('빠르게 위로 쓸면 다음 큰 스냅, 아래로 쓸면 다음 작은 스냅', () => {
    expect(pickSnap(250, 1.2, snaps)).toBe(480);
    expect(pickSnap(700, -1.2, snaps)).toBe(480);
  });
  it('한 번 쓸기는 시작 스냅에서 한 칸만 — 30%에서 60%를 살짝 넘겨 놓아도 90%로 튀지 않는다', () => {
    expect(pickSnap(490, 0.8, snaps, 240)).toBe(480);
    expect(pickSnap(470, -0.8, snaps, 720)).toBe(480);
  });
  it('다음 스냅을 한참 지나 놓았으면 가까운 스냅을 넘어 되돌리지 않는다', () => {
    expect(pickSnap(700, 0.8, snaps, 240)).toBe(720);
    expect(pickSnap(250, -0.8, snaps, 720)).toBe(240);
  });
  it('끝에서는 더 못 가고 그 자리에 머문다', () => {
    expect(pickSnap(720, 2, snaps)).toBe(720);
    expect(pickSnap(240, -2, snaps)).toBe(240);
  });
});

describe('panelForPath', () => {
  it.each([
    ['/', 'none'],
    ['/place/kakao%3A1', 'peek'],
    ['/search', 'full'],
    ['/route/input', 'full'],
  ])('%s → %s', (path, panel) => expect(panelForPath(path)).toBe(panel));
});

describe('homeChrome — 패널과 홈 크롬 배치', () => {
  it('패널이 없으면 검색바·FAB 모두 표시', () => {
    const c = homeChrome('none', 390, 800);
    expect(c.showSearchBar && c.showFabs).toBe(true);
  });
  it('데스크톱은 패널이 열리면 홈 검색바를 숨기고 카드 폭만큼 왼쪽을 비운다', () => {
    const c = homeChrome('peek', 1280, 800);
    expect(c.showSearchBar).toBe(false);
    expect(c.fitPadding.left).toBeGreaterThan(396);
  });
  it('폰 엿보기 시트: FAB을 시트 위로 올리고 bottom 여백을 둔다', () => {
    const c = homeChrome('peek', 390, 800);
    expect(c.fabBottom).toBeGreaterThan(240);
    expect(c.fitPadding.bottom).toBeGreaterThan(240);
    expect(c.showSearchBar).toBe(true);
  });
  it('폰 전체 시트(검색·경로 입력)는 검색바·FAB을 숨긴다', () => {
    const c = homeChrome('full', 390, 800);
    expect(c.showSearchBar || c.showFabs).toBe(false);
  });
});

describe('stepSnap / cycleSnap — 핸들 키보드·스크린리더 조작', () => {
  const snaps = snapHeights(800); // 240 / 480 / 720
  it('한 칸씩 올리고 내리며 끝에선 머문다', () => {
    expect(stepSnap(240, 1, snaps)).toBe(480);
    expect(stepSnap(480, 1, snaps)).toBe(720);
    expect(stepSnap(720, 1, snaps)).toBe(720);
    expect(stepSnap(480, -1, snaps)).toBe(240);
    expect(stepSnap(240, -1, snaps)).toBe(240);
  });
  it('스냅 사이 높이는 가까운 스냅 기준', () => expect(stepSnap(500, 1, snaps)).toBe(720));
  it('순환: 다음 큰 스냅, 맨 위면 처음으로', () => {
    expect(cycleSnap(240, snaps)).toBe(480);
    expect(cycleSnap(720, snaps)).toBe(240);
  });
});

describe('cardMaxHeight — 좌하단 지도 로고를 가리지 않는다', () => {
  it('카드 아래(위 여백 포함)로 로고 자리를 남긴다', () => {
    expect(16 + cardMaxHeight(900)).toBe(900 - MAP_LOGO_CLEARANCE);
    expect(MAP_LOGO_CLEARANCE).toBeGreaterThanOrEqual(40);
  });
});

describe('isOverlayPath — 홈 지도 위 패널 라우트', () => {
  it.each([
    ['/search', true],
    ['/place/kakao%3A1', true],
    ['/route/input', true],
    ['/', false],
    ['/route/result', false],
    ['/roadview/x', false],
  ])('%s → %s', (path, v) => expect(isOverlayPath(path)).toBe(v));
});
