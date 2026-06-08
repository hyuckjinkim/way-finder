/**
 * A2 — Valhalla 커스텀 도보 공급자 (HTTP + costing body).
 *
 * F1 `ValhallaProvider` 인터페이스 구현 (routeDirect.ts 정의). stops + costing 옵션을
 * Valhalla `/route` body로 변환해 로컬 self-hosted 컨테이너(`VALHALLA_URL`)에 POST하고,
 * 응답을 A1 정규화기(normalizeValhalla)로 Route 변환한다.
 *
 * **경계 (P4 §4 OW1 분리):** 이 파일은 *provider 구현까지만* — 2-call +N 필터
 * (extraMinutesFilter) 결합은 OW1(통합 단계)이 별도 수행한다.
 *
 * **장애 격리 (silent 금지):** `VALHALLA_URL` 미설정·컨테이너 다운(네트워크 실패)·
 * non-2xx는 모두 명시적 throw. 호출자(routeDirect 슬롯)가 폴백/502를 결정한다.
 */
import type {
  PedestrianCostingOptions,
  Route,
  RouteRequest,
} from '@wayfinder/shared';
import type { ValhallaProvider } from './routeDirect.js';
import type { Env } from '../config.js';
import { normalizeValhalla, type ValhallaRouteRaw } from '../normalize/valhalla.js';
import { applyExtraMinutesFilter } from './extraMinutesFilter.js';

/**
 * stops → Valhalla `/route` body. locations는 `{lat, lon}` 순서(Valhalla 규약).
 * costing 옵션이 있으면 `costing_options.pedestrian`에 병합(없으면 표준 pedestrian).
 */
function valhallaBody(
  req: RouteRequest,
  costing: PedestrianCostingOptions,
): Record<string, unknown> {
  const locations = req.stops.map((s) => ({ lat: s.lat, lon: s.lng }));
  const body: Record<string, unknown> = {
    locations,
    costing: 'pedestrian',
  };
  if (Object.keys(costing).length > 0) {
    body.costing_options = { pedestrian: costing };
  }
  return body;
}

/**
 * `Env`에서 Valhalla 공급자를 생성한다 (F1 `ValhallaProvider` 구현).
 * @throws route() 호출 시 `VALHALLA_URL` 미설정·컨테이너 다운·non-2xx (silent 금지).
 */
export function createValhallaProvider(env: Env): ValhallaProvider {
  return {
    async route(
      req: RouteRequest,
      costing: PedestrianCostingOptions,
    ): Promise<Route> {
      const base = env.VALHALLA_URL;
      if (!base) throw new Error('valhalla: VALHALLA_URL not configured');

      const url = `${base.replace(/\/$/, '')}/route`;
      let res: Response;
      try {
        res = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(valhallaBody(req, costing)),
        });
      } catch (err) {
        // 컨테이너 다운/네트워크 실패 — 명시적 에러(silent 금지).
        throw new Error(
          `valhalla: request failed (container down?) — ${(err as Error).message}`,
        );
      }
      if (!res.ok) throw new Error(`valhalla: /route ${res.status}`);
      return normalizeValhalla((await res.json()) as ValhallaRouteRaw);
    },
  };
}

/**
 * OW1 — Valhalla 커스텀 경로 실 배선 (A+O join).
 *
 * F1 routeDirect.ts의 kr+walk+preference 슬롯이 위임하는 진입점. provider(A2)와
 * 2-call +N 필터(OO1)를 결합해 `customMeta`(profile·withinBudget·baseline) 포함
 * Route를 산출한다. routeDirect.ts는 이 함수만 호출하고 기존 4모드 디스패치는 불변.
 *
 * **장애 격리 (silent 금지, F1 폴백 규약):** provider 호출이 throw하면(URL 미설정·
 * 컨테이너 다운·non-2xx) 호출자가 기존 TMAP 도보로 폴백하도록 `null`을 반환한다.
 * 에러는 라벨과 함께 로깅한다(silent 아님). 그 외 흐름은 항상 P를 서빙(필터 규약).
 *
 * @returns 성공 시 customMeta 포함 Route, provider 실패 시 null(호출자 폴백).
 */
export async function resolveValhallaCustomRoute(
  req: RouteRequest,
  env: Env,
): Promise<Route | null> {
  const provider = createValhallaProvider(env);
  try {
    return await applyExtraMinutesFilter(provider, req);
  } catch (err) {
    // 컨테이너 다운/URL 미설정 등 — silent 금지(로깅) 후 null로 호출자 폴백 유도.
    console.error('[route] valhalla-custom failed:', err);
    return null;
  }
}
