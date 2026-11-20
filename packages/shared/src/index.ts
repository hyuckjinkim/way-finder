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
  RouteStep,
  RouteRequest,
  RouteCustomMeta,
  RoutePreference,
  ManeuverKind,
  RouteLegTraffic,
  TransitMeta,
  TravelMode,
} from './types/route.js';
export type {
  LocationSample,
  NavStatus,
  NavState,
  NavProgress,
} from './types/nav.js';
export {
  TRANSFER_BUFFER_SEC,
  MAX_WAYPOINTS,
  MAX_STOPS,
  MIN_EXTRA_MINUTES,
  MAX_EXTRA_MINUTES,
  DEFAULT_EXTRA_MINUTES,
  PROFILE_COSTING,
} from './constants/routing.js';
export type { PedestrianCostingOptions } from './constants/routing.js';
export {
  OFF_ROUTE_THRESHOLD_M,
  ARRIVAL_RADIUS_M,
  REROUTE_DEBOUNCE_MS,
} from './constants/nav.js';
export type {
  MapViewProps,
  MapLayers,
  MapViewRef,
  Insets,
  MapMarker,
  MapPolyline,
} from './map/MapView.js';
export {
  EARTH_RADIUS_M,
  toRadians,
  haversineDistanceM,
} from './geo/distance.js';
export { initialBearingDeg } from './geo/bearing.js';
export { projectToPath, pathLengthM } from './geo/projection.js';
export type { RouteProjection } from './geo/projection.js';
