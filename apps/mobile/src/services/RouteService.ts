/**
 * D1 — RouteService.
 *
 * `RouteProvider` 계약(`getRoute`)을 구현한다.
 * - 데모 모드: @wayfinder/shared/mocks 의 mockRouteProvider 위임 (fetch 없음).
 * - 실 모드: apiPost(routesPath, req) → 프록시 POST /v1/routes 호출.
 *
 * 두 모드 모두 동일한 인터페이스를 노출하므로 호출자(routeQueries.ts)는 모드를 신경 쓰지 않는다.
 *
 * 와이어 계약(§8 D1 critic C3): apiPost의 첫 인자는 반드시 shared/api 에서 import한
 * `routesPath` 상수여야 한다 — 리터럴 하드코딩 금지. RouteService.test.ts가 이를 단언한다.
 */
import type { Route, RouteRequest } from '@wayfinder/shared';
import { routesPath } from '@wayfinder/shared/api';
import { mockRouteProvider } from '@wayfinder/shared/mocks';
import { routeRegion } from '@wayfinder/shared/region';
import { isIntercity, isTransitErrorCode, koreaTransitRoute, TransitError, transitErrorCode } from '@wayfinder/shared/transit';
import { ApiError, apiPost, isDemoMode } from './apiClient.js';

/**
 * ODsay URI 키(Service URI 제한) — 웹에서 국내 대중교통을 브라우저가 직접 조회할 때만 쓴다.
 * 프록시(Cloudflare Workers)는 고정 IP가 없어 ODsay Server 키(IP 제한)가 막히기 때문.
 * 설계 예외: "키는 프록시에만" 원칙의 의도적 예외 — URI 키는 등록 도메인에서만 동작하는 공개용 키.
 * 점 표기만 Metro가 정적 인라인한다.
 */
const ODSAY_URI_KEY: string | undefined = process.env.EXPO_PUBLIC_ODSAY_KEY || undefined; // 맨 점 표기 필수(apiClient 참고)

/** 브라우저(웹)인지 — 네이티브엔 document가 없다. react-native import 없이 판별(모듈 로드 가벼움). */
const isBrowser = (): boolean => typeof document !== 'undefined';

/**
 * ODsay 직접 호출이 이번 세션에 다시 성공할 수 없는 상태(쿼터 소진·URI 키 미등록 도메인)면 건너뛴다.
 * ponytail: 세션(페이지 수명) 단위 — 새로고침하면 다시 시도. KST 자정 리셋 추적은 필요해지면 추가.
 */
let skipOdsayDirect = false;
/** ODsay가 쿼터로 막혔는지 — 시외 대중교통은 ODsay만 하므로 프록시 no_route를 quota로 바꿔 안내한다. */
let odsayQuotaHit = false;

/** 프록시 501 MODE_UNAVAILABLE — 이 지역·이동수단의 공급자 키가 없어 지원하지 않음(재시도 무의미). */
export function isModeUnavailable(err: unknown): boolean {
  return err instanceof ApiError && err.status === 501;
}

/**
 * 경로를 탐색하고 단일 `Route`를 반환한다.
 *
 * P4 패스스루(§3 F1.6): `req`의 `preference`·`maxExtraMinutes`(선택)는 그대로
 * apiPost body(`routesPath`)에 포함돼 프록시로 전달된다 — 앱은 리터럴 0(`req` 전체 전달).
 * 미지정 시 기존 P2 동작과 동일(하위호환). RouteService.test.ts(C1)가 전달을 단언한다.
 *
 * @param req  RouteRequest `{ stops, mode, preference?, maxExtraMinutes? }`
 * @returns    탐색된 Route (P4: `customMeta` 선택 포함)
 * 대중교통 오류 정책(쿼터 곱셈 방지): ODsay 직접 → quota·auth·upstream·네트워크면 프록시(카카오 백업)로 1회 폴백.
 * no_route·too_close는 공급자를 바꿔도 같으므로 폴백 없이 그대로 throw.
 * 프록시 오류 본문 `{code}`는 TransitError로 바꿔 화면·재시도 정책이 코드로 분기하게 한다.
 *
 * @throws     TransitError(코드 분류됨) 또는 네트워크/HTTP 오류 시 Error
 */
export async function getRoute(req: RouteRequest): Promise<Route> {
  if (isDemoMode) {
    return mockRouteProvider.getRoute(req);
  }
  if (!skipOdsayDirect && isBrowser() && ODSAY_URI_KEY && req.mode === 'transit' && routeRegion(req.stops) === 'kr') {
    try {
      return await koreaTransitRoute(req, ODSAY_URI_KEY);
    } catch (err) {
      const code = transitErrorCode(err);
      if (code === 'no_route' || code === 'too_close') throw err;
      // 쿼터 소진·미등록 도메인(예: localhost 인증 실패)은 이번 세션 내내 같다 → 이후엔 바로 프록시.
      if (code === 'quota' || code === 'auth') skipOdsayDirect = true;
      if (code === 'quota') odsayQuotaHit = true;
      console.warn('[route] ODsay direct failed, falling back to proxy:', err);
    }
  }
  try {
    return (await apiPost(routesPath, req)) as Route;
  } catch (err) {
    const code = (err as { code?: unknown } | null)?.code;
    // 프록시(카카오)는 시외를 안 한다 — ODsay가 쿼터로 빠진 시외 요청의 no_route는 실은 쿼터(카카오맵 링크 안내).
    if (code === 'no_route' && odsayQuotaHit && req.mode === 'transit' && isIntercity(req.stops)) {
      throw new TransitError('quota', 'intercity transit needs ODsay (quota reached)');
    }
    throw isTransitErrorCode(code) ? new TransitError(code, (err as Error).message) : err;
  }
}
