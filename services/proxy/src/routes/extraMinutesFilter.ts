/**
 * OO1 — "+N분" 필터 엔진 (P4 §1 2-call 백본).
 *
 * 흐름 (§1 백본 — alternates 비의존, 경유지 유무 무관):
 *   1. 기본 costing 호출 → 최속 소요 `T` (표준 pedestrian, costing 조정 없음).
 *   2. 프로필 costing 호출 → 커스텀 경로 `P` (walkable/safe/quiet costing).
 *   3. `duration(P) ≤ T + N` 판정 → `withinBudget` 플래그.
 *
 * **F1 폴백 규약 (단일 표면):** 항상 **P를 서빙**하고 `customMeta`로 예산 플래그를
 * 표시한다(데모 mockRouteProvider와 동일 표면 — 데모는 단일 Route + 합성 플래그,
 * 실 모드는 P + 실 산출 플래그). T로 스왑하지 않는다. `baselineDurationSec`은
 * 실제 최속 호출 결과 `T.totalDurationSec`.
 *
 * **인터페이스 대상 작성 (A lane 대기 0):** `ValhallaProvider`(F1 routeDirect.ts 정의)를
 * 주입받아 호출한다. OO1 단위 테스트는 이 인터페이스를 mock으로 주입한다.
 */
import type {
  Route,
  RouteRequest,
  RoutePreference,
  PedestrianCostingOptions,
} from '@wayfinder/shared';
import { PROFILE_COSTING } from '@wayfinder/shared';
import type { ValhallaProvider } from './routeDirect.js';

/** 기본(최속) costing — costing 조정 없는 표준 pedestrian (preference='fastest' 대응). */
const BASELINE_COSTING: PedestrianCostingOptions = {};

/**
 * 분(minute) 단위 N을 초로 변환. 미지정(undefined)=무제한 예산.
 * 예산 비교는 초 단위(Route.totalDurationSec)이므로 분→초 변환이 필수.
 */
function budgetSec(maxExtraMinutes: number | undefined): number {
  if (maxExtraMinutes === undefined) return Number.POSITIVE_INFINITY;
  return maxExtraMinutes * 60;
}

/**
 * 프로필 → costing 옵션 해석. PROFILE_COSTING에 항목 없으면(scenic·미지원)
 * 빈 costing(=기본 pedestrian)으로 폴백 — provider에 undefined를 넘기지 않는다.
 */
function costingFor(preference: RoutePreference): PedestrianCostingOptions {
  return PROFILE_COSTING[preference] ?? BASELINE_COSTING;
}

/**
 * 2-call +N 필터 실행.
 *
 * @param provider  Valhalla 공급자 (F1 인터페이스 — 실 OW1 구현 또는 테스트 mock).
 * @param req       RouteRequest. `preference`(비-fastest)·`maxExtraMinutes` 포함.
 * @returns         프로필 경로 P에 `customMeta`(preference·withinBudget·baseline) 부착.
 *
 * 호출자(OW1)는 `isValhallaCustomRoute`가 참인 경우에만 진입하므로 preference는
 * 항상 정의된 비-fastest 값이다. 방어적으로 미지정 시 'fastest' 취급한다.
 */
export async function applyExtraMinutesFilter(
  provider: ValhallaProvider,
  req: RouteRequest,
): Promise<Route> {
  const preference: RoutePreference = req.preference ?? 'fastest';

  // 1. 기본 costing → 최속 T. (preference만 fastest로 덮은 동일 stops 요청)
  const baseline = await provider.route(
    { ...req, preference: 'fastest' },
    BASELINE_COSTING,
  );

  // 2. 프로필 costing → 커스텀 P.
  const profile = await provider.route(req, costingFor(preference));

  // 3. 예산 판정 — P 소요 ≤ T 소요 + N(초). N 미지정=무제한=항상 true.
  const withinBudget =
    profile.totalDurationSec <=
    baseline.totalDurationSec + budgetSec(req.maxExtraMinutes);

  // F1 폴백 규약: 항상 P 서빙 + customMeta 플래그 (T로 스왑하지 않음).
  return {
    ...profile,
    customMeta: {
      preference,
      withinBudget,
      baselineDurationSec: baseline.totalDurationSec,
    },
  };
}
