/**
 * C2 — 실 LocationProvider (expo-location `watchPositionAsync`).
 *
 * carry-forward 게이트(§0·§7): 실 GPS 구독→`LocationSample` 매핑→cb, 해지 시
 * `subscription.remove()`. **`vi.mock('expo-location')` 실-모드 테스트가 완료 기준** —
 * 합성 impl(C1)은 이 분기 커버리지로 불인정(P2-B "엔진 green, 핸들러 미배선"의 GPS형
 * 재발 방지). LocationService.ts의 vi.mock 패턴 계승.
 *
 * **async/sync seam(advisor 핵심 지적):** `watchPositionAsync`는 `Promise<Subscription>`이나
 * `LocationProvider.watch`는 **동기 해지 함수**를 반환해야 한다. 구독이 아직 resolve되지
 * 않은 상태에서 해지가 호출될 수 있으므로 `cancelled` 플래그로 늦게 도착한 구독도 즉시
 * 정리한다(누수 방지).
 *
 * **디바이스 한계(§8):** update cadence/accuracy는 디바이스 필요(post-key/에뮬레이터).
 * 백그라운드 추적(`startLocationUpdatesAsync`)·`app.config.ts` background-mode·화면 wake는
 * 배선+typecheck까지(별도 QA).
 */
import * as Location from 'expo-location';
import type { LocationSample } from '@wayfinder/shared';
import type { LocationProvider } from './locationProvider.js';

/**
 * expo-location `LocationObject` → `LocationSample` 매핑.
 * expo coords의 `number | null`(heading/speed/accuracy)을 optional(`?? undefined`)로
 * 수렴 — null 누수·타입 불일치 방지(advisor 지적).
 */
export function toLocationSample(loc: Location.LocationObject): LocationSample {
  const { coords, timestamp } = loc;
  return {
    coord: { lat: coords.latitude, lng: coords.longitude },
    headingDeg: coords.heading ?? undefined,
    speedMps: coords.speed ?? undefined,
    accuracyM: coords.accuracy ?? undefined,
    timestampMs: timestamp,
  };
}

/** `watchPositionAsync` 구독 옵션 — 도보 네비용 고정밀·짧은 갱신 간격. */
const WATCH_OPTIONS: Location.LocationOptions = {
  accuracy: Location.LocationAccuracy.BestForNavigation,
  distanceInterval: 5,
  timeInterval: 1000,
};

/**
 * 실 LocationProvider — expo-location `watchPositionAsync` 기반.
 * `watch(cb)`는 구독을 시작하고 동기 해지 함수를 반환한다.
 */
export function createExpoLocationProvider(): LocationProvider {
  return {
    watch(cb) {
      let subscription: Location.LocationSubscription | null = null;
      let cancelled = false;

      void Location.watchPositionAsync(WATCH_OPTIONS, (loc) => {
        cb(toLocationSample(loc));
      }).then((sub) => {
        // 구독이 resolve되기 전 해지가 호출됐다면(늦게 도착) 즉시 정리.
        if (cancelled) {
          sub.remove();
        } else {
          subscription = sub;
        }
      });

      return () => {
        cancelled = true;
        subscription?.remove();
        subscription = null;
      };
    },
  };
}
