/**
 * 결정론적 라우팅 목 픽스처 (설계 문서 §8).
 * 앱 데모 모드와 프록시 테스트 양쪽의 공통 입력. 키 0개 동작.
 *
 * 환승 버퍼는 shared 상수 `TRANSFER_BUFFER_SEC`를 import해 산술에 사용한다
 * (자체 상수 금지 — F1.2 동결). 각 픽스처의 totalDurationSec은
 * Σ leg.durationSec + TRANSFER_BUFFER_SEC × (환승 수) 로 일관되게 계산한다.
 */
import type { LatLng } from '../types/geo.js';
import type { Route, RouteLeg } from '../types/route.js';
import { TRANSFER_BUFFER_SEC } from '../constants/routing.js';

// ── 좌표 (서울 코어 — routeRegion='kr') ─────────────────────────────────────
const SEOUL_A: LatLng = { lat: 37.5563, lng: 126.9723 }; // 서울역 인근(출발)
const SEOUL_B: LatLng = { lat: 37.5512, lng: 126.9882 }; // 남산(경유)
const SEOUL_C: LatLng = { lat: 37.5665, lng: 126.978 }; // 시청(도착)
const SEOUL_STATION: LatLng = { lat: 37.5547, lng: 126.9707 };
const BUSAN_STATION: LatLng = { lat: 35.1151, lng: 129.0413 };
const BUSAN_DEST: LatLng = { lat: 35.1796, lng: 129.0756 };

/** 두 좌표 사이 단순 2점 좌표열 (목 — 실 지오메트리 아님). */
function line(a: LatLng, b: LatLng): LatLng[] {
  return [a, b];
}

/** legs 합과 환승 수로 Route를 합성 (산술 단일 진실). */
function buildRoute(legs: RouteLeg[], transfers: number): Route {
  const legSum = legs.reduce((acc, leg) => acc + leg.durationSec, 0);
  const distSum = legs.reduce((acc, leg) => acc + leg.distanceM, 0);
  return {
    legs,
    totalDurationSec: legSum + TRANSFER_BUFFER_SEC * transfers,
    totalDistanceM: distSum,
  };
}

// ── 도보 A→B 단순 (1 leg, 환승 0) ───────────────────────────────────────────
export const WALK_SIMPLE: Route = buildRoute(
  [
    {
      start: SEOUL_A,
      end: SEOUL_C,
      mode: 'walk',
      durationSec: 900,
      distanceM: 1100,
      coords: line(SEOUL_A, SEOUL_C),
    },
  ],
  0,
);

// ── 자전거 A→B (1 leg, 환승 0) ──────────────────────────────────────────────
export const BIKE_SIMPLE: Route = buildRoute(
  [
    {
      start: SEOUL_A,
      end: SEOUL_C,
      mode: 'bike',
      durationSec: 480,
      distanceM: 1900,
      coords: line(SEOUL_A, SEOUL_C),
    },
  ],
  0,
);

// ── 자동차 A→B→C 경유지 (2 leg — 카카오모빌리티 다중경유지 형태, 환승 0) ─────
export const CAR_WAYPOINT: Route = buildRoute(
  [
    {
      start: SEOUL_A,
      end: SEOUL_B,
      mode: 'car',
      durationSec: 420,
      distanceM: 2400,
      coords: line(SEOUL_A, SEOUL_B),
    },
    {
      start: SEOUL_B,
      end: SEOUL_C,
      mode: 'car',
      durationSec: 360,
      distanceM: 2100,
      coords: line(SEOUL_B, SEOUL_C),
    },
  ],
  0,
);

// ── 대중교통 leg-chaining A→B→C (지하철 + 환승도보 + 버스, 환승 2회) ──────────
// 3 정거장 구간을 환승 버퍼 포함 여러 leg로 합성. transit leg 사이의 도보 leg가
// 환승을 표현 — 환승 수 = 2 (지하철→도보, 도보→버스).
export const TRANSIT_CHAIN: Route = buildRoute(
  [
    {
      start: SEOUL_A,
      end: SEOUL_B,
      mode: 'transit',
      durationSec: 600,
      distanceM: 3200,
      coords: line(SEOUL_A, SEOUL_B),
      transit: { lineName: '4호선', lineType: 'subway', headsign: '사당 방면' },
    },
    {
      start: SEOUL_B,
      end: SEOUL_B,
      mode: 'walk',
      durationSec: 180,
      distanceM: 220,
      coords: line(SEOUL_B, SEOUL_B),
    },
    {
      start: SEOUL_B,
      end: SEOUL_C,
      mode: 'transit',
      durationSec: 540,
      distanceM: 2800,
      coords: line(SEOUL_B, SEOUL_C),
      transit: { lineName: '402번', lineType: 'bus', headsign: '시청 방면' },
    },
  ],
  2,
);

// ── 시외 3단 스티칭: 서울 출발지 → 서울역(시내) → 부산역(KTX) → 부산 목적지(시내) ──
// 3단: 시내 대중교통 + 도시간 KTX(train) + 시내 대중교통. 환승 수 = 2.
export const INTERCITY_STITCH: Route = buildRoute(
  [
    {
      start: SEOUL_A,
      end: SEOUL_STATION,
      mode: 'transit',
      durationSec: 420,
      distanceM: 1800,
      coords: line(SEOUL_A, SEOUL_STATION),
      transit: { lineName: '1호선', lineType: 'subway', headsign: '서울역' },
    },
    {
      start: SEOUL_STATION,
      end: BUSAN_STATION,
      mode: 'transit',
      durationSec: 9600,
      distanceM: 325000,
      coords: line(SEOUL_STATION, BUSAN_STATION),
      transit: { lineName: 'KTX', lineType: 'train', headsign: '부산행' },
    },
    {
      start: BUSAN_STATION,
      end: BUSAN_DEST,
      mode: 'transit',
      durationSec: 780,
      distanceM: 6200,
      coords: line(BUSAN_STATION, BUSAN_DEST),
      transit: { lineName: '1호선', lineType: 'subway', headsign: '부산 시내' },
    },
  ],
  2,
);

/** 픽스처 좌표 — 테스트/프로바이더 선택에 재사용. */
export const ROUTE_FIXTURE_COORDS = {
  SEOUL_A,
  SEOUL_B,
  SEOUL_C,
  SEOUL_STATION,
  BUSAN_STATION,
  BUSAN_DEST,
} as const;
