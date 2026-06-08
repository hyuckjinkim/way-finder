/**
 * S3 — 실 VoiceGuide 실-모드 테스트 (carry-forward 게이트).
 *
 * `vi.mock('expo-speech')`로 네이티브 미실행. 단언:
 *  (1) speak → `Speech.speak(text, { language: 'ko' })` 호출(S1 생성 문장으로),
 *  (2) stop → `Speech.stop()` 매핑,
 *  (3) 직전 동일 문장 중복 억제(Speech.speak 미재호출),
 *  (4) stop 후 동일 문장 재발화 허용.
 *
 * `locationProvider.expo.test.ts` 패턴 계승. **합성 impl(S2)은 이 분기 커버리지로
 * 불인정** — 실 expo-speech 배선을 mock으로 직접 단언하는 것이 게이트.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('expo-speech', () => ({
  speak: vi.fn(),
  stop: vi.fn(() => Promise.resolve()),
}));

import * as Speech from 'expo-speech';
import { navInstructionText } from './navInstructionText.js';
import { createExpoVoiceGuide } from './voiceGuide.expo.js';

const mockSpeak = vi.mocked(Speech.speak);
const mockStop = vi.mocked(Speech.stop);

beforeEach(() => {
  vi.clearAllMocks();
});

describe('createExpoVoiceGuide — expo-speech 배선', () => {
  it('speak는 Speech.speak를 한국어 옵션으로 호출한다', () => {
    const vg = createExpoVoiceGuide();
    vg.speak('200m 앞에서 좌회전');

    expect(mockSpeak).toHaveBeenCalledTimes(1);
    expect(mockSpeak).toHaveBeenCalledWith('200m 앞에서 좌회전', { language: 'ko' });
  });

  it('S1 생성 문장으로 Speech.speak가 호출된다(통합 경로)', () => {
    const sentence = navInstructionText(
      { location: { lat: 37.5665, lng: 126.978 }, instruction: '', maneuver: 'turn-left', distanceM: 200 },
      'car',
    );
    const vg = createExpoVoiceGuide();
    vg.speak(sentence);

    expect(mockSpeak).toHaveBeenCalledWith('200m 앞에서 좌회전', { language: 'ko' });
  });

  it('stop은 Speech.stop으로 매핑된다', () => {
    const vg = createExpoVoiceGuide();
    vg.stop();
    expect(mockStop).toHaveBeenCalledTimes(1);
  });

  it('직전과 동일한 문장은 Speech.speak를 재호출하지 않는다(중복 억제)', () => {
    const vg = createExpoVoiceGuide();
    vg.speak('좌회전');
    vg.speak('좌회전');
    expect(mockSpeak).toHaveBeenCalledTimes(1);
  });

  it('stop 후에는 동일 문장도 다시 발화한다', () => {
    const vg = createExpoVoiceGuide();
    vg.speak('좌회전');
    vg.stop();
    vg.speak('좌회전');
    expect(mockSpeak).toHaveBeenCalledTimes(2);
  });
});
