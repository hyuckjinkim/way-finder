/**
 * 국내 대중교통 경로 — ODsay 탐색 + 정규화 + 합성 (프록시·웹 앱 공용).
 *
 * 프록시는 Server 키(IP 제한)로, 웹 앱은 URI 키(Service URI 제한)로 같은 함수를 부른다.
 * Cloudflare Workers는 고정 IP가 없어 Server 키가 막히므로 배포 웹은 브라우저에서 직접 호출한다.
 * 브라우저 호출이므로 커스텀 헤더 없는 단순 GET만 쓴다(ODsay CORS 허용 헤더는 x-requested-with뿐).
 */
import type { LatLng, Route, RouteLeg, RouteRequest } from '../index.js';
import { normalizeOdsayTransit, type OdsayTransitResponse } from './odsayTransit.js';
import { chainTransitLegs } from './transitChain.js';
import { isIntercity, promoteIntercityLeg, stitchIntercity } from './intercityStitch.js';

const ODSAY_URL = 'https://api.odsay.com/v1/api/searchPubTransPathT';

/** 한 구간(출발→도착)을 ODsay로 탐색해 정규화 leg 배열을 반환한다. */
async function fetchOdsaySegment(from: LatLng, to: LatLng, apiKey: string): Promise<RouteLeg[]> {
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
  const legs = normalizeOdsayTransit(body, from, to);
  // ODsay는 인증 실패(IP·URI 미등록 등)도 HTTP 200 + error 본문 → 빈 경로로 새지 않게 throw.
  if (legs.length === 0) throw new Error(`odsay: no path — ${JSON.stringify(body.error ?? 'empty result')}`);
  return legs;
}

/**
 * 국내 대중교통 Route.
 * - 시외(위도 차 큼): 출발→도착 1회 탐색 → 도시간 leg 승격 → 스티칭.
 * - 시내: 인접 구간별 탐색 → leg-chaining (경유지마다 ODsay 1회).
 */
export async function koreaTransitRoute(req: RouteRequest, apiKey: string): Promise<Route> {
  const { stops } = req;

  if (isIntercity(stops)) {
    const intercityLegs = await fetchOdsaySegment(stops[0]!, stops[stops.length - 1]!, apiKey);
    const promoted = intercityLegs.map((leg) => promoteIntercityLeg(leg, 'train'));
    return stitchIntercity([], promoted, []);
  }

  const segmentLegs: RouteLeg[][] = [];
  for (let i = 0; i < stops.length - 1; i++) {
    segmentLegs.push(await fetchOdsaySegment(stops[i]!, stops[i + 1]!, apiKey));
  }
  return chainTransitLegs(segmentLegs);
}
