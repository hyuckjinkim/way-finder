/**
 * 검색 결과 선택 시 카메라 타깃 계산 (C2 — 순수 로직).
 * 선택된 장소 좌표로 핀 + 카메라 이동(상세 진입 직전 줌 레벨).
 */
import type { CameraState, Place } from '@wayfinder/shared';

/** 장소 선택 시 이동할 카메라(장소 좌표 + 상세용 근접 줌). */
export const SELECTED_PLACE_ZOOM = 16;

export function cameraForPlace(place: Place): CameraState {
  return { center: place.coord, zoom: SELECTED_PLACE_ZOOM };
}
