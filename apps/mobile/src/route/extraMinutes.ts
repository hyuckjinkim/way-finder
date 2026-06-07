/**
 * B2 — "+N분" 슬라이더 순수 로직 (react-native 비의존).
 *
 * MIN/MAX/DEFAULT 상수는 @wayfinder/shared 단일 진실 소스에서 가져온다 —
 * 직접 상수 정의 금지(드리프트 방지).
 */
import {
  MIN_EXTRA_MINUTES,
  MAX_EXTRA_MINUTES,
  DEFAULT_EXTRA_MINUTES,
} from '@wayfinder/shared';

export { MIN_EXTRA_MINUTES, MAX_EXTRA_MINUTES, DEFAULT_EXTRA_MINUTES };

/**
 * N분 값을 [MIN_EXTRA_MINUTES, MAX_EXTRA_MINUTES] 범위로 클램프한다.
 * 정수가 아닌 값은 Math.round로 정규화한다.
 */
export function clampExtraMinutes(value: number): number {
  const rounded = Math.round(value);
  return Math.min(MAX_EXTRA_MINUTES, Math.max(MIN_EXTRA_MINUTES, rounded));
}

/**
 * 슬라이더 값(0~1 비율)을 N분으로 변환한다.
 * 슬라이더 UI가 0~1 정규화된 위치를 전달할 때 사용한다.
 */
export function ratioToExtraMinutes(ratio: number): number {
  const value = ratio * (MAX_EXTRA_MINUTES - MIN_EXTRA_MINUTES) + MIN_EXTRA_MINUTES;
  return clampExtraMinutes(value);
}

/**
 * N분을 슬라이더 0~1 비율로 변환한다.
 * 슬라이더 UI의 초기 position 계산에 사용한다.
 */
export function extraMinutesToRatio(minutes: number): number {
  const clamped = clampExtraMinutes(minutes);
  const range = MAX_EXTRA_MINUTES - MIN_EXTRA_MINUTES;
  return range === 0 ? 0 : (clamped - MIN_EXTRA_MINUTES) / range;
}

/**
 * maxExtraMinutes 값을 RouteRequest에 전달할 수 있는 형태로 반환한다.
 * MIN 값(0)이면 undefined로 반환 — 프록시가 "무제한"으로 처리한다.
 */
export function toRouteExtraMinutes(minutes: number): number | undefined {
  const clamped = clampExtraMinutes(minutes);
  return clamped === MIN_EXTRA_MINUTES ? undefined : clamped;
}
