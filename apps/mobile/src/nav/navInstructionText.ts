/**
 * S1 — 안내 문장 생성 순수 함수 (P5 §4 스트림 S · T1 검증 핵심).
 *
 * `(RouteStep, mode: TravelMode) → string`. 부수효과 0 — 디바이스 무관.
 * 소비자=VoiceGuide(S2)만(턴 카드는 기존 `RouteStep.instruction` 유지 — U1 불변).
 *
 * **우선순위(F1 동결 계약 — route.ts:64~67·:99~104):** 안내 어휘 함수는 정규화
 * `maneuver` enum을 단일 키로 쓴다. `maneuver`가 있고 `'unknown'`이 아니면 모드별
 * 어휘로 문장을 합성하고(예: "200m 앞에서 좌회전"), 미존재·`'unknown'`이면
 * `instruction` 원문으로 폴백, 그것도 없으면 일반 문구. 모드별 어휘 차이(자동차/
 * 자전거=차선/회전, 도보/대중교통=보행)는 enum 경로에서만 갈린다 — instruction
 * 원문은 공급자 산물이라 모드 불변이기 때문.
 *
 * `depart`/`arrive` 및 거리 ≈0 step은 거리 접두("0m 앞에서")를 붙이지 않는다.
 */
import type { ManeuverKind, RouteStep, TravelMode } from '@wayfinder/shared';

/** 모드 어휘군 — 자동차/자전거=차량 어휘, 도보/대중교통=보행 어휘. */
type Vocabulary = Record<ManeuverKind, string>;

/** 차량(자동차·자전거) 어휘 — 회전·차선 중심. */
const VEHICULAR_VOCAB: Vocabulary = {
  depart: '출발합니다',
  'turn-left': '좌회전',
  'turn-right': '우회전',
  'slight-left': '왼쪽 방향',
  'slight-right': '오른쪽 방향',
  straight: '직진',
  uturn: '유턴',
  roundabout: '회전 교차로 진입',
  merge: '합류',
  fork: '분기',
  arrive: '목적지에 도착했습니다',
  unknown: '',
};

/** 보행(도보·대중교통) 어휘 — 방향 안내 중심. */
const PEDESTRIAN_VOCAB: Vocabulary = {
  depart: '출발합니다',
  'turn-left': '왼쪽으로 이동',
  'turn-right': '오른쪽으로 이동',
  'slight-left': '왼쪽 방향으로 이동',
  'slight-right': '오른쪽 방향으로 이동',
  straight: '직진',
  uturn: '뒤로 돌아갑니다',
  roundabout: '회전 구간 진입',
  merge: '길 합류',
  fork: '갈림길',
  arrive: '목적지에 도착했습니다',
  unknown: '',
};

/** 모드 → 어휘군. 자동차/자전거=차량, 도보/대중교통=보행. */
function vocabFor(mode: TravelMode): Vocabulary {
  return mode === 'car' || mode === 'bike' ? VEHICULAR_VOCAB : PEDESTRIAN_VOCAB;
}

/** 거리 접두를 붙이지 않는 maneuver(현 지점 발생 — "앞에서" 부적절). */
function hasDistancePrefix(maneuver: ManeuverKind, distanceM: number): boolean {
  if (maneuver === 'depart' || maneuver === 'arrive') return false;
  return distanceM >= 1;
}

/** 거리 접두 문자열("200m 앞에서" / "1.2km 앞에서"). */
function distancePrefix(distanceM: number): string {
  const rounded =
    distanceM >= 1000 ? `${(distanceM / 1000).toFixed(1)}km` : `${Math.round(distanceM)}m`;
  return `${rounded} 앞에서 `;
}

/**
 * 안내 문장을 합성한다. `maneuver`(정규화 enum) 우선 — 모드별 어휘로 문장 합성.
 * `maneuver` 미존재·`'unknown'`이면 `instruction` 원문, 그것도 없으면 일반 문구.
 */
export function navInstructionText(step: RouteStep, mode: TravelMode): string {
  const { maneuver, instruction, distanceM } = step;

  if (maneuver && maneuver !== 'unknown') {
    const phrase = vocabFor(mode)[maneuver];
    if (phrase) {
      return hasDistancePrefix(maneuver, distanceM)
        ? `${distancePrefix(distanceM)}${phrase}`
        : phrase;
    }
  }

  if (instruction) return instruction;

  return '경로를 따라 계속 이동합니다';
}
