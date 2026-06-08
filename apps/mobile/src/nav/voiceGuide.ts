/**
 * S2 — VoiceGuide 인터페이스 + 합성 impl (P5 §4 스트림 S).
 *
 * 음성 출처(실 TTS vs 합성 spy)를 가리지 않는 단일 계약. 통합 레이어(U2)는 턴 전이
 * 시 `speak(navInstructionText(...))`를 호출하고, 실 impl은 `voiceGuide.expo.ts`(S3),
 * 합성 impl은 여기. LocationProvider(C1/C2) seam 패턴 계승.
 *
 * **중복 억제(디바운스):** `speak`의 계약은 `(text: string) => void` — step 식별자가
 * 없으므로 "동일 step 재발화 금지"는 *직전 발화 텍스트와 동일하면 억제*로 구현한다.
 * 같은 턴이 여러 GPS 표본에 걸쳐 동일 문장을 만들어도 한 번만 발화한다.
 * `stop()`은 직전 발화 추적을 초기화해 다음 동일 문장이 다시 발화되게 한다.
 *
 * 검증(§8): 합성 impl은 ✅ 완전 검증 가능(spy 호출·순서·중복 억제 단위 테스트). 단
 * **실 분기 커버리지로 불인정** — 실 impl(S3)은 `vi.mock('expo-speech')` 별도 게이트.
 */

/**
 * 음성 안내 계약. `speak`는 안내 문장을 발화하고, `stop`은 현재·대기 발화를 중단한다.
 * 직전과 동일한 문장은 억제한다(중복 발화 방지) — 구현체 공통 책임.
 */
export interface VoiceGuide {
  /** 안내 문장을 발화한다. 직전 발화와 동일한 문장이면 억제(중복 방지). */
  speak(text: string): void;
  /** 현재·대기 발화를 중단하고 중복 억제 상태를 초기화한다. */
  stop(): void;
}

/**
 * 합성 VoiceGuide — 실 TTS 대신 발화 텍스트를 순서대로 누적한다(데모·테스트).
 * 중복 억제(직전 동일 문장 무시)를 실 impl과 동일하게 적용한다.
 *
 * `spoken`은 억제 후 실제 발화된 문장열(테스트 oracle). 빈 문자열은 발화하지 않는다.
 */
export interface SyntheticVoiceGuide extends VoiceGuide {
  /** 억제 후 실제 발화된 문장열(순서 보존) — 테스트 단언용. */
  readonly spoken: readonly string[];
}

/** 합성 VoiceGuide 생성. */
export function createSyntheticVoiceGuide(): SyntheticVoiceGuide {
  const spoken: string[] = [];
  let lastSpoken: string | null = null;

  return {
    spoken,
    speak(text: string): void {
      if (!text || text === lastSpoken) return;
      lastSpoken = text;
      spoken.push(text);
    },
    stop(): void {
      lastSpoken = null;
    },
  };
}
