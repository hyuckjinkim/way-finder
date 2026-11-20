/**
 * 카카오 대중교통(dapi.kakao.com/v2/routing/publictraffic) → shared Route 정규화.
 *
 * 실측(2026-11-20): step.type은 SUBWAY·BUS·WALKING. WALKING은 환승 도보뿐이고 출발·도착
 * 도보는 응답에 없다 → step time 합 < totalTime. 그래서 총 소요는 공급자 totalTime을 쓰고
 * leg는 응답 step 그대로만 만든다(도보 leg를 합성하지 않음).
 * path.points는 [lng, lat] 순서.
 */
import type { LatLng, Route, RouteLeg, TransitMeta } from '@wayfinder/shared';

export interface KakaoTransitStep {
  properties: {
    guidance?: string;
    type: string;
    distance: number;
    time: number;
    stops?: { name: string }[];
    vehicles?: { name: string; type: string }[];
  };
  path?: { points: [number, number][] };
}

export interface KakaoTransitRoute {
  properties: {
    type: string;
    totalDistance: number;
    totalTime: number;
    transfers: number;
    fare?: { value: number };
  };
  steps: KakaoTransitStep[];
}

export interface KakaoTransitResponse {
  status: string;
  properties?: { total?: number; bus?: number; subway?: number; busAndSubway?: number; landingURL?: string };
  routes?: KakaoTransitRoute[];
}

/** 대안 경로 상한(주 경로 제외) — ODsay 경로와 동일. */
export const MAX_KAKAO_ALTERNATIVES = 4;

/**
 * 지하철 노선명 → 공식색 (shared odsayTransit SUBWAY_COLOR와 같은 값, 거긴 ODsay 코드 키라 재사용 불가).
 * ponytail: 이름만 보므로 부산/대구 "1호선"도 수도권 색 — 지역 구분이 필요하면 좌표로 분기.
 */
const SUBWAY_COLOR: Record<string, string> = {
  '1호선': '#0052A4', '2호선': '#00A84D', '3호선': '#EF7C1C', '4호선': '#00A4E3',
  '5호선': '#996CAC', '6호선': '#CD7C2F', '7호선': '#747F00', '8호선': '#E6186C',
  '9호선': '#BDB092', 'GTX-A': '#9A6292', '공항철도': '#0090D2', '경의중앙선': '#77C4A3',
  '에버라인': '#56AD2D', '경춘선': '#178C72', '신분당선': '#D31145', '의정부경전철': '#FD8100',
  '경강선': '#0054A6', '우이신설선': '#B7C450', '서해선': '#8FC31F', '김포골드라인': '#A17800',
  '수인분당선': '#FABE00', '신림선': '#6789CA', '인천1호선': '#8CADCB', '인천2호선': '#F06A00',
};

/** 카카오 버스 vehicle.type → 색(서울 버스 근사값). */
const BUS_COLOR: Record<string, string> = {
  간선: '#3D5BAB', 지선: '#5BB025', 광역: '#E60012', 순환: '#F2B70A', 마을: '#F2B70A', 공항: '#00A0E9',
};

function stepToLeg(step: KakaoTransitStep, from: LatLng, to: LatLng): RouteLeg {
  const p = step.properties;
  const coords = (step.path?.points ?? []).map(([lng, lat]) => ({ lat, lng }));
  const start = coords[0] ?? from;
  const end = coords[coords.length - 1] ?? to;
  const base = { start, end, durationSec: p.time, distanceM: p.distance, coords };
  const vehicle = p.vehicles?.[0];
  if (p.type === 'WALKING' || !vehicle) return { ...base, mode: 'walk' };

  const isSubway = p.type === 'SUBWAY';
  const lineColor = isSubway ? SUBWAY_COLOR[vehicle.name] : BUS_COLOR[vehicle.type];
  const fromStop = p.stops?.[0]?.name;
  const toStop = p.stops?.[p.stops.length - 1]?.name;
  const transit: TransitMeta = {
    lineName: vehicle.name,
    lineType: isSubway ? 'subway' : 'bus',
    ...(lineColor ? { lineColor } : {}),
    ...(fromStop ? { fromStop } : {}),
    ...(toStop ? { toStop } : {}),
  };
  return { ...base, mode: 'transit', transit };
}

/** 카카오 경로 1건 → Route. 총 소요·거리·요금은 공급자 값. */
export function kakaoRouteToRoute(r: KakaoTransitRoute, from: LatLng, to: LatLng): Route {
  const route: Route = {
    legs: r.steps.map((s) => stepToLeg(s, from, to)),
    totalDurationSec: r.properties.totalTime,
    totalDistanceM: r.properties.totalDistance,
  };
  const fare = r.properties.fare?.value;
  return fare === undefined ? route : { ...route, fare };
}

/** 응답 → 주 경로 + 대안(≤4). 경로가 없으면 null(호출자가 no_route로 처리). */
export function normalizeKakaoTransit(res: KakaoTransitResponse, from: LatLng, to: LatLng): Route | null {
  const [primary, ...rest] = res.routes ?? [];
  if (!primary || primary.steps.length === 0) return null;
  const route = kakaoRouteToRoute(primary, from, to);
  const alternatives = rest.slice(0, MAX_KAKAO_ALTERNATIVES).map((r) => kakaoRouteToRoute(r, from, to));
  return alternatives.length > 0 ? { ...route, alternatives } : route;
}
