/**
 * 카카오 대중교통 일일 하드 상한 (무료 1,000/일 — 유료 초과 금지, 2026-11-20 사용자 결정).
 *
 * SQLite 기반 Durable Object 1개(idFromName 고정)가 KST 날짜별 카운터를 들고 있다.
 * - 호출 **전** 예약(성공·실패 모두 1건으로 셈, 환불 없음).
 * - 950에서 차단 — 50건은 개발·프로브 여유분.
 * - 경유지 N구간은 N건을 한 번에(전부 또는 0) 예약.
 * - DO 안에서 get→put 사이에 외부 await가 없으므로 input gate가 원자성을 보장한다.
 * - 바인딩 없음/DO 실패 → 차단(fail-closed). 레이트리밋(fail-open)과 반대 — 돈이 걸린 쪽.
 *
 * 같은 DO가 kr 대중교통 경로 캐시(TTL 15분)도 들고 있다 — KV 무료 쓰기 1,000/일을 장소·블로그 캐시에
 * 남기기 위해 (cache/routeCache.ts가 클라이언트). 클래스 추가가 아니라 migration 불필요.
 */

/** 하루 예약 상한 (카카오 무료 1,000/일 - 여유 50). */
export const KAKAO_TRANSIT_DAILY_CAP = 950;

const KST_OFFSET_MS = 9 * 60 * 60 * 1000;

/** epoch ms → KST 날짜 'YYYY-MM-DD' (카카오 쿼터는 KST 자정 리셋 가정). */
export function kstDate(nowMs: number): string {
  return new Date(nowMs + KST_OFFSET_MS).toISOString().slice(0, 10);
}

/** DurableObjectStorage의 필요한 부분만 — 테스트에서 Map으로 대체. */
export interface CounterStorage {
  get<T>(key: string): Promise<T | undefined>;
  put<T>(key: string, value: T): Promise<void>;
  list<T>(options: { prefix: string }): Promise<Map<string, T>>;
  delete(keys: string[]): Promise<number>;
}

/** 경로 캐시 키 프리픽스 — 'usage' 카운터 키와 겹치지 않게 DO가 강제한다. */
export const ROUTE_KEY_PREFIX = 'route:';
/** 대중교통 경로 캐시 TTL — 운행 상황이 바뀌므로 짧게. */
export const ROUTE_CACHE_TTL_MS = 15 * 60 * 1000;
/** DO storage.delete(keys[]) 한 번에 허용되는 최대 키 수. */
const DELETE_BATCH = 128;

interface CachedRoute {
  exp: number;
  body: string;
}

/** 만료 전이면 저장된 JSON 문자열, 아니면 null. */
export async function routeCacheGet(storage: CounterStorage, key: string, now: number): Promise<string | null> {
  const hit = await storage.get<CachedRoute>(key);
  return hit && hit.exp > now ? hit.body : null;
}

/**
 * 저장 + 만료 항목 정리 (DO storage엔 TTL이 없다).
 * ponytail: put마다 프리픽스 전체 list — 살아있는 항목은 최근 15분 put 수(≤ 일 950)라 작다.
 */
export async function routeCachePut(storage: CounterStorage, key: string, body: string, now: number): Promise<void> {
  const all = await storage.list<CachedRoute>({ prefix: ROUTE_KEY_PREFIX });
  const expired = [...all].filter(([, v]) => v.exp <= now).map(([k]) => k);
  for (let i = 0; i < expired.length; i += DELETE_BATCH) {
    await storage.delete(expired.slice(i, i + DELETE_BATCH));
  }
  await storage.put<CachedRoute>(key, { exp: now + ROUTE_CACHE_TTL_MS, body });
}

interface Usage {
  date: string;
  count: number;
}

/** today 기준으로 n건 예약. 상한을 넘으면 아무것도 쓰지 않고 false. 날짜가 바뀌면 0부터. */
export async function reserveDaily(
  storage: Pick<CounterStorage, 'get' | 'put'>,
  today: string,
  n: number,
  cap: number = KAKAO_TRANSIT_DAILY_CAP,
): Promise<boolean> {
  const saved = await storage.get<Usage>('usage');
  const count = saved?.date === today ? saved.count : 0;
  if (count + n > cap) return false;
  await storage.put<Usage>('usage', { date: today, count: count + n });
  return true;
}

/**
 * Durable Object.
 * - `POST /reserve?n=<구간 수>` → `{ ok: boolean }`
 * - `GET /route?key=` → 캐시된 Route JSON | 404,  `PUT /route?key=` (body=Route JSON) → 204
 * 그 외 경로는 404 — 어떤 요청도 실수로 예약하지 않게.
 */
export class KakaoTransitQuota {
  constructor(
    private readonly state: DurableObjectState,
    _env: unknown,
    private readonly now: () => number = Date.now,
  ) {}

  async fetch(req: Request): Promise<Response> {
    const url = new URL(req.url);
    const storage: CounterStorage = this.state.storage;
    if (url.pathname === '/reserve' && req.method === 'POST') {
      const n = Number(url.searchParams.get('n') ?? '1');
      if (!Number.isInteger(n) || n < 1) return Response.json({ ok: false }, { status: 400 });
      const ok = await reserveDaily(storage, kstDate(this.now()), n);
      return Response.json({ ok });
    }
    if (url.pathname === '/route') {
      const key = url.searchParams.get('key') ?? '';
      if (!key.startsWith(ROUTE_KEY_PREFIX)) return new Response(null, { status: 400 });
      if (req.method === 'GET') {
        const body = await routeCacheGet(storage, key, this.now());
        return body === null
          ? new Response(null, { status: 404 })
          : new Response(body, { headers: { 'content-type': 'application/json' } });
      }
      if (req.method === 'PUT') {
        await routeCachePut(storage, key, await req.text(), this.now());
        return new Response(null, { status: 204 });
      }
    }
    return new Response(null, { status: 404 });
  }
}

/** 전역 단일 인스턴스 스텁 (카운터·경로 캐시 공용). */
export function transitStub(ns: DurableObjectNamespace): DurableObjectStub {
  return ns.get(ns.idFromName('kakao-transit'));
}

/** 프록시 쪽 예약 호출. 바인딩 없음·DO 오류·비정상 응답은 모두 false(fail-closed). */
export async function reserveKakaoTransit(
  ns: DurableObjectNamespace | undefined,
  n: number,
): Promise<boolean> {
  if (!ns) return false;
  try {
    const res = await transitStub(ns).fetch(`https://quota/reserve?n=${n}`, { method: 'POST' });
    if (!res.ok) return false;
    return ((await res.json()) as { ok?: unknown }).ok === true;
  } catch (err) {
    console.error('[quota] kakao transit counter unreachable — blocking:', err);
    return false;
  }
}
