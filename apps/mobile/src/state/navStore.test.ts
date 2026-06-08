/**
 * navStore — 세션 상태 통합 테스트 (P3 최종 통합).
 *
 * 검증 핵심(advisor 지적): **status 중재 seam**. 컴포넌트 렌더 테스트(navFlow.test.tsx)는
 * NavState를 prop 직접 주입하므로 스토어가 `rerouting`을 매 표본 reduce로 덮어쓰는지를
 * 검출하지 못한다 — 그 갭을 여기서 메운다. 표본을 직접 구동해:
 *  - 재탐색 in-flight 동안 표시 status가 `rerouting`으로 유지(reduce가 off_route로 클로버 안 함)
 *  - onSuccess 시 active route swap + navMachine 재초기화
 *  - onFailed 시 오버레이 해제 → 기하 off_route 자연 노출(reroute_failed 처리)
 *
 * `getRoute`는 startNav 인자로 **주입**한다(전역 모듈 모킹 대신 — reroute.ts 주입 패턴
 * 계승, 파일 간 mock 누수 0). provider도 수동 주입(cb를 직접 보관해 표본을 임의 타이밍에 방출).
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { LatLng, LocationSample, Route, RouteRequest } from '@wayfinder/shared';
import { REROUTE_DEBOUNCE_MS } from '@wayfinder/shared';
import type { LocationProvider } from '../nav/locationProvider.js';
import { DEMO_ROUTE, DEMO_NAV_SEQUENCE } from '../nav/fixtures/gpsSequences.js';
import { useNavStore } from './navStore.js';

// getRoute — startNav에 주입(재탐색 호출을 테스트가 제어).
const getRouteMock = vi.fn<(req: RouteRequest) => Promise<Route>>();

// ── 픽스처: 정동 직선 경로(이탈을 위도 오프셋으로 단순화) ──────────────────────
const START: LatLng = { lat: 37.5, lng: 126.98 };
const END: LatLng = { lat: 37.5, lng: 126.99 };
const ROUTE: Route = {
  legs: [{ start: START, end: END, mode: 'walk', coords: [START, END], distanceM: 880, durationSec: 600 }],
  totalDistanceM: 880,
  totalDurationSec: 600,
};
const NEW_ROUTE: Route = {
  legs: [
    {
      start: START,
      end: END,
      mode: 'walk',
      coords: [START, { lat: 37.501, lng: 126.99 }, END],
      distanceM: 900,
      durationSec: 650,
    },
  ],
  totalDistanceM: 900,
  totalDurationSec: 650,
};
const BASE_REQUEST: RouteRequest = { stops: [START, END], mode: 'walk', preference: 'quiet' };

/** 경로 위(on-route) 좌표 — lng만 전진. */
function onRoute(lng: number): LocationSample {
  return { coord: { lat: 37.5, lng }, timestampMs: 0 };
}
/** 경로에서 남쪽 ~111m 이탈(OFF_ROUTE_THRESHOLD_M=30 초과). */
function offRoute(lng: number): LocationSample {
  return { coord: { lat: 37.499, lng }, timestampMs: 0 };
}

/** 수동 LocationProvider — emit()로 표본을 임의 타이밍에 방출. */
function manualProvider(): { provider: LocationProvider; emit: (s: LocationSample) => void } {
  let cb: ((s: LocationSample) => void) | null = null;
  return {
    provider: {
      watch(fn) {
        cb = fn;
        return () => {
          cb = null;
        };
      },
    },
    emit(s) {
      cb?.(s);
    },
  };
}

beforeEach(() => {
  vi.useFakeTimers();
  getRouteMock.mockReset();
  useNavStore.getState().stopNav();
});
afterEach(() => {
  useNavStore.getState().stopNav();
  vi.useRealTimers();
});

describe('navStore — 세션 시작·기하 reduce', () => {
  it('startNav은 active route와 초기 navState를 설정한다', () => {
    const { provider } = manualProvider();
    useNavStore.getState().startNav({ route: ROUTE, baseRequest: BASE_REQUEST, provider, getRoute: getRouteMock });
    const s = useNavStore.getState();
    expect(s.activeRoute).toBe(ROUTE);
    expect(s.navState?.status).toBe('navigating');
  });

  it('on-route 표본은 navigating, off-route 표본은 off_route로 reduce한다', () => {
    const { provider, emit } = manualProvider();
    useNavStore.getState().startNav({ route: ROUTE, baseRequest: BASE_REQUEST, provider, getRoute: getRouteMock });
    emit(onRoute(126.982));
    expect(useNavStore.getState().navState?.status).toBe('navigating');
    emit(offRoute(126.984));
    expect(useNavStore.getState().navState?.status).toBe('off_route');
  });
});

describe('navStore — status 중재(rerouting 오버레이)', () => {
  it('재탐색 in-flight 동안 off-route 표본에도 표시 status가 rerouting으로 유지된다', async () => {
    let resolveRoute!: (r: Route) => void;
    getRouteMock.mockReturnValue(new Promise<Route>((res) => (resolveRoute = res)));

    const { provider, emit } = manualProvider();
    useNavStore.getState().startNav({ route: ROUTE, baseRequest: BASE_REQUEST, provider, getRoute: getRouteMock });

    emit(onRoute(126.982)); // on_route
    emit(offRoute(126.984)); // 이탈 엣지 → 재탐색 무장
    await vi.advanceTimersByTimeAsync(REROUTE_DEBOUNCE_MS); // 디바운스 경과 → onRerouting 발사

    expect(getRouteMock).toHaveBeenCalledTimes(1);
    expect(useNavStore.getState().navState?.status).toBe('rerouting');

    // in-flight 중 off-route 표본이 더 들어와도 reduce가 rerouting을 덮어쓰지 않는다.
    emit(offRoute(126.985));
    expect(useNavStore.getState().navState?.status).toBe('rerouting');

    resolveRoute(NEW_ROUTE);
    await Promise.resolve();
  });

  it('onSuccess 시 active route를 swap하고 navMachine을 재초기화한다', async () => {
    getRouteMock.mockResolvedValue(NEW_ROUTE);

    const { provider, emit } = manualProvider();
    useNavStore.getState().startNav({ route: ROUTE, baseRequest: BASE_REQUEST, provider, getRoute: getRouteMock });

    emit(onRoute(126.982));
    emit(offRoute(126.984)); // 엣지
    await vi.advanceTimersByTimeAsync(REROUTE_DEBOUNCE_MS);
    await vi.advanceTimersByTimeAsync(0); // promise microtask flush

    const s = useNavStore.getState();
    expect(s.activeRoute).toBe(NEW_ROUTE); // route swap
    expect(s.navState?.status).toBe('navigating'); // 재초기화 — 오버레이 해제
  });

  it('onFailed 시 오버레이를 해제해 기하 off_route가 자연 노출된다(reroute_failed 처리)', async () => {
    getRouteMock.mockRejectedValue(new Error('network'));
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});

    const { provider, emit } = manualProvider();
    useNavStore.getState().startNav({ route: ROUTE, baseRequest: BASE_REQUEST, provider, getRoute: getRouteMock });

    emit(onRoute(126.982));
    emit(offRoute(126.984)); // 엣지
    await vi.advanceTimersByTimeAsync(REROUTE_DEBOUNCE_MS);
    await vi.advanceTimersByTimeAsync(0); // reject microtask flush

    // 오버레이 해제 → rerouting이 off_route로 복귀(기존 경로 유지).
    expect(useNavStore.getState().navState?.status).toBe('off_route');
    expect(useNavStore.getState().activeRoute).toBe(ROUTE); // 기존 경로 유지
    warn.mockRestore();
  });
});

describe('navStore — 데모 wiring 정합(DEMO_ROUTE + DEMO_NAV_SEQUENCE)', () => {
  it('합성 시퀀스가 DEMO_ROUTE에 정합 — on-route 진행으로 navigating + 턴 카드(nextStep) 노출', () => {
    const { provider, emit } = manualProvider();
    useNavStore
      .getState()
      .startNav({ route: DEMO_ROUTE, baseRequest: BASE_REQUEST, provider, getRoute: getRouteMock });

    // 초기 진행 표본들(시퀀스 앞부분)은 경로 위 → navigating(즉시 off_route 아님).
    for (const s of DEMO_NAV_SEQUENCE.slice(0, 12)) emit(s);
    const mid = useNavStore.getState().navState!;
    expect(mid.status).toBe('navigating');
    // DEMO_ROUTE.steps가 있으므로 턴 카드 입력(nextStep)이 채워진다(폴리라인 degrade 아님).
    expect(mid.nextStep).toBeDefined();

    // 시퀀스 끝(이탈 구간)에서 off_route 배너 입력으로 전이.
    for (const s of DEMO_NAV_SEQUENCE) emit(s);
    expect(useNavStore.getState().navState?.status).toBe('off_route');
  });

  it('이탈 후 디바운스 경과 시 재탐색이 DEMO_ROUTE(steps 보유)로 해소된다 — 데모 전체 사이클', async () => {
    // 데모 wiring과 동일하게 getRoute를 DEMO_ROUTE로 주입(steps 없는 transit 점프 방지).
    getRouteMock.mockResolvedValue(DEMO_ROUTE);
    const { provider, emit } = manualProvider();
    useNavStore
      .getState()
      .startNav({ route: DEMO_ROUTE, baseRequest: BASE_REQUEST, provider, getRoute: getRouteMock });

    for (const s of DEMO_NAV_SEQUENCE) emit(s); // on-route 진행 → 이탈 엣지
    expect(useNavStore.getState().navState?.status).toBe('off_route');

    // arm-timer는 합성 시퀀스 종료와 무관하게 살아있다 — 세션 mounted 동안 발사.
    await vi.advanceTimersByTimeAsync(REROUTE_DEBOUNCE_MS);
    await vi.advanceTimersByTimeAsync(0); // promise microtask flush

    const swapped = useNavStore.getState().activeRoute!;
    expect(swapped).toBe(DEMO_ROUTE); // transit 점프 아님 — 동일 geometry 경로
    expect(swapped.legs[0]?.steps?.length).toBeGreaterThan(0); // steps 보유(턴 카드 가능)
    expect(useNavStore.getState().navState?.status).toBe('navigating'); // 재초기화 — 사이클 완료
  });
});

describe('navStore — 세션 종료', () => {
  it('stopNav은 구독을 해지하고 상태를 초기화한다', () => {
    const { provider, emit } = manualProvider();
    useNavStore.getState().startNav({ route: ROUTE, baseRequest: BASE_REQUEST, provider, getRoute: getRouteMock });
    useNavStore.getState().stopNav();

    const s = useNavStore.getState();
    expect(s.activeRoute).toBeNull();
    expect(s.navState).toBeNull();

    // 해지 후 표본은 무시(navState 재생성 안 됨).
    emit(onRoute(126.982));
    expect(useNavStore.getState().navState).toBeNull();
  });
});
