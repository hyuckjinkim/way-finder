import { describe, it, expect } from 'vitest';
import { panelPlacement, SIDE_PANEL_MIN_WIDTH } from './OverlayPanel';

describe('panelPlacement — 지도를 가리지 않는 패널 위치', () => {
  it('폰 폭은 상단 시트', () => expect(panelPlacement(390)).toBe('top'));
  it('태블릿·PC 폭은 좌측 패널', () => expect(panelPlacement(1280)).toBe('side'));
  it('경계값', () => {
    expect(panelPlacement(SIDE_PANEL_MIN_WIDTH - 1)).toBe('top');
    expect(panelPlacement(SIDE_PANEL_MIN_WIDTH)).toBe('side');
  });
});
