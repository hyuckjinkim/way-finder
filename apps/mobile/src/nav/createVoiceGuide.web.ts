/**
 * U2 — VoiceGuide 팩토리 (웹 디스패처). 웹은 합성 impl로 격리한다.
 *
 * **웹 번들 격리(P5 §6·§7 게이트):** 이 파일은 `expo-speech`를 *전혀* import하지 않는다 —
 * Metro/Vitest가 `.web.ts`를 `.ts`보다 먼저 해석하므로, 웹 번들·node 테스트 환경은
 * 항상 이 합성 impl을 풀어 `expo-speech`가 번들에서 구조적으로 배제된다. 웹 네비는
 * 비활성(NavScreen.web — 모바일 전용 안내)이라 합성 impl이 호출돼도 부수효과 0.
 */
import { createSyntheticVoiceGuide } from './voiceGuide.js';
import type { VoiceGuide } from './voiceGuide.js';

/** 웹 VoiceGuide — 합성 impl(expo import 0, 부수효과 0). */
export function createVoiceGuide(): VoiceGuide {
  return createSyntheticVoiceGuide();
}
