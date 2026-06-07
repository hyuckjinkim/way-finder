/** @wayfinder/shared/mocks — 목 픽스처 + PlaceProvider 계약. */
export {
  SEOUL_CAFE,
  TOKYO_PLACE,
  SEARCH_RESULTS,
  PLACE_DETAILS,
} from './fixtures.js';
export {
  mockPlaceProvider,
  PlaceNotFoundError,
} from './provider.js';
export type { PlaceProvider } from './provider.js';
export {
  WALK_SIMPLE,
  BIKE_SIMPLE,
  CAR_WAYPOINT,
  TRANSIT_CHAIN,
  INTERCITY_STITCH,
  ROUTE_FIXTURE_COORDS,
} from './routeFixtures.js';
export { mockRouteProvider } from './routeProvider.js';
export type { RouteProvider } from './routeProvider.js';
