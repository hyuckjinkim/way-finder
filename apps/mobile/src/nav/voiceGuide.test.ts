/**
 * S2 — 합성 VoiceGuide 단위 테스트.
 *
 * 단언: (1) speak 호출·순서 누적, (2) 직전 동일 문장 중복 억제,
 * (3) 다른 문장은 통과, (4) stop 후 동일 문장 재발화 허용, (5) 빈 문자열 무시.
 * **합성 impl은 실 분기 커버리지로 불인정** — 실 expo-speech 배선은 S3 vi.mock 게이트.
 */
import { describe, it, expect } from 'vitest';
import { createSyntheticVoiceGuide } from './voiceGuide.js';

describe('createSyntheticVoiceGuide — 발화 큐·중복 억제', () => {
  it('speak 호출을 순서대로 누적한다', () => {
    const vg = createSyntheticVoiceGuide();
    vg.speak('200m 앞에서 좌회전');
    vg.speak('100m 앞에서 우회전');
    expect(vg.spoken).toEqual(['200m 앞에서 좌회전', '100m 앞에서 우회전']);
  });

  it('직전과 동일한 문장은 억제한다(중복 발화 방지)', () => {
    const vg = createSyntheticVoiceGuide();
    vg.speak('좌회전');
    vg.speak('좌회전');
    vg.speak('좌회전');
    expect(vg.spoken).toEqual(['좌회전']);
  });

  it('다른 문장 사이에 끼인 동일 문장은 각각 발화한다', () => {
    const vg = createSyntheticVoiceGuide();
    vg.speak('좌회전');
    vg.speak('직진');
    vg.speak('좌회전');
    expect(vg.spoken).toEqual(['좌회전', '직진', '좌회전']);
  });

  it('stop 후에는 직전과 동일한 문장도 다시 발화한다', () => {
    const vg = createSyntheticVoiceGuide();
    vg.speak('좌회전');
    vg.stop();
    vg.speak('좌회전');
    expect(vg.spoken).toEqual(['좌회전', '좌회전']);
  });

  it('빈 문자열은 발화하지 않는다', () => {
    const vg = createSyntheticVoiceGuide();
    vg.speak('');
    vg.speak('직진');
    vg.speak('');
    expect(vg.spoken).toEqual(['직진']);
  });
});
