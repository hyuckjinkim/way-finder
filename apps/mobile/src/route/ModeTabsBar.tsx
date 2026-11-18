/**
 * C3 — 이동 수단 세그먼티드 탭 컴포넌트.
 *
 * SegmentedTabs.tsx 패턴을 그대로 따른다(View 기반, Reanimated·gesture-handler 비의존).
 * 순수 로직은 modeTabs.ts에서 가져온다.
 */
import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import type { TravelMode } from '@wayfinder/shared';
import {
  MODE_TAB_ORDER,
  MODE_TAB_LABELS,
} from './modeTabs.js';
import type { ModeTabId } from './modeTabs.js';

export interface ModeTabsProps {
  active: ModeTabId;
  onChange: (mode: TravelMode) => void;
  /** 노출할 탭(미지정=전체). capabilities로 미지원 모드를 숨길 때 쓴다. */
  modes?: readonly ModeTabId[];
}

export function ModeTabs({ active, onChange, modes = MODE_TAB_ORDER }: ModeTabsProps): React.ReactElement {
  return (
    <View style={styles.bar} accessibilityRole="tablist">
      {MODE_TAB_ORDER.filter((tab) => modes.includes(tab)).map((tab) => {
        const isActive = tab === active;
        return (
          <Pressable
            key={tab}
            style={[styles.segment, isActive && styles.segmentActive]}
            onPress={() => onChange(tab)}
            accessibilityRole="tab"
            accessibilityState={{ selected: isActive }}
            accessibilityLabel={MODE_TAB_LABELS[tab]}
          >
            <Text style={[styles.label, isActive && styles.labelActive]}>
              {MODE_TAB_LABELS[tab]}
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
    marginHorizontal: 12,
    marginVertical: 8,
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
  label: { fontSize: 14, color: '#777' },
  labelActive: { color: '#1a1a1a', fontWeight: '600' },
});
