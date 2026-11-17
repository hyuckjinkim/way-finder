/**
 * 지도를 가리지 않는 오버레이 패널 — 검색·경로 입력용.
 *
 * 라우트를 transparentModal로 띄우면 아래 홈 지도가 계속 렌더되고, 이 패널만 그 위에 얹힌다.
 * - 넓은 화면(태블릿·PC): 좌측 사이드 패널
 * - 좁은 화면(폰): 상단 시트 — 아래쪽 지도 영역이 보이고 조작 가능
 */
import React, { useEffect, useState } from 'react';
import { StyleSheet, View, useWindowDimensions } from 'react-native';

/** 이 너비 이상이면 좌측 패널. */
export const SIDE_PANEL_MIN_WIDTH = 768;

export type PanelPlacement = 'side' | 'top';

export function panelPlacement(windowWidth: number): PanelPlacement {
  return windowWidth >= SIDE_PANEL_MIN_WIDTH ? 'side' : 'top';
}

export function OverlayPanel({ children }: { children: React.ReactNode }): React.ReactElement {
  const { width } = useWindowDimensions();
  // 웹 정적 렌더(SSR)는 폭을 모른 채 'top'으로 그리고, 하이드레이션은 서버 스타일을 고치지 않는다.
  // 마운트 후 한 번 더 렌더해 실제 폭을 반영한다.
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const placement = mounted ? panelPlacement(width) : 'top';
  return (
    // box-none: 패널 밖(지도 영역) 터치는 아래 지도로 통과
    <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
      <View style={[styles.panel, placement === 'side' ? styles.side : styles.top]}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  panel: {
    position: 'absolute',
    backgroundColor: '#fff',
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOpacity: 0.18,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 2 },
    elevation: 8,
  },
  side: { top: 0, bottom: 0, left: 0, width: 400 },
  // ponytail: 높이 60% 고정 — 드래그로 높이 조절이 필요해지면 바텀시트 라이브러리 검토
  top: { top: 0, left: 0, right: 0, height: '60%', borderBottomLeftRadius: 16, borderBottomRightRadius: 16 },
});
