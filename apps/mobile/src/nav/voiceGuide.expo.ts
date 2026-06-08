/**
 * S3 — 실 VoiceGuide (expo-speech `speak`/`stop`) · carry-forward 게이트.
 *
 * `speak(text)` → `Speech.speak(text, { language: 'ko' })`, `stop()` → `Speech.stop()`.
 * **`vi.mock('expo-speech')` 실-모드 테스트가 완료 기준** — 합성 impl(S2)은 이 분기
 * 커버리지로 불인정(P1~P4 "엔진 green, 실 배선 미연결"의 음성형 재발 방지).
 * `locationProvider.expo.ts`(C2)의 vi.mock 게이트 패턴 계승.
 *
 * **웹 격리(§6·§7):** `expo-speech`는 이 `.expo.ts`에만 top-level import한다 —
 * NavScreen이 expo-location을 격리한 패턴 계승. 웹 번들이 `expo-speech`를 끌어오지
 * 않게 통합 레이어(U2)가 실 impl을 모바일 경로에서만 주입한다.
 *
 * **중복 억제:** 인터페이스 계약대로 직전 동일 문장은 억제(중복 발화 방지). `Speech.speak`는
 * 발화를 큐에 더하므로(동일 문장 누적 방지) 직전 텍스트와 같으면 `Speech.speak` 미호출.
 * `stop()`은 큐를 비우고 억제 상태를 초기화한다.
 *
 * **실 오디오 출력은 T3 디바이스**(언어·속도·체감) — 별도 QA(§9).
 */
import * as Speech from 'expo-speech';
import type { VoiceGuide } from './voiceGuide.js';

/** 발화 언어(BCP-47) — 한국어 안내 고정. */
const SPEECH_LANGUAGE = 'ko';

/**
 * 실 VoiceGuide — expo-speech 기반. `speak`는 한국어 옵션으로 발화하고, 직전과 동일한
 * 문장은 억제한다. `stop`은 현재·대기 발화를 중단하고 억제 상태를 초기화한다.
 */
export function createExpoVoiceGuide(): VoiceGuide {
  let lastSpoken: string | null = null;

  return {
    speak(text: string): void {
      if (!text || text === lastSpoken) return;
      lastSpoken = text;
      Speech.speak(text, { language: SPEECH_LANGUAGE });
    },
    stop(): void {
      lastSpoken = null;
      void Speech.stop();
    },
  };
}
