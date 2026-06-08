/**
 * navStore — 네비 세션 상태 (P3 최종 통합).
 *
 * 소유 책임(계획 §4 C3 (2)항 "상태 소유는 스토어"):
 *  - active `Route` + `NavState`를 보유한다.
 *  - LocationProvider 구독 → 매 표본마다 `navReduce` → `NavState` 갱신.
 *  - **재탐색 라우트 교체 소유** — C3 `reroute()`가 반환한 새 `Route`로 active route를
 *    swap하고 navMachine을 재초기화한다(reduce 순수 유지·컨트롤러는 swap 안 함).
 *  - in-flight 가드·실패 반영은 createRerouteController가 담당, 스토어는 그 콜백을 수신.
 *
 * **status 중재 seam(advisor 핵심):** `navReduce`는 매 표본 기하만으로 status를 산출한다 —
 * 재탐색 in-flight 중에도 기하는 여전히 `off_route`라 reduce가 `rerouting`을 매번 덮어쓴다.
 * 따라서 스토어가 **`rerouting` 오버레이를 기하 status 위에 적용**한다: `onRerouting`이
 * 오버레이를 켜면 표시 status는 `rerouting`으로 고정되고, `onSuccess`(라우트 swap·재초기화)
 * 또는 `onFailed`(오버레이 해제 → 기하 `off_route` 자연 노출 = reroute_failed 처리)가 끈다.
 * `reroute_failed`는 NavStatus enum에 없다(F1 동결) — 오버레이 해제로 표현(스코프 최소).
 */
import { create } from 'zustand';
import type { LatLng, LocationSample, NavState, Route, RouteRequest } from '@wayfinder/shared';
import { initialNavState, navReduce } from '../nav/navMachine.js';
import {
  createRerouteController,
  type RerouteCallbacks,
} from '../nav/reroute.js';
import type { LocationProvider } from '../nav/locationProvider.js';
import type { VoiceGuide } from '../nav/voiceGuide.js';
import { navInstructionText } from '../nav/navInstructionText.js';
import { getRoute as defaultGetRoute } from '../services/RouteService.js';

/** 재탐색 경로 탐색기 시그니처 (RouteService.getRoute와 동일 — C3 주입 패턴). */
type GetRoute = (req: RouteRequest) => Promise<Route>;

/** 세션 시작 인자. */
export interface StartNavArgs {
  /** 안내할 경로. */
  route: Route;
  /** 원본 RouteRequest — 재탐색 시 mode/preference 보존(C3 인자 출처). */
  baseRequest: RouteRequest;
  /** 위치 표본 출처(합성=데모, expo=실 GPS). */
  provider: LocationProvider;
  /**
   * 재탐색 경로 탐색기 (선택). 미지정 시 RouteService.getRoute — 앱은 항상 미지정
   * (스토어가 RouteService를 배선). 테스트는 fake를 주입한다(모듈 모킹 대신 — reroute.ts
   * 주입 패턴 계승, 전역 모듈 교체 없이 격리). C3 (2)항 계약 불변.
   */
  getRoute?: GetRoute;
  /**
   * 음성 안내 엔진 (P5 U2, 선택). 미지정 시 음성 배선 없음(기존 동작 — 무회귀).
   * 통합 레이어(U2)가 다음 턴(`activeStepIndex`) 변경 시 `navInstructionText`로 문장을
   * 생성해 `speak`한다. 실 모드=`createVoiceGuide()`(expo), 데모/테스트=합성 spy.
   * navMachine은 순수 유지 — 발화 소유는 스토어(P3 경계 계승).
   */
  voiceGuide?: VoiceGuide;
}

/** 세션 컨트롤러 핸들 — 구독 해지 + reroute 타이머 정리. */
interface SessionHandle {
  unwatch: () => void;
  disposeReroute: () => void;
}

export interface NavSessionState {
  /** 활성 경로(재탐색 성공 시 swap). null=세션 미시작. */
  activeRoute: Route | null;
  /** 현재 표시 NavState(기하 status에 rerouting 오버레이 적용). */
  navState: NavState | null;
}

export interface NavSessionActions {
  /** 세션 시작 — 경로·provider 구독·reroute 컨트롤러 무장. */
  startNav(args: StartNavArgs): void;
  /** 세션 종료 — 구독 해지·타이머 정리·상태 초기화. */
  stopNav(): void;
  /**
   * 음성 안내 on/off 토글 (P5 U2). NavScreen 토글 intent를 수신해 발화 게이트를
   * 켜고/끈다. off 시 현재·대기 발화를 즉시 중단(`voiceGuide.stop`). NavScreen은
   * 버튼 레이블용 로컬 상태만 보유(U1 "intent만 방출") — 실 게이트는 여기 소유.
   */
  setVoiceEnabled(enabled: boolean): void;
}

/** 목적지(재탐색 stops 도착점) = 마지막 leg의 end. */
function destinationOf(route: Route): LatLng {
  const leg = route.legs[route.legs.length - 1];
  return leg?.end ?? route.legs[0]?.start ?? { lat: 0, lng: 0 };
}

export const useNavStore = create<NavSessionState & NavSessionActions>((set, get) => {
  // 모듈 단일 세션 — 동시 1개 네비(중복 구독 방지). 클로저로 보유(상태 외부).
  let session: SessionHandle | null = null;
  let rerouting = false;
  // 음성 게이트·엔진(P5 U2 — rerouting과 동일 클로저 idiom, 반응형 상태 미도입).
  let voiceEnabled = false;
  let voice: VoiceGuide | null = null;

  /** rerouting 오버레이를 기하 status 위에 적용한다(advisor seam). */
  function applyOverlay(geo: NavState): NavState {
    return rerouting ? { ...geo, status: 'rerouting' } : geo;
  }

  /**
   * 음성 발화 — 토글 on이고 다음 턴(`activeStepIndex`)이 직전과 다를 때만(P5 U2).
   * `navInstructionText`로 모드별 문장을 생성(mode=활성 leg에서 도출). 동일 step
   * 재발화는 S2 합성 디바운스(직전 동일 텍스트 억제)가 백스톱 — `navInstructionText`
   * 출력은 step당 안정적(거리는 `step.distanceM` 키, 매 표본 distanceToNextTurnM 아님).
   */
  function maybeSpeak(prev: NavState, geo: NavState, route: Route): void {
    if (!voiceEnabled || !voice) return;
    if (!geo.nextStep || geo.activeStepIndex === prev.activeStepIndex) return;
    const mode = route.legs[geo.activeLegIndex]?.mode ?? 'walk';
    voice.speak(navInstructionText(geo.nextStep, mode));
  }

  function teardown(): void {
    if (session) {
      session.unwatch();
      session.disposeReroute();
      session = null;
    }
    rerouting = false;
    voice?.stop();
  }

  return {
    activeRoute: null,
    navState: null,

    startNav({ route, baseRequest, provider, getRoute = defaultGetRoute, voiceGuide }) {
      // 기존 세션이 있으면 먼저 정리(중복 구독·누수 방지).
      teardown();

      let currentRoute = route;
      rerouting = false;
      voice = voiceGuide ?? null;
      voiceEnabled = false; // 토글 off로 시작 — NavScreen 토글이 켤 때 발화(U1 기본).
      set({ activeRoute: route, navState: initialNavState(route) });

      const callbacks: RerouteCallbacks = {
        onRerouting() {
          rerouting = true;
          const cur = get().navState;
          if (cur) set({ navState: { ...cur, status: 'rerouting' } });
        },
        onSuccess(newRoute) {
          // 라우트 교체 소유(C3 (2)항): active route swap + navMachine 재초기화.
          rerouting = false;
          currentRoute = newRoute;
          set({ activeRoute: newRoute, navState: initialNavState(newRoute) });
        },
        onFailed(error) {
          // reroute_failed 처리(NavStatus enum 부재): 오버레이 해제 → 기하 off_route 자연 노출.
          rerouting = false;
          console.warn('[navStore] 재탐색 실패 — 기존 경로 유지', error);
          const cur = get().navState;
          if (cur && cur.status === 'rerouting') {
            set({ navState: { ...cur, status: 'off_route' } });
          }
        },
      };

      const controller = createRerouteController(
        getRoute,
        destinationOf(route),
        baseRequest,
        callbacks,
      );

      const unwatch = provider.watch((sample: LocationSample) => {
        const prev = get().navState ?? initialNavState(currentRoute);
        const geo = navReduce(prev, sample, currentRoute);
        // 기하 status로 컨트롤러 구동(in-flight 가드가 반복 true 흡수).
        controller.onSample(geo.status === 'off_route', sample.coord);
        // 음성: 다음 턴(activeStepIndex) 변경 시 발화(토글 on일 때만).
        maybeSpeak(prev, geo, currentRoute);
        set({ navState: applyOverlay(geo) });
      });

      session = { unwatch, disposeReroute: controller.dispose };
    },

    stopNav() {
      teardown();
      set({ activeRoute: null, navState: null });
    },

    setVoiceEnabled(enabled: boolean) {
      voiceEnabled = enabled;
      // off로 전환 시 현재·대기 발화 즉시 중단(억제 상태도 초기화 — 재토글 시 재발화).
      if (!enabled) voice?.stop();
    },
  };
});
