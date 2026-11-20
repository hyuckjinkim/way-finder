/**
 * C3 — 재탐색 사이클 (RouteService.getRoute 재사용).
 *
 * 재탐색 사이클 계약(critic MAJOR — 무한 루프 방지):
 *  (1) **엣지 트리거** — `on_route→off_route` *전이 순간* 1회만 재탐색을 무장(arm)한다.
 *      레벨 트리거 금지(off_route 매 샘플 발사 방지) — 전이만 타이머를 무장한다.
 *  (2) **상태 소유** — `reroute()`는 새 `Route`를 **반환만** 한다(success 콜백 채널 경유).
 *      라우트 교체(스토어 active route swap + navMachine 재초기화)는 스토어/통합 레이어 소유 —
 *      이 컨트롤러는 navMachine을 import하지 않는다(스트림 A와 병렬, reduce 순수 유지).
 *  (3) **in-flight 가드** — `rerouting` 중 추가 재탐색 미발사(동시 1개). 완료 후 다음 이탈 평가.
 *  (4) **실패 경로** — `getRoute` reject/타임아웃 시 silent 금지: `onFailed` 신호(reroute_failed
 *      의도) + 기존 경로 유지 + 재시도 가능(에러 로깅).
 *  (5) `REROUTE_DEBOUNCE_MS` 디바운스 — 전이 무장 후 이 시간만큼 대기 후 1회 발사(쿨다운).
 *  (6) **경유지 보존** — 재탐색 stops = [현재 위치, …아직 안 지난 경유지, 목적지]. 경유지는 순서대로,
 *      위치 표본이 `WAYPOINT_REACHED_M` 안에 들어오면 지난 것으로 본다.
 *
 * **상태 소유 seam(advisor 지적):** 이 컨트롤러는 navMachine을 소유하지 않으므로 상태
 * 전이(`rerouting`/`reroute_failed`)를 **콜백 채널**(`onRerouting`/`onSuccess`/`onFailed`)로
 * 통지한다. 스토어가 이 채널을 받아 active route를 swap하고 navMachine을 재초기화한다.
 * `getRoute`는 **주입**한다(모듈 모킹 대신 — 신규 fetch 0, 스토어가 RouteService.getRoute 배선).
 */
import type { LatLng, Route, RouteRequest } from '@wayfinder/shared';
import { REROUTE_DEBOUNCE_MS, haversineDistanceM } from '@wayfinder/shared';

/** 경유지를 "지났다"고 보는 반경(m). ponytail: 근접만 본다 — 경유지를 스쳐 지나 이탈하면 남은 것으로 유지. */
export const WAYPOINT_REACHED_M = 40;

/** 재탐색 사이클 신호 채널 — 스토어/통합 레이어가 상태 전이를 소유한다. */
export interface RerouteCallbacks {
  /** 재탐색 시작(디바운스 만료·발사 직전) — 스토어는 `rerouting`으로 전이. */
  onRerouting?: () => void;
  /** 재탐색 성공 — 새 `Route` 전달. 스토어가 active route swap + navMachine 재초기화. */
  onSuccess: (route: Route) => void;
  /** 재탐색 실패 — `reroute_failed` 의도. 스토어는 기존 경로 유지·재시도 가능. */
  onFailed: (error: unknown) => void;
}

/** getRoute 주입 시그니처 (RouteService.getRoute와 동일 — 신규 fetch 0). */
type GetRoute = (req: RouteRequest) => Promise<Route>;

/**
 * 재탐색 컨트롤러. off_route 전이 입력을 받아 디바운스·in-flight 가드를 거쳐
 * `getRoute`를 1회 호출하고 결과를 콜백 채널로 통지한다.
 *
 * @param getRoute      주입된 경로 탐색기(스토어가 RouteService.getRoute 배선).
 * @param destination   목적지 좌표(재탐색 stops의 도착점).
 * @param baseRequest   원본 RouteRequest — mode/preference 보존(재탐색 인자 출처).
 * @param callbacks     상태 전이 신호 채널.
 */
export function createRerouteController(
  getRoute: GetRoute,
  destination: LatLng,
  baseRequest: RouteRequest,
  callbacks: RerouteCallbacks,
): {
  /** 매 위치 표본마다 호출 — `(현재 상태가 off_route인가, 현재 위치)`. */
  onSample: (isOffRoute: boolean, currentCoord: LatLng) => void;
  /** 진행 중 타이머 정리(세션 종료 시). */
  dispose: () => void;
} {
  let wasOffRoute = false;
  let inFlight = false;
  let armTimer: ReturnType<typeof setTimeout> | null = null;
  let pendingCoord: LatLng | null = null;
  // baseRequest.stops = [출발, …경유, 도착] — 가운데가 경유지. 지난 개수만큼 앞에서 뺀다.
  const waypoints = baseRequest.stops.slice(1, -1);
  let visited = 0;

  function fire(): void {
    armTimer = null;
    if (inFlight || pendingCoord === null) {
      return;
    }
    const currentCoord = pendingCoord;
    pendingCoord = null;
    inFlight = true;
    callbacks.onRerouting?.();

    getRoute({ ...baseRequest, stops: [currentCoord, ...waypoints.slice(visited), destination] })
      .then((route) => {
        inFlight = false;
        callbacks.onSuccess(route);
      })
      .catch((error: unknown) => {
        inFlight = false;
        console.warn('[reroute] 재탐색 실패 — 기존 경로 유지', error);
        callbacks.onFailed(error);
        // 실패 후에도 여전히 off_route면 재시도 무장. 엣지 트리거(on_route→off_route)는
        // 다시 안 걸리므로(true→true) 이 재무장이 없으면 사용자가 off_route에 고립된다.
        // 디바운스 간격이 재시도 스페이싱을 제공 — 타이트 루프 아님(advisor 지적).
        if (wasOffRoute && armTimer === null) {
          pendingCoord = currentCoord; // 새 표본이 없어도 마지막 시도 좌표로 재시도.
          armTimer = setTimeout(fire, REROUTE_DEBOUNCE_MS);
        }
      });
  }

  return {
    onSample(isOffRoute, currentCoord) {
      while (visited < waypoints.length && haversineDistanceM(currentCoord, waypoints[visited]!) <= WAYPOINT_REACHED_M) {
        visited += 1;
      }
      if (isOffRoute) {
        pendingCoord = currentCoord; // 발사 시 최신 위치 사용.
      }

      // 엣지 트리거: on_route→off_route 전이 순간에만 타이머 무장(레벨 트리거 금지).
      const isEdge = isOffRoute && !wasOffRoute;
      wasOffRoute = isOffRoute;

      if (isEdge && !inFlight && armTimer === null) {
        armTimer = setTimeout(fire, REROUTE_DEBOUNCE_MS);
      }
    },

    dispose() {
      if (armTimer !== null) {
        clearTimeout(armTimer);
        armTimer = null;
      }
      pendingCoord = null;
    },
  };
}
