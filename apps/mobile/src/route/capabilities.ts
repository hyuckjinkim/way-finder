/**
 * 프록시 capabilities → 화면 노출 판단 (순수).
 * capabilities를 못 받았으면(undefined) 기존처럼 모든 모드를 보여준다.
 */
import type { TravelMode } from '@wayfinder/shared';
import type { Capabilities } from '@wayfinder/shared/api';
import { MODE_TAB_ORDER } from './modeTabs.js';

/** region 미지정이면 kr·global 합집합. 지원 모드가 하나도 없으면 탭을 비우는 대신 전체 노출. */
export function availableModes(
  caps: Capabilities | undefined,
  region: 'kr' | 'global' | undefined,
): TravelMode[] {
  if (!caps?.modes) return [...MODE_TAB_ORDER];
  const names = region ? caps.modes[region] ?? [] : [...(caps.modes.kr ?? []), ...(caps.modes.global ?? [])];
  const modes = MODE_TAB_ORDER.filter((m) => names.includes(m));
  return modes.length > 0 ? modes : [...MODE_TAB_ORDER];
}

/** 도보 선호 바(빠른/걷기 좋은/안전/한적)는 도보 + 서버가 지원할 때만. */
export const showWalkPreferences = (caps: Capabilities | undefined, mode: TravelMode): boolean =>
  mode === 'walk' && caps?.walkPreferences === true;
