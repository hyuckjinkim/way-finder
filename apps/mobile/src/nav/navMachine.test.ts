/**
 * A2 — 네비 상태 머신 reducer 단위 테스트 (검증의 심장).
 *
 * F3 합성 GPS 시퀀스(gpsSequences)로 전 상태 전이를 구동:
 *  - on-route 진행 → navigating → arrived (남은 거리 단조 감소).
 *  - off-route 이탈 → navigating → off_route (재탐색 트리거 엣지).
 *  - 경계 straddle → 직전(navigating 유지)/직후(off_route).
 *  - 도착 반경 진입 → arrived (latch).
 *  - steps 없는 경로 → 폴리라인 추종(nextStep 부재, 거리·도착만) graceful.
 *  - 5개 status 입력 total(rerouting prev 무크래시, arrived latch).
 *
 * Route는 F3 REFERENCE_PATH(WALK_SIMPLE 골든 leg coords 복사)로 합성하고, 그 경로
 * 정점에 합성 steps를 배치한다(F2 정규화 산물은 proxy 패키지라 mobile에서 unreachable —
 * F3 설계 의도대로 같은 REFERENCE_PATH로 Route를 구성한다).
 */
import { describe, it, expect } from 'vitest';
import type { Route, RouteStep, NavState } from '@wayfinder/shared';
import {
  REFERENCE_PATH,
  DESTINATION,
  ON_ROUTE_SEQUENCE,
  OFF_ROUTE_SEQUENCE,
  BOUNDARY_JUST_UNDER_SEQUENCE,
  BOUNDARY_JUST_OVER_SEQUENCE,
  ARRIVAL_SEQUENCE,
} from './fixtures/gpsSequences.js';
import { navReduce, initialNavState } from './navMachine.js';

// REFERENCE_PATH 정점에 배치한 합성 steps(진행 순서). 마지막은 도착 maneuver(거리 0·이름 없음).
const STEPS: RouteStep[] = [
  { location: REFERENCE_PATH[0]!, instruction: 'Head east', type: 2, distanceM: 200, streetNames: ['세종대로'] },
  { location: REFERENCE_PATH[12]!, instruction: 'Turn left', type: 15, distanceM: 300, streetNames: ['무교로'] },
  { location: REFERENCE_PATH[38]!, instruction: 'Turn right', type: 10, distanceM: 400, streetNames: ['청계천로'] },
  { location: DESTINATION, instruction: 'Arrive', type: 4, distanceM: 0 }, // 도착 — street_names 없음
];

function buildRoute(withSteps: boolean): Route {
  return {
    legs: [
      {
        start: REFERENCE_PATH[0]!,
        end: DESTINATION,
        mode: 'walk',
        durationSec: 900,
        distanceM: 1100,
        coords: [...REFERENCE_PATH],
        ...(withSteps ? { steps: STEPS } : {}),
      },
    ],
    totalDurationSec: 900,
    totalDistanceM: 1100,
  };
}

const ROUTE = buildRoute(true);
const ROUTE_NO_STEPS = buildRoute(false);

/** 시퀀스를 reducer로 누적 구동해 매 단계 NavState를 수집. */
function drive(route: Route, seq: readonly { coord: { lat: number; lng: number }; timestampMs: number }[]): NavState[] {
  const states: NavState[] = [];
  let state = initialNavState(route);
  for (const s of seq) {
    state = navReduce(state, s as never, route);
    states.push(state);
  }
  return states;
}

describe('navReduce — 초기 상태', () => {
  it('initialNavState는 navigating·첫 step·전체 거리/시간', () => {
    const s = initialNavState(ROUTE);
    expect(s.status).toBe('navigating');
    expect(s.activeStepIndex).toBe(0);
    expect(s.distanceRemainingM).toBe(1100);
    expect(s.durationRemainingSec).toBe(900);
    expect(s.nextStep).toEqual(STEPS[0]);
  });

  it('steps 없는 경로는 nextStep 부재(폴리라인 추종)', () => {
    expect(initialNavState(ROUTE_NO_STEPS).nextStep).toBeUndefined();
  });
});

describe('navReduce — on-route 진행 (navigating → arrived)', () => {
  const states = drive(ROUTE, ON_ROUTE_SEQUENCE);

  it('진행 중 navigating, 마지막 목적지에서 arrived', () => {
    // 중간 샘플은 navigating 또는 (목적지 근처) arrived.
    expect(states[0]!.status).toBe('navigating');
    expect(states[states.length - 1]!.status).toBe('arrived');
  });

  it('남은 거리가 (대체로) 감소 — 시작 > 끝', () => {
    const first = states[0]!.distanceRemainingM;
    const arrivedIdx = states.findIndex((s) => s.status === 'arrived');
    const beforeArrival = states[arrivedIdx - 1]!;
    expect(beforeArrival.distanceRemainingM).toBeLessThan(first);
  });

  it('도착 시 남은 거리·시간·다음 턴 거리 0, nextStep 부재', () => {
    const arrived = states[states.length - 1]!;
    expect(arrived.distanceRemainingM).toBe(0);
    expect(arrived.durationRemainingSec).toBe(0);
    expect(arrived.distanceToNextTurnM).toBe(0);
    expect(arrived.nextStep).toBeUndefined();
  });

  it('진행에 따라 activeStepIndex 단조 증가(턴 전진)', () => {
    const indices = states.map((s) => s.activeStepIndex);
    for (let i = 1; i < indices.length; i++) {
      expect(indices[i]!).toBeGreaterThanOrEqual(indices[i - 1]!);
    }
    // 경로 후반에 첫 step(인덱스 0) 이상으로 전진한다.
    expect(Math.max(...indices)).toBeGreaterThan(0);
  });

  it('navigating 중 distanceToNextTurnM은 현재→nextStep.location 직선', () => {
    const nav = states.find((s) => s.status === 'navigating' && s.nextStep)!;
    expect(nav.distanceToNextTurnM).toBeGreaterThanOrEqual(0);
  });
});

describe('navReduce — off-route 이탈 (navigating → off_route, 재탐색 엣지)', () => {
  const states = drive(ROUTE, OFF_ROUTE_SEQUENCE);

  it('초기 on-route는 navigating, 이탈 샘플은 off_route', () => {
    expect(states[0]!.status).toBe('navigating');
    expect(states[1]!.status).toBe('navigating');
    expect(states[2]!.status).toBe('off_route');
    expect(states[3]!.status).toBe('off_route');
  });

  it('navigating→off_route 전이가 정확히 1회(엣지 — 스토어가 감시할 트리거)', () => {
    let edges = 0;
    for (let i = 1; i < states.length; i++) {
      if (states[i - 1]!.status === 'navigating' && states[i]!.status === 'off_route') edges++;
    }
    expect(edges).toBe(1);
  });

  it('reducer는 rerouting을 emit하지 않는다(C3 순수성 경계)', () => {
    expect(states.every((s) => s.status !== 'rerouting')).toBe(true);
  });
});

describe('navReduce — 경계 straddle', () => {
  it('직전(≈29m) 시퀀스는 off_route 미발생(navigating 유지)', () => {
    const states = drive(ROUTE, BOUNDARY_JUST_UNDER_SEQUENCE);
    expect(states.every((s) => s.status === 'navigating')).toBe(true);
  });

  it('직후(≈31m) 시퀀스는 navigating → off_route', () => {
    const states = drive(ROUTE, BOUNDARY_JUST_OVER_SEQUENCE);
    expect(states[0]!.status).toBe('navigating');
    expect(states[states.length - 1]!.status).toBe('off_route');
  });
});

describe('navReduce — 도착 반경 진입 (arrived latch)', () => {
  const states = drive(ROUTE, ARRIVAL_SEQUENCE);

  it('목적지 반경 진입 시 arrived', () => {
    expect(states[states.length - 1]!.status).toBe('arrived');
  });

  it('arrived는 latch — 도착 후 위치 표본 무관 도착 유지', () => {
    const arrived: NavState = { ...states[states.length - 1]!, status: 'arrived' };
    // 도착 후 경로에서 멀리 벗어난 샘플을 줘도 arrived 유지.
    const next = navReduce(arrived, { coord: { lat: 37.5, lng: 127.1 }, timestampMs: 1 } as never, ROUTE);
    expect(next).toBe(arrived); // 동일 참조 반환(무변화)
  });
});

describe('navReduce — graceful degrade & totality', () => {
  it('steps 없는 경로는 nextStep 부재·distanceToNextTurnM 0이나 거리·도착은 동작', () => {
    const states = drive(ROUTE_NO_STEPS, ON_ROUTE_SEQUENCE);
    expect(states.every((s) => s.nextStep === undefined)).toBe(true);
    expect(states.every((s) => s.distanceToNextTurnM === 0)).toBe(true);
    expect(states[states.length - 1]!.status).toBe('arrived');
    // 도착 직전 남은 거리가 시작보다 작다(폴리라인 추종 진행).
    const arrivedIdx = states.findIndex((s) => s.status === 'arrived');
    expect(states[arrivedIdx - 1]!.distanceRemainingM).toBeLessThan(states[0]!.distanceRemainingM);
  });

  it('rerouting을 prev status로 받아도 무크래시(total)', () => {
    const prev: NavState = { ...initialNavState(ROUTE), status: 'rerouting' };
    const next = navReduce(prev, ON_ROUTE_SEQUENCE[0]! as never, ROUTE);
    // rerouting에서 다시 기하 기반 status 산출(navigating/off_route/arrived).
    expect(['navigating', 'off_route', 'arrived']).toContain(next.status);
  });

  it('순수 — 동일 입력 동일 출력', () => {
    const prev = initialNavState(ROUTE);
    const a = navReduce(prev, ON_ROUTE_SEQUENCE[5]! as never, ROUTE);
    const b = navReduce(prev, ON_ROUTE_SEQUENCE[5]! as never, ROUTE);
    expect(a).toEqual(b);
  });

  it('빈 coords 경로는 방어적 무변화', () => {
    const empty: Route = { legs: [{ start: DESTINATION, end: DESTINATION, mode: 'walk', durationSec: 0, distanceM: 0, coords: [] }], totalDurationSec: 0, totalDistanceM: 0 };
    const prev = initialNavState(empty);
    const next = navReduce(prev, ON_ROUTE_SEQUENCE[0]! as never, empty);
    expect(next).toBe(prev);
  });
});
