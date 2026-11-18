/**
 * D3 — LocationService.
 *
 * expo-location 래퍼. 웹/네이티브를 분기하고, 권한 거부·미지원 시
 * 기본 카메라(서울)로 graceful fallback한다.
 *
 * 설계 원칙:
 * - 권한 거부·에러는 throw 대신 DEFAULT_CAMERA로 폴백 (silent failure는 로깅으로 대체).
 * - 웹: Permissions API가 없는 환경도 있으므로 getCurrentPosition polyfill 경유.
 * - 테스트: expo-location 전체를 vi.mock으로 대체 — 네이티브 코드 미실행.
 */
import * as Location from 'expo-location';
import type { CameraState, LatLng } from '@wayfinder/shared';

/** 권한 거부·위치 불가 시 사용하는 기본 카메라 (서울 시청). */
export const DEFAULT_CAMERA: CameraState = {
  center: { lat: 37.5665, lng: 126.978 },
  zoom: 14,
};

/**
 * 현재 기기 위치를 카메라 상태로 반환한다.
 *
 * - 네이티브: requestForegroundPermissionsAsync → getCurrentPositionAsync
 * - 웹: 브라우저 Geolocation API (expo-location이 polyfill 제공)
 * - 권한 거부 / 에러 / 미지원 → DEFAULT_CAMERA 반환
 */
export async function getCurrentCamera(): Promise<CameraState> {
  try {
    // 웹 환경에서는 Permissions API를 expo-location이 내부적으로 처리한다.
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== Location.PermissionStatus.GRANTED) {
      console.warn('[LocationService] 위치 권한 거부 — 기본 카메라 사용');
      return DEFAULT_CAMERA;
    }

    const loc = await Location.getCurrentPositionAsync({
      accuracy: Location.LocationAccuracy.Balanced,
    });

    return {
      center: { lat: loc.coords.latitude, lng: loc.coords.longitude },
      zoom: 14,
    };
  } catch (err) {
    console.warn('[LocationService] 위치 조회 실패 — 기본 카메라 사용', err);
    return DEFAULT_CAMERA;
  }
}

/** 내 위치 조회 결과 — 거부와 실패를 구분해 호출자가 안내 문구를 고를 수 있게 한다. */
export type UserLocationResult =
  | { status: 'ok'; coord: LatLng }
  | { status: 'denied' | 'error' };

/**
 * 현재 위치 좌표만 조회한다(카메라 폴백 없음). 홈의 파란 점·시작 시 내 주변 센터링용.
 * 웹에서는 권한이 미정이면 브라우저가 여기서 권한 프롬프트를 띄운다.
 */
export async function getUserLocation(): Promise<UserLocationResult> {
  try {
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== Location.PermissionStatus.GRANTED) return { status: 'denied' };
    const loc = await Location.getCurrentPositionAsync({
      accuracy: Location.LocationAccuracy.Balanced,
    });
    return { status: 'ok', coord: { lat: loc.coords.latitude, lng: loc.coords.longitude } };
  } catch (err) {
    console.warn('[LocationService] 위치 조회 실패', err);
    return { status: 'error' };
  }
}
