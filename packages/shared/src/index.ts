/**
 * @wayfinder/shared — 정규화 타입 + MapView 인터페이스 공개 표면.
 * 구현(mocks/region)은 서브경로 export로 분리: '@wayfinder/shared/mocks', '@wayfinder/shared/region'.
 */
export type { LatLng, BBox, CameraState } from './types/geo.js';
export type {
  Place,
  PlaceDetail,
  Rating,
  Review,
  BlogPost,
  PlaceLinks,
} from './types/place.js';
export type { Route, RouteLeg, TravelMode } from './types/route.js';
export type {
  MapViewProps,
  MapViewRef,
  MapMarker,
  MapPolyline,
} from './map/MapView.js';
