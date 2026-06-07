/**
 * <MapView> 공통 인터페이스 (설계 문서 §5).
 * 4개 구현체(한국/글로벌 × 네이티브/웹)가 이 좁은 계약을 만족한다.
 * 인터페이스를 좁게 유지하는 것이 4배 테스트 매트릭스에 대한 방어선 (§5).
 */
import type { LatLng, BBox, CameraState } from '../types/geo.js';

/** 지도 위 마커. */
export interface MapMarker {
  id: string;
  coord: LatLng;
  /** 마커 라벨/타이틀 (선택). */
  title?: string;
  /** 선택 상태 (강조 표시용, 선택). */
  selected?: boolean;
}

/** 지도 위 폴리라인 (Phase 2 경로 표시용 — §5). */
export interface MapPolyline {
  id: string;
  coords: LatLng[];
  /** 선 색상 (CSS color, 선택). */
  color?: string;
  /** 선 두께 (선택). */
  width?: number;
}

/** <MapView> props (§5). */
export interface MapViewProps {
  camera: CameraState;
  markers?: MapMarker[];
  /** Phase 2 경로 표시용. */
  polylines?: MapPolyline[];
  showUserLocation?: boolean;
  onPress?: (coord: LatLng) => void;
  onCameraChange?: (camera: CameraState) => void;
}

/** <MapView> 명령형 ref 핸들 (§5). */
export interface MapViewRef {
  flyTo(center: LatLng, zoom?: number): void;
  fitBounds(bounds: BBox, padding?: number): void;
}
