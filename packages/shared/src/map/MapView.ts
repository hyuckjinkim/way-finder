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
  /** 마커 종류 — 렌더러가 모양을 고른다. 미지정=기본 핀. */
  kind?: 'place' | 'origin' | 'destination' | 'transfer' | 'user';
  /** 강조 색 (환승 마커의 노선색 등, 선택). */
  color?: string;
}

/** 화면 가장자리 여백(px) — 패널에 가려지는 영역을 빼고 맞출 때. */
export interface Insets {
  top: number;
  right: number;
  bottom: number;
  left: number;
}

/** 지도 위 폴리라인 (Phase 2 경로 표시용 — §5). */
export interface MapPolyline {
  id: string;
  coords: LatLng[];
  /** 선 색상 (CSS color, 선택). */
  color?: string;
  /** 선 두께 (선택). */
  width?: number;
  /** 점선 (도보 구간). */
  dashed?: boolean;
}

/** 지도 레이어 토글 (F7). 카카오 웹만 반영, 다른 렌더러는 무시. */
export interface MapLayers {
  traffic?: boolean;
  /** 위성(스카이뷰+라벨). */
  satellite?: boolean;
  bicycle?: boolean;
}

/** <MapView> props (§5). */
export interface MapViewProps {
  camera: CameraState;
  markers?: MapMarker[];
  /** Phase 2 경로 표시용. */
  polylines?: MapPolyline[];
  showUserLocation?: boolean;
  /** 내 위치 파란 점 좌표 (있으면 표시). */
  userLocation?: LatLng;
  /** 지정되면 지도 준비 후·값 변경 시 이 영역에 맞춘다 (camera보다 우선). */
  fitTo?: { bounds: BBox; padding?: number | Insets };
  onPress?: (coord: LatLng) => void;
  onCameraChange?: (camera: CameraState) => void;
  /** 길게 누르기(터치 ~500ms)·우클릭 좌표 (F6, 웹 구현만). */
  onLongPress?: (coord: LatLng) => void;
  /** 마커 탭 — 마커 id (웹 구현만). */
  onMarkerPress?: (id: string) => void;
  /** 이동·줌이 끝날 때 보이는 영역 (웹 구현만) — '이 지역 재검색'용. */
  onBoundsChange?: (bounds: BBox) => void;
  layers?: MapLayers;
}

/** <MapView> 명령형 ref 핸들 (§5). */
export interface MapViewRef {
  flyTo(center: LatLng, zoom?: number): void;
  fitBounds(bounds: BBox, padding?: number | Insets): void;
}
