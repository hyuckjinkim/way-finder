/**
 * C3 — 재탐색 사이클 단위 테스트 (`vi.useFakeTimers()` 필수).
 *
 * 재탐색 계약 실증:
 *  (1) **no-storm** — off_route 연속 N샘플에도 getRoute **1회만**(엣지+디바운스+in-flight).
 *  (2) **인자 단언** — getRoute가 `{ stops: [현재위치, 목적지], mode, preference }`로 호출.
 *  (3) **상태 소유** — onRerouting/onSuccess 콜백으로 통지(컨트롤러는 라우트 교체 안 함).
 *  (4) **실패 경로** — getRoute reject 시 onFailed(reroute_failed 의도) + in-flight 해제(재시도 가능).
 *  (5) **재진입** — 복귀(on_route) 후 재이탈은 다시 1회 발사(엣지 재무장).
 *
 * `getRoute`는 주입(모듈 모킹 아님 — 신규 fetch 0). 인자 단언만으론 no-storm 미증명이므로
 * fake timers로 연속 샘플·디바운스 경과·promise resolve를 직접 구동한다.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { LatLng, Route, RouteRequest } from '@wayfinder/shared';
import { REROUTE_DEBOUNCE_MS } from '@wayfinder/shared';
import { createRerouteController } from './reroute.js';

const DEST: LatLng = { lat: 37.5705, lng: 126.99 };
const BASE_REQUEST: RouteRequest = {
  stops: [{ lat: 37.5664, lng: 126.9779 }, DEST],
  mode: 'walk',
  preference: 'quiet',
};

const NEW_ROUTE: Route = { legs: [], totalDurationSec: 100, totalDistanceM: 200 };

function coord(i: number): LatLng {
  return { lat: 37.57 - i * 0.0001, lng: 126.987 };
}

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

describe('createRerouteController — no-storm', () => {
  it('off_route 연속 N샘플에도 getRoute를 1회만 호출한다', async () => {
    const getRoute = vi.fn().mockResolvedValue(NEW_ROUTE);
    const onSuccess = vi.fn();
    const ctrl = createRerouteController(getRoute, DEST, BASE_REQUEST, { onSuccess, onFailed: vi.fn() });

    // 전이(on→off) 1회 + off_route 레벨 반복 N샘플.
    ctrl.onSample(false, coord(0)); // on_route
    for (let i = 1; i <= 8; i++) {
      ctrl.onSample(true, coord(i)); // off_route 연속 8샘플
    }

    expect(getRoute).not.toHaveBeenCalled(); // 디바운스 경과 전 미발사

    await vi.advanceTimersByTimeAsync(REROUTE_DEBOUNCE_MS);

    expect(getRoute).toHaveBeenCalledTimes(1); // no-storm: 1회만
    expect(onSuccess).toHaveBeenCalledTimes(1);
    expect(onSuccess).toHaveBeenCalledWith(NEW_ROUTE);
  });

  it('in-flight 중 추가 off_route 샘플은 새 재탐색을 발사하지 않는다', async () => {
    let resolveRoute!: (r: Route) => void;
    const getRoute = vi.fn().mockReturnValue(
      new Promise<Route>((res) => {
        resolveRoute = res;
      }),
    );
    const ctrl = createRerouteController(getRoute, DEST, BASE_REQUEST, { onSuccess: vi.fn(), onFailed: vi.fn() });

    ctrl.onSample(false, coord(0));
    ctrl.onSample(true, coord(1)); // 엣지 → 무장
    await vi.advanceTimersByTimeAsync(REROUTE_DEBOUNCE_MS);
    expect(getRoute).toHaveBeenCalledTimes(1); // in-flight 시작

    // in-flight 중 off_route 샘플 계속 — 발사 안 됨(wasOffRoute=true라 엣지 아님).
    for (let i = 2; i <= 6; i++) {
      ctrl.onSample(true, coord(i));
    }
    await vi.advanceTimersByTimeAsync(REROUTE_DEBOUNCE_MS * 2);
    expect(getRoute).toHaveBeenCalledTimes(1); // 여전히 1회

    resolveRoute(NEW_ROUTE);
    await Promise.resolve();
  });
});

describe('createRerouteController — 인자', () => {
  it('getRoute를 현재 위치·목적지·동일 mode/preference로 호출한다', async () => {
    const getRoute = vi.fn().mockResolvedValue(NEW_ROUTE);
    const ctrl = createRerouteController(getRoute, DEST, BASE_REQUEST, { onSuccess: vi.fn(), onFailed: vi.fn() });

    ctrl.onSample(false, coord(0));
    ctrl.onSample(true, coord(3)); // 엣지 — pendingCoord=coord(3)
    ctrl.onSample(true, coord(5)); // 최신 위치로 갱신 → coord(5)
    await vi.advanceTimersByTimeAsync(REROUTE_DEBOUNCE_MS);

    expect(getRoute).toHaveBeenCalledWith({
      stops: [coord(5), DEST],
      mode: 'walk',
      preference: 'quiet',
    });
  });
});

describe('createRerouteController — 상태 소유·실패', () => {
  it('발사 직전 onRerouting을 통지한다(스토어가 rerouting 전이 소유)', async () => {
    const getRoute = vi.fn().mockResolvedValue(NEW_ROUTE);
    const onRerouting = vi.fn();
    const ctrl = createRerouteController(getRoute, DEST, BASE_REQUEST, {
      onRerouting,
      onSuccess: vi.fn(),
      onFailed: vi.fn(),
    });

    ctrl.onSample(false, coord(0));
    ctrl.onSample(true, coord(1));
    expect(onRerouting).not.toHaveBeenCalled(); // 디바운스 전
    await vi.advanceTimersByTimeAsync(REROUTE_DEBOUNCE_MS);
    expect(onRerouting).toHaveBeenCalledTimes(1);
  });

  it('getRoute 실패 시 onFailed를 통지하고 in-flight를 해제한다(재시도 가능)', async () => {
    const err = new Error('network down');
    const getRoute = vi
      .fn()
      .mockRejectedValueOnce(err)
      .mockResolvedValueOnce(NEW_ROUTE);
    const onSuccess = vi.fn();
    const onFailed = vi.fn();
    const ctrl = createRerouteController(getRoute, DEST, BASE_REQUEST, { onSuccess, onFailed });

    ctrl.onSample(false, coord(0));
    ctrl.onSample(true, coord(1)); // 1차 이탈
    await vi.advanceTimersByTimeAsync(REROUTE_DEBOUNCE_MS);
    expect(onFailed).toHaveBeenCalledTimes(1);
    expect(onFailed).toHaveBeenCalledWith(err);
    expect(onSuccess).not.toHaveBeenCalled();

    // in-flight 해제됐으므로 복귀 후 재이탈은 재시도 가능.
    ctrl.onSample(false, coord(2)); // on_route 복귀
    ctrl.onSample(true, coord(3)); // 재이탈 → 엣지 재무장
    await vi.advanceTimersByTimeAsync(REROUTE_DEBOUNCE_MS);
    expect(getRoute).toHaveBeenCalledTimes(2);
    expect(onSuccess).toHaveBeenCalledTimes(1);
  });

  // advisor 지적: 실패 후 on_route 복귀 없이 계속 off_route면 엣지(true→true 부재)가
  // 재발화 못 해 사용자가 고립될 수 있다. 실패 시 재무장으로 자동 재시도해야 한다.
  it('실패 후 off_route를 유지하면(복귀 없이) 디바운스마다 자동 재시도한다', async () => {
    const err = new Error('network down');
    const getRoute = vi
      .fn()
      .mockRejectedValueOnce(err) // 1차 실패
      .mockResolvedValueOnce(NEW_ROUTE); // 2차 성공
    const onSuccess = vi.fn();
    const onFailed = vi.fn();
    const ctrl = createRerouteController(getRoute, DEST, BASE_REQUEST, { onSuccess, onFailed });

    ctrl.onSample(false, coord(0));
    ctrl.onSample(true, coord(1)); // 이탈 → 1차 발사
    await vi.advanceTimersByTimeAsync(REROUTE_DEBOUNCE_MS);
    expect(getRoute).toHaveBeenCalledTimes(1);
    expect(onFailed).toHaveBeenCalledTimes(1);

    // 복귀 표본 없이 계속 off_route — 추가 onSample 없이 디바운스만 경과.
    await vi.advanceTimersByTimeAsync(REROUTE_DEBOUNCE_MS);
    expect(getRoute).toHaveBeenCalledTimes(2); // 자동 재시도(고립 방지)
    expect(onSuccess).toHaveBeenCalledTimes(1);
  });
});

describe('createRerouteController — 엣지 재진입', () => {
  it('복귀(on_route) 후 재이탈은 다시 1회 발사한다', async () => {
    const getRoute = vi.fn().mockResolvedValue(NEW_ROUTE);
    const ctrl = createRerouteController(getRoute, DEST, BASE_REQUEST, { onSuccess: vi.fn(), onFailed: vi.fn() });

    ctrl.onSample(false, coord(0));
    ctrl.onSample(true, coord(1)); // 1차 이탈
    await vi.advanceTimersByTimeAsync(REROUTE_DEBOUNCE_MS);
    expect(getRoute).toHaveBeenCalledTimes(1);

    ctrl.onSample(false, coord(2)); // 복귀
    ctrl.onSample(true, coord(3)); // 2차 이탈 → 엣지 재무장
    await vi.advanceTimersByTimeAsync(REROUTE_DEBOUNCE_MS);
    expect(getRoute).toHaveBeenCalledTimes(2);
  });

  it('dispose는 무장된 타이머를 정리한다(세션 종료)', async () => {
    const getRoute = vi.fn().mockResolvedValue(NEW_ROUTE);
    const ctrl = createRerouteController(getRoute, DEST, BASE_REQUEST, { onSuccess: vi.fn(), onFailed: vi.fn() });

    ctrl.onSample(false, coord(0));
    ctrl.onSample(true, coord(1)); // 무장
    ctrl.dispose();
    await vi.advanceTimersByTimeAsync(REROUTE_DEBOUNCE_MS * 2);
    expect(getRoute).not.toHaveBeenCalled(); // dispose로 미발사
  });
});
