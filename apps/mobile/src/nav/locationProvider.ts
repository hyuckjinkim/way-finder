/**
 * C1 — LocationProvider 인터페이스 + 합성 impl (P3 §4 스트림 C).
 *
 * 상태 머신(A2)·UI(D)는 GPS 출처를 가리지 않는다(§0 검증 무게중심) — 실 GPS와
 * 합성 시퀀스가 `LocationSample` 동일 표면으로 수렴하므로, 양쪽 impl이 동일한
 * `LocationProvider` 계약을 만족한다. 실 impl은 `locationProvider.expo.ts`(C2),
 * 합성 impl은 여기.
 *
 * 검증(§8): 합성 impl은 ✅ 완전 검증 가능(시퀀스 방출·해지 단위 테스트). 단
 * **실 분기 커버리지로 불인정** — 실 impl(C2)은 `vi.mock('expo-location')` 별도 게이트.
 */
import type { LocationSample } from '@wayfinder/shared';

/**
 * 위치 구독 계약. `watch`는 표본 콜백을 등록하고 **동기 해지 함수**를 반환한다 —
 * 호출자(스토어/네비 세션)는 이 함수로 구독을 종료한다(중복 구독·누수 방지).
 */
export interface LocationProvider {
  /**
   * 위치 표본 스트림을 구독한다. 새 `LocationSample`마다 `cb`가 호출된다.
   * @returns 구독 해지 함수(동기). 호출 시 이후 `cb` 미호출.
   */
  watch(cb: (sample: LocationSample) => void): () => void;
}

/**
 * 합성 LocationProvider — 고정 시퀀스를 cadence(ms)마다 순서대로 방출한다.
 * F3 합성 GPS 시퀀스(`fixtures/gpsSequences.ts`)를 입력으로 받아 상태 머신·UI를
 * 디바이스 없이 구동한다(데모·테스트).
 *
 * @param sequence  방출할 표본열(F3 시퀀스).
 * @param cadenceMs 표본 간 간격(ms). 0 이하면 모두 즉시(동기) 방출.
 */
export function createSyntheticLocationProvider(
  sequence: readonly LocationSample[],
  cadenceMs = 1000,
): LocationProvider {
  return {
    watch(cb) {
      if (cadenceMs <= 0) {
        // 즉시 방출 — 동기 루프. 해지는 no-op(이미 방출 완료).
        for (const sample of sequence) {
          cb(sample);
        }
        return () => {};
      }

      let index = 0;
      const timer = setInterval(() => {
        if (index >= sequence.length) {
          clearInterval(timer);
          return;
        }
        cb(sequence[index]!);
        index += 1;
      }, cadenceMs);

      return () => clearInterval(timer);
    },
  };
}
