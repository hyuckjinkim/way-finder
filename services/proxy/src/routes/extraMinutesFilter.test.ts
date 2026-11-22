/**
 * OO1 — "+N분" 필터 엔진 단위 테스트 (P4 §1 2-call 백본).
 *
 * F1 `ValhallaProvider` 인터페이스를 **mock 주입**해 A lane 구현 대기 없이 검증.
 * 산술·경계(N=0, P>T+N 폴백 규약)·플래그·baseline 채움을 단언.
 */
import { describe, it, expect } from 'vitest';
import { applyExtraMinutesFilter } from './extraMinutesFilter.js';
import type { ValhallaProvider } from './routeDirect.js';
import type {
  Route,
  RouteRequest,
  PedestrianCostingOptions,
} from '@wayfinder/shared';
import { PROFILE_COSTING } from '@wayfinder/shared';

const STOPS = [
  { lat: 37.5663, lng: 126.9779 },
  { lat: 37.5704, lng: 126.9921 },
];

/** 소요(초)만 의미 있는 최소 Route 픽스처. */
function routeOf(durationSec: number): Route {
  return {
    legs: [
      {
        start: STOPS[0]!,
        end: STOPS[1]!,
        mode: 'walk',
        durationSec,
        distanceM: durationSec, // 임의 — 본 테스트는 duration만 평가
        coords: [STOPS[0]!, STOPS[1]!],
      },
    ],
    totalDurationSec: durationSec,
    totalDistanceM: durationSec,
  };
}

/**
 * mock provider — 'fastest' 요청엔 T, 그 외엔 P 소요를 반환한다.
 * 호출 인자(req·costing)를 기록해 2-call 위임을 단언할 수 있게 한다.
 */
function mockProvider(
  baselineSec: number,
  profileSec: number,
): {
  provider: ValhallaProvider;
  calls: Array<{ req: RouteRequest; costing: PedestrianCostingOptions }>;
} {
  const calls: Array<{ req: RouteRequest; costing: PedestrianCostingOptions }> = [];
  const provider: ValhallaProvider = {
    async route(req, costing) {
      calls.push({ req, costing });
      return routeOf(req.preference === 'fastest' ? baselineSec : profileSec);
    },
  };
  return { provider, calls };
}

function req(
  preference: RouteRequest['preference'],
  maxExtraMinutes?: number,
): RouteRequest {
  return { stops: STOPS, mode: 'walk', preference, maxExtraMinutes };
}

describe('applyExtraMinutesFilter — 2-call +N 백본', () => {
  it('기본+프로필 2회 호출 — fastest costing(빈)·프로필 costing 위임', async () => {
    const { provider, calls } = mockProvider(600, 700);
    await applyExtraMinutesFilter(provider, req('walkable', 10));

    expect(calls).toHaveLength(2);
    // 1번째 = 최속 baseline: preference 'fastest'로 덮고 빈 costing.
    expect(calls[0]!.req.preference).toBe('fastest');
    expect(calls[0]!.costing).toEqual({});
    // 2번째 = 프로필: 원 preference + PROFILE_COSTING 매핑값.
    expect(calls[1]!.req.preference).toBe('walkable');
    expect(calls[1]!.costing).toEqual(PROFILE_COSTING.walkable);
  });

  it('항상 P(프로필 경로)를 서빙 — T로 스왑하지 않음 (F1 폴백 규약)', async () => {
    // P가 예산 초과여도 P의 소요를 반환(스왑 금지). baseline은 메타에만.
    const { provider } = mockProvider(600, 900);
    const out = await applyExtraMinutesFilter(provider, req('safe', 2));
    expect(out.totalDurationSec).toBe(900); // P, not T(600)
    expect(out.customMeta!.baselineDurationSec).toBe(600);
  });

  it('P ≤ T + N → withinBudget true', async () => {
    // T=600, N=5분=300초 → 예산 900. P=850 ≤ 900.
    const { provider } = mockProvider(600, 850);
    const out = await applyExtraMinutesFilter(provider, req('walkable', 5));
    expect(out.customMeta!.withinBudget).toBe(true);
  });

  it('경계: P = T + N 정확히 (≤) → withinBudget true', async () => {
    // T=600, N=5분=300초 → 예산 900. P=900 == 900.
    const { provider } = mockProvider(600, 900);
    const out = await applyExtraMinutesFilter(provider, req('walkable', 5));
    expect(out.customMeta!.withinBudget).toBe(true);
  });

  it('P > T + N → withinBudget false (예산 초과 플래그)', async () => {
    // T=600, N=5분=300초 → 예산 900. P=901 > 900.
    const { provider } = mockProvider(600, 901);
    const out = await applyExtraMinutesFilter(provider, req('walkable', 5));
    expect(out.customMeta!.withinBudget).toBe(false);
  });

  it('경계 N=0 — P가 T보다 조금이라도 길면 초과', async () => {
    const { provider } = mockProvider(600, 601);
    const out = await applyExtraMinutesFilter(provider, req('walkable', 0));
    expect(out.customMeta!.withinBudget).toBe(false);
  });

  it('경계 N=0 — P = T(동일) → 예산 내', async () => {
    const { provider } = mockProvider(600, 600);
    const out = await applyExtraMinutesFilter(provider, req('walkable', 0));
    expect(out.customMeta!.withinBudget).toBe(true);
  });

  it('N 미지정(무제한) → 어떤 초과여도 withinBudget true', async () => {
    const { provider } = mockProvider(600, 5000);
    const out = await applyExtraMinutesFilter(provider, req('safe', undefined));
    expect(out.customMeta!.withinBudget).toBe(true);
  });

  it('customMeta.preference는 원 요청 프로필 (baseline의 fastest 아님)', async () => {
    const { provider } = mockProvider(600, 700);
    const out = await applyExtraMinutesFilter(provider, req('quiet', 10));
    expect(out.customMeta!.preference).toBe('quiet');
  });

  it('scenic(PROFILE_COSTING 미존재) → 빈 costing 폴백, provider에 undefined 미전달', async () => {
    const { provider, calls } = mockProvider(600, 700);
    const out = await applyExtraMinutesFilter(provider, req('scenic', 10));
    expect(calls[1]!.costing).toEqual({}); // PROFILE_COSTING.scenic === undefined → {}
    expect(out.customMeta!.preference).toBe('scenic');
  });

  it('preference 미지정 → 방어적 fastest 취급', async () => {
    const { provider } = mockProvider(600, 700);
    const out = await applyExtraMinutesFilter(provider, req(undefined, 10));
    expect(out.customMeta!.preference).toBe('fastest');
  });

  it('N(분) → 초 변환 정확성 (분 단위 혼동 방지)', async () => {
    // N=1분 = 60초. T=600. 예산=660. P=660 통과, P=661 초과.
    const a = await applyExtraMinutesFilter(mockProvider(600, 660).provider, req('walkable', 1));
    const b = await applyExtraMinutesFilter(mockProvider(600, 661).provider, req('walkable', 1));
    expect(a.customMeta!.withinBudget).toBe(true);
    expect(b.customMeta!.withinBudget).toBe(false);
  });
});
