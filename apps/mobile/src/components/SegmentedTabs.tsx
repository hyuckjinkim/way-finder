/**
 * SegmentedTabs — View 기반 세그먼티드 컨트롤 (C3 자체 구현).
 *
 * Reanimated·gesture-handler 비의존(WSL 웹 export 안전). Pressable + View만 사용한다.
 * 플랫폼 탭(네이버/카카오/구글) 전환에 쓰인다.
 */
import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import type { PlatformTabId } from './platformTabs.js';
import { TAB_LABELS } from './platformTabs.js';

export interface SegmentedTabsProps {
  tabs: PlatformTabId[];
  active: PlatformTabId;
  onChange: (tab: PlatformTabId) => void;
}

export function SegmentedTabs({
  tabs,
  active,
  onChange,
}: SegmentedTabsProps): React.ReactElement {
  return (
    <View style={styles.bar} accessibilityRole="tablist">
      {tabs.map((tab) => {
        const isActive = tab === active;
        return (
          <Pressable
            key={tab}
            style={[styles.segment, isActive && styles.segmentActive]}
            onPress={() => onChange(tab)}
            accessibilityRole="tab"
            // aria-selected: RN-web은 accessibilityState.selected를 DOM에 싣지 않는다(웹 스크린리더·QA가 못 봄).
            aria-selected={isActive}
            accessibilityLabel={TAB_LABELS[tab]}
          >
            <Text style={[styles.label, isActive && styles.labelActive]}>
              {TAB_LABELS[tab]}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    backgroundColor: '#f0f0f0',
    borderRadius: 8,
    padding: 3,
  },
  segment: {
    flex: 1,
    minHeight: 44,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 6,
  },
  segmentActive: {
    backgroundColor: '#fff',
  },
  // #f0f0f0 바 위 6.7:1 (이전 #6b7280은 4.2 — AA 미달).
  label: { fontSize: 14, color: '#4b5563' },
  labelActive: { color: '#1a1a1a', fontWeight: '600' },
});
