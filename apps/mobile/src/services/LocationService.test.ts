/**
 * D3 — LocationService 단위 테스트.
 *
 * expo-location 전체를 vi.mock으로 대체 — 네이티브 코드 미실행.
 * 권한 부여·거부·에러 세 경로를 검증한다.
 *
 * 실행: node_modules/.bin/vitest run --config apps/mobile/src/__tests__/vitest.config.ts
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { DEFAULT_CAMERA } from './LocationService.js';

// expo-location 모킹 — 네이티브 모듈 미로드
vi.mock('expo-location', () => ({
  PermissionStatus: {
    GRANTED: 'granted',
    DENIED: 'denied',
    UNDETERMINED: 'undetermined',
  },
  LocationAccuracy: {
    Balanced: 3,
  },
  requestForegroundPermissionsAsync: vi.fn(),
  getCurrentPositionAsync: vi.fn(),
}));

import * as Location from 'expo-location';

const mockRequestPermission = vi.mocked(Location.requestForegroundPermissionsAsync);
const mockGetPosition = vi.mocked(Location.getCurrentPositionAsync);

beforeEach(() => {
  vi.clearAllMocks();
});

describe('LocationService.getCurrentCamera', () => {
  it('권한 부여 + 위치 조회 성공 — 실제 좌표 반환', async () => {
    mockRequestPermission.mockResolvedValue({
      status: 'granted' as Location.PermissionStatus,
      granted: true,
      canAskAgain: true,
      expires: 'never',
    });
    mockGetPosition.mockResolvedValue({
      coords: {
        latitude: 37.5665,
        longitude: 126.978,
        altitude: null,
        accuracy: 10,
        altitudeAccuracy: null,
        heading: null,
        speed: null,
      },
      timestamp: Date.now(),
      mocked: false,
    } as Location.LocationObject);

    const { getCurrentCamera } = await import('./LocationService.js');
    const cam = await getCurrentCamera();

    expect(cam.center.lat).toBe(37.5665);
    expect(cam.center.lng).toBe(126.978);
    expect(cam.zoom).toBe(14);
  });

  it('권한 거부 — DEFAULT_CAMERA 반환', async () => {
    mockRequestPermission.mockResolvedValue({
      status: 'denied' as Location.PermissionStatus,
      granted: false,
      canAskAgain: false,
      expires: 'never',
    });

    const { getCurrentCamera } = await import('./LocationService.js');
    const cam = await getCurrentCamera();

    expect(cam).toEqual(DEFAULT_CAMERA);
    expect(mockGetPosition).not.toHaveBeenCalled();
  });

  it('위치 조회 에러 — DEFAULT_CAMERA 반환', async () => {
    mockRequestPermission.mockResolvedValue({
      status: 'granted' as Location.PermissionStatus,
      granted: true,
      canAskAgain: true,
      expires: 'never',
    });
    mockGetPosition.mockRejectedValue(new Error('Location unavailable'));

    const { getCurrentCamera } = await import('./LocationService.js');
    const cam = await getCurrentCamera();

    expect(cam).toEqual(DEFAULT_CAMERA);
  });
});
