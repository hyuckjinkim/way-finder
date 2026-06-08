/**
 * 네비 진행률 — 남은 거리/시간 + 진행 비율 (P3 §4 A3). 순수 함수.
 *
 * A1 투영(`projectToPath`/`pathLengthM`) 위의 얇은 레이어. 현재 위치를 경로에 투영해
 * 누적 along 거리를 구하고, 잔여(전체 − along)·비례 시간·완료 비율을 산출한다.
 *
 * 중복 0(nav.ts 계약): 남은 거리/시간 절대값은 `NavState`가 소유하고, `NavProgress`는
 * *파생 비율*(fraction)만 소유한다. A3는 두 표면을 한 투영에서 함께 산출하는 헬퍼다.
 */
import type { LatLng, NavProgress, Route, RouteLeg } from '@wayfinder/shared';
import { projectToPath, pathLengthM } from '@wayfinder/shared';

/** A3 산출 — 절대 잔여값(NavState 갱신용) + 파생 비율(NavProgress). */
export interface ProgressResult {
  /** 목적지까지 남은 거리(m) — 경로 잔여 along. */
  distanceRemainingM: number;
  /** 남은 시간(s) — 전체 소요 × (1 − fraction) 비례 추정. */
  durationRemainingSec: number;
  /** 진행 비율(0..1). */
  progress: NavProgress;
}

/** 활성 leg = 마지막 leg(도착 leg). navMachine과 동일 규약. */
function activeLeg(route: Route): RouteLeg | undefined {
  return route.legs[route.legs.length - 1];
}

/**
 * 현재 위치 기준 경로 진행 산출. 빈 경로는 0 잔여·진행 0(방어적).
 */
export function computeProgress(route: Route, here: LatLng): ProgressResult {
  const leg = activeLeg(route);
  if (!leg || leg.coords.length < 2) {
    return {
      distanceRemainingM: 0,
      durationRemainingSec: 0,
      progress: { fraction: 0 },
    };
  }

  const totalAlong = pathLengthM(leg.coords);
  const proj = projectToPath(here, leg.coords);
  const distanceRemainingM = Math.max(0, totalAlong - proj.alongDistanceM);
  const fraction = totalAlong > 0 ? Math.min(1, Math.max(0, proj.alongDistanceM / totalAlong)) : 0;
  const durationRemainingSec = Math.round(route.totalDurationSec * (1 - fraction));

  return {
    distanceRemainingM,
    durationRemainingSec,
    progress: { fraction },
  };
}
