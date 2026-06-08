/**
 * 네비 상태 머신 — 순수 reducer (P3 §4 A2 · 검증의 심장).
 *
 * `(NavState, LocationSample, Route) → NavState`. 부수효과 0 — 동일 입력은 동일 출력.
 * 검증 무게중심(§0·§8): F3 합성 GPS 시퀀스로 전 상태 전이를 단위 테스트한다.
 *
 * **순수성 경계(C3 계약 · advisor):** reducer는 `off_route`까지만 emit한다. `rerouting`은
 * "getRoute in-flight" 의미라 순수 함수가 알 수 없다 — navigating→off_route *전이*가
 * 스토어가 감시하는 재탐색 트리거 엣지다(엣지 감지=successive state 비교, 스토어 소유).
 * 라우트 교체·재초기화도 스토어/통합 레이어 소유. 이 reducer는 현재 기하에서 결정론적
 * status만 산출한다. 5개 status 입력 전부에 total(rerouting을 prev로 받아도 무크래시,
 * arrived는 latch).
 *
 * **graceful degrade:** steps 없는 경로(폴리라인 추종 네비)는 nextStep 부재 ·
 * distanceToNextTurnM=0 · activeStepIndex 0 고정 — 턴 없이 거리·도착만.
 *
 * 거리 의미(nav.ts 계약): `distanceToNextTurnM`은 현재 위치→nextStep.location 직선
 * haversine(along-route 아님). `distanceRemainingM`은 경로 잔여(전체 − along).
 */
import type {
  LatLng,
  LocationSample,
  NavState,
  Route,
  RouteLeg,
  RouteStep,
} from '@wayfinder/shared';
import {
  ARRIVAL_RADIUS_M,
  OFF_ROUTE_THRESHOLD_M,
  haversineDistanceM,
  projectToPath,
  pathLengthM,
} from '@wayfinder/shared';

/** 활성 leg = 마지막 leg(다구간 경로의 도착 leg). 단일 leg 도보가 P3 1차 범위. */
function activeLeg(route: Route): RouteLeg | undefined {
  return route.legs[route.legs.length - 1];
}

/**
 * 경로 시작 NavState. 첫 reduce 전 초기값 — UI·스토어가 세션 시작 시 사용.
 * steps 있으면 첫 step을 nextStep으로, 없으면 폴리라인 추종.
 */
export function initialNavState(route: Route): NavState {
  const leg = activeLeg(route);
  const steps = leg?.steps;
  const firstTurn = pickNextTurn(steps, 0);
  return {
    status: 'navigating',
    activeLegIndex: Math.max(0, route.legs.length - 1),
    activeStepIndex: 0,
    distanceToNextTurnM: 0,
    distanceRemainingM: route.totalDistanceM,
    durationRemainingSec: route.totalDurationSec,
    nextStep: firstTurn?.step,
  };
}

/**
 * 진행 거리(along) 이후 첫 미통과 턴을 고른다. 도착 step(distanceM 0·이름 없음)도
 * graceful — 마지막 턴까지 통과하면 nextStep 부재(도착 임박).
 * steps의 location을 경로 누적 거리로 환산하려면 leg coords 투영이 필요하나, 여기선
 * step 순서가 진행 순서임을 이용해 activeStepIndex로 전진한다(단순·결정론).
 */
function pickNextTurn(
  steps: readonly RouteStep[] | undefined,
  fromIndex: number,
): { step: RouteStep; index: number } | undefined {
  if (!steps || steps.length === 0) return undefined;
  const idx = Math.min(fromIndex, steps.length - 1);
  return { step: steps[idx]!, index: idx };
}

/**
 * 순수 reducer. 현재 상태·새 위치 표본·경로 → 다음 상태.
 *
 * 1. arrived latch — 이미 도착이면 위치 무관 도착 유지.
 * 2. 도착 판정 — 목적지(leg.end) ARRIVAL_RADIUS_M 내면 arrived.
 * 3. 경로 투영 — 최근접점 수직 거리 > OFF_ROUTE_THRESHOLD_M면 off_route, 아니면 navigating.
 * 4. 진행 — along 거리로 step 전진·남은 거리/시간·다음 턴 거리 갱신.
 */
export function navReduce(prev: NavState, sample: LocationSample, route: Route): NavState {
  // (1) arrived latch — 도착은 종착 상태.
  if (prev.status === 'arrived') return prev;

  const leg = activeLeg(route);
  if (!leg || leg.coords.length === 0) {
    // 경로 없음 — 방어적 무변화.
    return prev;
  }

  const here = sample.coord;
  const destination = leg.end;

  // (2) 도착 판정.
  const distToDest = haversineDistanceM(here, destination);
  if (distToDest <= ARRIVAL_RADIUS_M) {
    return {
      ...prev,
      status: 'arrived',
      distanceToNextTurnM: 0,
      distanceRemainingM: 0,
      durationRemainingSec: 0,
      nextStep: undefined,
    };
  }

  // (3) 경로 투영 — 이탈 감지 + 진행 거리.
  const proj = projectToPath(here, leg.coords);
  const isOffRoute = proj.perpDistanceM > OFF_ROUTE_THRESHOLD_M;

  // (4) 진행 — 남은 거리/시간(전체 − along 비례).
  const totalAlong = pathLengthM(leg.coords);
  const distanceRemainingM = Math.max(0, totalAlong - proj.alongDistanceM);
  const fraction = totalAlong > 0 ? proj.alongDistanceM / totalAlong : 0;
  const durationRemainingSec = Math.round(route.totalDurationSec * (1 - fraction));

  // 다음 턴 — steps 있으면 진행에 따라 전진(activeStepIndex는 단조 증가만).
  const steps = leg.steps;
  let activeStepIndex = prev.activeStepIndex;
  let nextStep: RouteStep | undefined;
  let distanceToNextTurnM = 0;
  if (steps && steps.length > 0) {
    activeStepIndex = advanceStepIndex(steps, leg.coords, proj.alongDistanceM, prev.activeStepIndex);
    const picked = pickNextTurn(steps, activeStepIndex);
    nextStep = picked?.step;
    if (nextStep) {
      // 계약(nav.ts): 다음 턴까지 거리 = 현재 위치 → nextStep.location 직선 haversine.
      distanceToNextTurnM = haversineDistanceM(here, nextStep.location);
    }
  }

  return {
    status: isOffRoute ? 'off_route' : 'navigating',
    activeLegIndex: Math.max(0, route.legs.length - 1),
    activeStepIndex,
    distanceToNextTurnM,
    distanceRemainingM,
    durationRemainingSec,
    nextStep,
  };
}

/**
 * along 진행 거리로 activeStepIndex를 전진한다(단조 — 되돌아가지 않음).
 * 각 step.location을 경로에 투영해 along 거리를 구하고, 사용자의 along을 막 넘긴
 * 첫 step을 다음 턴으로 본다. 새 상수 도입 없이 A1 투영만 재사용(advisor).
 */
function advanceStepIndex(
  steps: readonly RouteStep[],
  coords: readonly LatLng[],
  userAlongM: number,
  prevIndex: number,
): number {
  let index = Math.min(prevIndex, steps.length - 1);
  // 현재 인덱스부터 — 사용자가 이 step의 위치를 지났으면 다음으로.
  while (index < steps.length - 1) {
    const stepAlong = projectToPath(steps[index]!.location, coords).alongDistanceM;
    if (userAlongM >= stepAlong) {
      index += 1;
    } else {
      break;
    }
  }
  return index;
}
