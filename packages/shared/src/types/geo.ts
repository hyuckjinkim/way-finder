/**
 * 지리 기본 타입. 모든 좌표는 WGS84 통일 (설계 문서 §5).
 */

/** WGS84 위경도 좌표. */
export interface LatLng {
  lat: number;
  lng: number;
}

/**
 * 지리적 경계 상자 (bounding box). 남서(sw)·북동(ne) 두 꼭짓점으로 표현.
 * 지도 fitBounds·지역 판정에 사용.
 */
export interface BBox {
  sw: LatLng;
  ne: LatLng;
}

/**
 * 지도 카메라 상태. center + zoom (설계 문서 §5 MapViewProps.camera).
 * 지역 전환 시 카메라 상태 이어받기에 사용.
 */
export interface CameraState {
  center: LatLng;
  zoom: number;
}
