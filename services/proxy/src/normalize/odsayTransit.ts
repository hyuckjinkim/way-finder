/**
 * B1 — ODsay 대중교통(한국 시내·도시간) 응답 → RouteLeg[] 정규화.
 *
 * §6 부록 형식 기반 (실 fetch 없이 지식 기반 작성, byte-perfect 미보장 — §7).
 *
 * 핵심 변환 규칙:
 * - path[0].subPath 각각이 하나의 RouteLeg.
 * - trafficType → lineType: 1=지하철(subway), 2=버스(bus), 3=도보(walk leg).
 * - 도보 subPath(trafficType=3)는 환승 도보 leg — mode='walk', transit 메타 없음.
 * - lane[0].name → transit.lineName ("4호선", "402번" 등).
 * - sectionTime·totalTime은 **분 단위** → ×60으로 초 변환 (RouteLeg.durationSec).
 * - 좌표: subPath의 startX/startY·endX/endY(경도/위도)로 2점 coords 구성.
 *   (ODsay는 passStopList gps도 주지만, 누락에 방어적으로 2점 fallback.)
 *
 * 도시간(train/express/air) lineType은 여기서 생성하지 않는다 — 시내 정규화는
 * subway/bus/walk만 생성. 도시간 분류는 B3(routeIntercityStitch) 책임 (§부록 부속).
 */
import type { LatLng } from '@wayfinder/shared';
import type { RouteLeg, TransitMeta } from '@wayfinder/shared';

/** ODsay subPath 내 lane(노선) 한 건. */
export interface OdsayLane {
  name?: string;
  busNo?: string;
  subwayCode?: number;
  type?: number;
}

/** ODsay subPath 한 건 (trafficType별 한 구간). */
export interface OdsaySubPath {
  /** 1=지하철, 2=버스, 3=도보. */
  trafficType: number;
  /** 구간 소요(분). */
  sectionTime: number;
  /** 구간 거리(m). */
  distance?: number;
  lane?: OdsayLane[];
  startName?: string;
  endName?: string;
  startX?: number; // 경도
  startY?: number; // 위도
  endX?: number; // 경도
  endY?: number; // 위도
  /** 종점 방면 표시(있으면 headsign). */
  way?: string;
  passStopList?: { stations?: { x?: string; y?: string }[] };
}

/** ODsay path 한 건. */
export interface OdsayPath {
  pathType: number;
  info: {
    totalTime: number; // 분
    totalDistance?: number;
    busTransitCount?: number;
    subwayTransitCount?: number;
  };
  subPath: OdsaySubPath[];
}

/** ODsay searchPubTransPathT 응답 루트. */
export interface OdsayTransitResponse {
  result?: {
    path?: OdsayPath[];
  };
}

/** trafficType=3(도보) 판정. */
const TRAFFIC_WALK = 3;
const TRAFFIC_SUBWAY = 1;

/** 분 → 초. */
function minToSec(min: number): number {
  return Math.round(min * 60);
}

/** trafficType → 시내 lineType (도시간 train/express/air는 여기서 안 만든다). */
function laneType(trafficType: number): TransitMeta['lineType'] {
  return trafficType === TRAFFIC_SUBWAY ? 'subway' : 'bus';
}

/**
 * subPath의 시작/끝 좌표를 LatLng로 추출. passStopList가 있으면 정류장 gps열을
 * coords로, 없으면 start/end 2점으로 fallback (누락 시 빈 배열 — 방어적).
 */
function subPathCoords(sp: OdsaySubPath): LatLng[] {
  const stations = sp.passStopList?.stations;
  if (stations && stations.length > 0) {
    const pts = stations
      .map((s) => {
        const lat = s.y !== undefined ? parseFloat(s.y) : NaN;
        const lng = s.x !== undefined ? parseFloat(s.x) : NaN;
        return { lat, lng };
      })
      .filter((p) => !Number.isNaN(p.lat) && !Number.isNaN(p.lng));
    if (pts.length > 0) return pts;
  }
  const coords: LatLng[] = [];
  if (sp.startX !== undefined && sp.startY !== undefined) {
    coords.push({ lat: sp.startY, lng: sp.startX });
  }
  if (sp.endX !== undefined && sp.endY !== undefined) {
    coords.push({ lat: sp.endY, lng: sp.endX });
  }
  return coords;
}

/** subPath 한 건 → RouteLeg. */
function subPathToLeg(sp: OdsaySubPath): RouteLeg {
  const coords = subPathCoords(sp);
  const start = coords[0] ?? { lat: sp.startY ?? 0, lng: sp.startX ?? 0 };
  const end = coords[coords.length - 1] ?? { lat: sp.endY ?? 0, lng: sp.endX ?? 0 };
  const durationSec = minToSec(sp.sectionTime);
  const distanceM = sp.distance ?? 0;

  // 도보 subPath = 환승 도보 leg (transit 메타 없음).
  if (sp.trafficType === TRAFFIC_WALK) {
    return { start, end, mode: 'walk', durationSec, distanceM, coords };
  }

  const lineName = sp.lane?.[0]?.name ?? sp.lane?.[0]?.busNo ?? '';
  const transit: TransitMeta = {
    lineName,
    lineType: laneType(sp.trafficType),
    ...(sp.way ? { headsign: sp.way } : {}),
  };
  return { start, end, mode: 'transit', durationSec, distanceM, coords, transit };
}

/**
 * ODsay 응답의 첫 경로(path[0])를 RouteLeg[]로 정규화한다.
 * 경로가 없으면 빈 배열을 반환한다 (호출자가 명시적 에러 처리 — silent failure 금지).
 */
export function normalizeOdsayTransit(
  res: OdsayTransitResponse,
  from?: LatLng,
  to?: LatLng,
): RouteLeg[] {
  const path = res.result?.path?.[0];
  if (!path || !Array.isArray(path.subPath)) return [];
  const legs = path.subPath.map(subPathToLeg);
  // 실 ODsay 도보 subPath(trafficType 3)는 좌표가 없다(2026-11-18 실측) → 0,0 대신
  // 이웃 leg의 정류장 좌표, 양 끝은 요청 출발·도착으로 채운다(직선 2점).
  return legs.map((leg, i) => {
    if (leg.coords.length > 0) return leg;
    const start = legs[i - 1]?.end ?? from ?? leg.start;
    const end = legs[i + 1]?.start ?? to ?? leg.end;
    return { ...leg, start, end, coords: [start, end] };
  });
}
