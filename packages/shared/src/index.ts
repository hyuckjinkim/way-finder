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
export type {
  Route,
  RouteLeg,
  RouteRequest,
  TransitMeta,
  TravelMode,
} from './types/route.js';
export { TRANSFER_BUFFER_SEC, MAX_WAYPOINTS, MAX_STOPS } from './constants/routing.js';
export type {
  MapViewProps,
  MapViewRef,
  MapMarker,
  MapPolyline,
} from './map/MapView.js';
