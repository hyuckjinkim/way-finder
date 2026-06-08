/**
 * U2 — VoiceGuide 팩토리 (네이티브 디스패처). 실 모드 = expo-speech impl.
 *
 * **웹 번들 격리(P5 §6·§7 게이트):** `expo-speech`는 web shim이 없어 *required absent*
 * 다(expo-location과 다름 — locationProvider 선례 불성립, advisor). nav.tsx는 단일 공유
 * 모듈이라 여기서 `voiceGuide.expo.ts`(→ `expo-speech`)를 정적 import하면 Metro가
 * 웹 번들에 끌어온다. NavScreen/NavScreen.web 패턴대로 플랫폼 분기 팩토리로 격리:
 * 네이티브=이 파일(expo impl), 웹=`createVoiceGuide.web.ts`(합성 impl, expo import 0).
 *
 * 실 오디오 출력은 T3 디바이스(§9 QA 백로그).
 */
import { createExpoVoiceGuide } from './voiceGuide.expo.js';
import type { VoiceGuide } from './voiceGuide.js';

/** 실 모드 VoiceGuide — expo-speech 기반(네이티브). */
export function createVoiceGuide(): VoiceGuide {
  return createExpoVoiceGuide();
}
