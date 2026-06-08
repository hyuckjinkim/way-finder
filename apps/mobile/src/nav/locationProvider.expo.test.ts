/**
 * C2 — 실 LocationProvider 실-모드 테스트 (carry-forward 게이트).
 *
 * `vi.mock('expo-location')`로 네이티브 미실행. 단언:
 *  (1) watch → `watchPositionAsync` 구독 시작(옵션 포함),
 *  (2) GPS 업데이트 → `LocationSample` 매핑(null→undefined 포함)으로 cb 호출,
 *  (3) 해지 → 구독 resolve 후 `subscription.remove()` 호출(teardown-after-resolve),
 *  (4) 구독 resolve 전 해지 → 늦게 도착한 구독도 즉시 remove(누수 방지).
 *
 * LocationService.test.ts 패턴 계승. **합성 impl(C1)은 이 분기 커버리지로 불인정** —
 * 실 expo-location 구독·매핑·해지를 mock으로 직접 단언하는 것이 게이트.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('expo-location', () => ({
  LocationAccuracy: {
    BestForNavigation: 6,
  },
  watchPositionAsync: vi.fn(),
}));

import * as Location from 'expo-location';
import { createExpoLocationProvider, toLocationSample } from './locationProvider.expo.js';

const mockWatch = vi.mocked(Location.watchPositionAsync);

/** expo LocationObject 합성기 — null 필드 포함(매핑 검증용). */
function locObject(over: Partial<Location.LocationObjectCoords> = {}): Location.LocationObject {
  return {
    coords: {
      latitude: 37.5665,
      longitude: 126.978,
      altitude: null,
      accuracy: 8,
      altitudeAccuracy: null,
      heading: 90,
      speed: 1.4,
      ...over,
    },
    timestamp: 1_700_000_000_000,
    mocked: false,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('toLocationSample — expo LocationObject 매핑', () => {
  it('coords/timestamp를 LocationSample로 매핑한다', () => {
    const s = toLocationSample(locObject());
    expect(s).toEqual({
      coord: { lat: 37.5665, lng: 126.978 },
      headingDeg: 90,
      speedMps: 1.4,
      accuracyM: 8,
      timestampMs: 1_700_000_000_000,
    });
  });

  it('null heading/speed/accuracy를 undefined로 수렴한다(누수 방지)', () => {
    const s = toLocationSample(locObject({ heading: null, speed: null, accuracy: null }));
    expect(s.headingDeg).toBeUndefined();
    expect(s.speedMps).toBeUndefined();
    expect(s.accuracyM).toBeUndefined();
    expect(s.coord).toEqual({ lat: 37.5665, lng: 126.978 });
  });
});

describe('createExpoLocationProvider.watch — 구독·매핑·해지', () => {
  it('watch 시 watchPositionAsync를 BestForNavigation 옵션으로 구독한다', () => {
    mockWatch.mockResolvedValue({ remove: vi.fn() });
    const provider = createExpoLocationProvider();

    provider.watch(() => {});

    expect(mockWatch).toHaveBeenCalledTimes(1);
    const [options] = mockWatch.mock.calls[0]!;
    expect(options.accuracy).toBe(Location.LocationAccuracy.BestForNavigation);
  });

  it('GPS 업데이트를 LocationSample로 매핑해 cb를 호출한다', () => {
    mockWatch.mockResolvedValue({ remove: vi.fn() });
    const provider = createExpoLocationProvider();
    const cb = vi.fn();

    provider.watch(cb);
    // watchPositionAsync에 전달된 expo 콜백을 직접 구동(GPS 업데이트 모사).
    const expoCallback = mockWatch.mock.calls[0]![1];
    expoCallback(locObject({ heading: null }));

    expect(cb).toHaveBeenCalledTimes(1);
    expect(cb).toHaveBeenCalledWith({
      coord: { lat: 37.5665, lng: 126.978 },
      headingDeg: undefined,
      speedMps: 1.4,
      accuracyM: 8,
      timestampMs: 1_700_000_000_000,
    });
  });

  it('해지 시 구독 resolve 후 subscription.remove()를 호출한다(teardown-after-resolve)', async () => {
    const remove = vi.fn();
    mockWatch.mockResolvedValue({ remove });
    const provider = createExpoLocationProvider();

    const unwatch = provider.watch(() => {});
    // 구독 promise resolve 대기 — 마이크로태스크 flush.
    await Promise.resolve();
    await Promise.resolve();

    unwatch();
    expect(remove).toHaveBeenCalledTimes(1);
  });

  it('구독 resolve 전 해지 시 늦게 도착한 구독도 즉시 remove한다(누수 방지)', async () => {
    const remove = vi.fn();
    let resolveSub!: (s: Location.LocationSubscription) => void;
    mockWatch.mockReturnValue(
      new Promise<Location.LocationSubscription>((res) => {
        resolveSub = res;
      }),
    );
    const provider = createExpoLocationProvider();

    const unwatch = provider.watch(() => {});
    unwatch(); // 구독 resolve 전 해지
    expect(remove).not.toHaveBeenCalled();

    resolveSub({ remove }); // 늦게 도착
    await Promise.resolve();
    expect(remove).toHaveBeenCalledTimes(1);
  });
});
