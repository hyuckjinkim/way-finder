/**
 * B3 — 경로 옵션 바 컴포넌트.
 *
 * ModeTabsBar.tsx 패턴을 그대로 따른다(View 기반, Reanimated·gesture-handler 비의존).
 * 순수 로직은 routePreference.ts·extraMinutes.ts에서 가져온다.
 *
 * - 프로필 세그먼티드 탭: 빠른/걷기좋은/안전/한적 (풍경은 ENABLE_SCENIC flag off 시 미노출)
 * - "+N분" 스테퍼: − / + 버튼으로 STEP_MINUTES 단위 조정 (plain RN, 외부 Slider 의존 0)
 */
import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import type { RoutePreference } from '@wayfinder/shared';
import {
  PREFERENCE_TAB_ORDER,
  PREFERENCE_TAB_LABELS,
  tabToPreference,
} from './routePreference.js';
import type { PreferenceTabId } from './routePreference.js';
import {
  MIN_EXTRA_MINUTES,
  MAX_EXTRA_MINUTES,
  clampExtraMinutes,
} from './extraMinutes.js';

/** 스테퍼 조정 단위(분). */
const STEP_MINUTES = 5;

export interface RouteOptionsBarProps {
  /** 현재 선택된 경로 선호 프로필. */
  preference: RoutePreference | undefined;
  /** 현재 "+N분" 예산 (undefined=무제한). */
  maxExtraMinutes: number | undefined;
  /** 선호 프로필 변경 시 호출. */
  onPreferenceChange: (preference: RoutePreference | undefined) => void;
  /** N분 예산 변경 시 호출. */
  onMaxExtraMinutesChange: (minutes: number | undefined) => void;
}

/**
 * 경로 옵션 바 (B3 구현).
 * 프로필 세그먼티드 탭 + "+N분" 스테퍼. 풍경은 ENABLE_SCENIC flag off 시 미노출.
 */
export function RouteOptionsBar({
  preference,
  maxExtraMinutes,
  onPreferenceChange,
  onMaxExtraMinutesChange,
}: RouteOptionsBarProps): React.ReactElement {
  const currentMinutes = maxExtraMinutes ?? MIN_EXTRA_MINUTES;
  const activePreference = preference ?? 'fastest';

  const handleDecrement = (): void => {
    const next = clampExtraMinutes(currentMinutes - STEP_MINUTES);
    onMaxExtraMinutesChange(next === MIN_EXTRA_MINUTES ? undefined : next);
  };

  const handleIncrement = (): void => {
    const next = clampExtraMinutes(currentMinutes + STEP_MINUTES);
    onMaxExtraMinutesChange(next === MIN_EXTRA_MINUTES ? undefined : next);
  };

  const isDecrementDisabled = currentMinutes <= MIN_EXTRA_MINUTES;
  const isIncrementDisabled = currentMinutes >= MAX_EXTRA_MINUTES;
  const showStepper = activePreference !== 'fastest';

  return (
    <View style={styles.container}>
      {/* 프로필 세그먼티드 탭 */}
      <View style={styles.bar} accessibilityRole="tablist">
        {PREFERENCE_TAB_ORDER.map((tab: PreferenceTabId) => {
          const isActive = tab === activePreference;
          return (
            <Pressable
              key={tab}
              style={[styles.segment, isActive && styles.segmentActive]}
              onPress={() => onPreferenceChange(tabToPreference(tab))}
              accessibilityRole="tab"
              accessibilityState={{ selected: isActive }}
              accessibilityLabel={PREFERENCE_TAB_LABELS[tab]}
            >
              <Text style={[styles.label, isActive && styles.labelActive]}>
                {PREFERENCE_TAB_LABELS[tab]}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {/* +N분 스테퍼 — fastest 선택 시 미표시 */}
      {showStepper && (
        <View style={styles.stepper} accessibilityRole="adjustable">
          <Pressable
            style={[styles.stepBtn, isDecrementDisabled && styles.stepBtnDisabled]}
            onPress={handleDecrement}
            disabled={isDecrementDisabled}
            accessibilityLabel="추가 시간 줄이기"
          >
            <Text style={styles.stepBtnText}>−</Text>
          </Pressable>

          <View style={styles.stepValue}>
            <Text style={styles.stepValueText}>
              {currentMinutes === MIN_EXTRA_MINUTES ? '제한 없음' : `+${currentMinutes}분`}
            </Text>
          </View>

          <Pressable
            style={[styles.stepBtn, isIncrementDisabled && styles.stepBtnDisabled]}
            onPress={handleIncrement}
            disabled={isIncrementDisabled}
            accessibilityLabel="추가 시간 늘리기"
          >
            <Text style={styles.stepBtnText}>+</Text>
          </Pressable>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginHorizontal: 12,
    marginVertical: 8,
    gap: 8,
  },
  bar: {
    flexDirection: 'row',
    backgroundColor: '#f0f0f0',
    borderRadius: 8,
    padding: 3,
  },
  segment: {
    flex: 1,
    paddingVertical: 8,
    alignItems: 'center',
    borderRadius: 6,
  },
  segmentActive: {
    backgroundColor: '#fff',
  },
  label: { fontSize: 14, color: '#777' },
  labelActive: { color: '#1a1a1a', fontWeight: '600' },
  stepper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f0f0f0',
    borderRadius: 8,
    padding: 3,
  },
  stepBtn: {
    width: 40,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 6,
    backgroundColor: '#fff',
  },
  stepBtnDisabled: {
    backgroundColor: '#e0e0e0',
  },
  stepBtnText: {
    fontSize: 18,
    color: '#1a1a1a',
    fontWeight: '600',
  },
  stepValue: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepValueText: {
    fontSize: 14,
    color: '#1a1a1a',
    fontWeight: '500',
  },
});
