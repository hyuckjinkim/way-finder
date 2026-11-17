/**
 * 국내 대중교통 경로 — ODsay 탐색 + 정규화 + 합성 (프록시·웹 앱 공용).
 *
 * 프록시는 Server 키(IP 제한)로, 웹 앱은 URI 키(Service URI 제한)로 같은 함수를 부른다.
 * Cloudflare Workers는 고정 IP가 없어 Server 키가 막히므로 배포 웹은 브라우저에서 직접 호출한다.
 * 브라우저 호출이므로 커스텀 헤더 없는 단순 GET만 쓴다(ODsay CORS 허용 헤더는 x-requested-with뿐).
 */
import type { LatLng, Route, RouteLeg, RouteRequest } from '../index.js';
import {
  applyLaneGeometry,
  normalizeOdsayPath,
  type OdsayLoadLaneResponse,
  type OdsayPath,
  type OdsayTransitResponse,
} from './odsayTransit.js';
import { chainTransitLegs } from './transitChain.js';
import { isIntercity, promoteIntercityLeg, stitchIntercity } from './intercityStitch.js';

const ODSAY_URL = 'https://api.odsay.com/v1/api/searchPubTransPathT';
const ODSAY_LANE_URL = 'https://api.odsay.com/v1/api/loadLane';
/** 대안 경로 상한(주 경로 제외). */
const MAX_ALTERNATIVES = 4;

/** 한 구간(출발→도착)을 ODsay로 탐색해 path[]를 반환한다(빈 결과·에러 본문은 throw). */
async function fetchOdsayPaths(from: LatLng, to: LatLng, apiKey: string): Promise<OdsayPath[]> {
  const params = new URLSearchParams({
    apiKey,
    SX: String(from.lng),
    SY: String(from.lat),
    EX: String(to.lng),
    EY: String(to.lat),
    output: 'json',
  });
  const res = await fetch(`${ODSAY_URL}?${params.toString()}`);
  if (!res.ok) throw new Error(`odsay ${res.status}`);
  const body = (await res.json()) as OdsayTransitResponse & { error?: unknown };
  const paths = body.result?.path ?? [];
  // ODsay는 인증 실패(IP·URI 미등록 등)도 HTTP 200 + error 본문 → 빈 경로로 새지 않게 throw.
  if (normalizeOdsayPath(paths[0], from, to).length === 0) {
    throw new Error(`odsay: no path — ${JSON.stringify(body.error ?? 'empty result')}`);
  }
  return paths;
}

/** path 한 건 → Route (fare 포함). */
function pathToRoute(path: OdsayPath, from: LatLng, to: LatLng): Route {
  const route = chainTransitLegs([normalizeOdsayPath(path, from, to)]);
  return path.info.payment === undefined ? route : { ...route, fare: path.info.payment };
}

/**
 * 주 경로의 실제 노선 선형(loadLane)으로 대중교통 leg coords를 치환한다.
 * 장식 데이터라 어떤 실패(HTTP·에러 본문·네트워크)에도 원본 leg를 유지하고 경로를 실패시키지 않는다.
 */
async function withLaneGeometry(route: Route, mapObj: string | undefined, apiKey: string): Promise<Route> {
  if (!mapObj) return route;
  try {
    // mapObject는 숫자·`:`·`@`·`-`뿐이라 인코딩 없이 그대로 붙인다(0:0 = 절대좌표 기준점).
    const res = await fetch(
      `${ODSAY_LANE_URL}?lang=0&mapObject=0:0@${mapObj}&apiKey=${encodeURIComponent(apiKey)}`,
    );
    if (!res.ok) return route;
    const legs = applyLaneGeometry(route.legs, (await res.json()) as OdsayLoadLaneResponse);
    return { ...route, legs };
  } catch {
    return route;
  }
}

/**
 * 국내 대중교통 Route.
 * - 시외(위도 차 큼): 출발→도착 1회 탐색 → 도시간 leg 승격 → 스티칭. 대안 없음.
 * - 시내 2지점: 탐색 1회 + loadLane 1회. 나머지 path(≤4)는 대안으로 추가 호출 없이 정규화.
 * - 시내 경유지: 인접 구간별 탐색 → leg-chaining (경유지마다 ODsay 1회). 대안·loadLane 없음.
 * fare = 각 구간 주 경로 payment 합.
 */
export async function koreaTransitRoute(req: RouteRequest, apiKey: string): Promise<Route> {
  const { stops } = req;
  const first = stops[0]!;
  const last = stops[stops.length - 1]!;

  if (isIntercity(stops)) {
    const [path] = await fetchOdsayPaths(first, last, apiKey);
    const promoted = normalizeOdsayPath(path, first, last).map((leg) => promoteIntercityLeg(leg, 'train'));
    const route = stitchIntercity([], promoted, []);
    return path!.info.payment === undefined ? route : { ...route, fare: path!.info.payment };
  }

  if (stops.length === 2) {
    const [primary, ...rest] = await fetchOdsayPaths(first, last, apiKey);
    const route = await withLaneGeometry(pathToRoute(primary!, first, last), primary!.info.mapObj, apiKey);
    const alternatives = rest.slice(0, MAX_ALTERNATIVES).map((p) => pathToRoute(p, first, last));
    return alternatives.length > 0 ? { ...route, alternatives } : route;
  }

  const segmentLegs: RouteLeg[][] = [];
  let fare: number | undefined;
  for (let i = 0; i < stops.length - 1; i++) {
    const [path] = await fetchOdsayPaths(stops[i]!, stops[i + 1]!, apiKey);
    segmentLegs.push(normalizeOdsayPath(path, stops[i]!, stops[i + 1]!));
    if (path!.info.payment !== undefined) fare = (fare ?? 0) + path!.info.payment;
  }
  const route = chainTransitLegs(segmentLegs);
  return fare === undefined ? route : { ...route, fare };
}
