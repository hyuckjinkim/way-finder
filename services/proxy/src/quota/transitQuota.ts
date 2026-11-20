/**
 * 카카오 대중교통 일일 하드 상한 (무료 1,000/일 — 유료 초과 금지, 2026-11-20 사용자 결정).
 *
 * SQLite 기반 Durable Object 1개(idFromName 고정)가 KST 날짜별 카운터를 들고 있다.
 * - 호출 **전** 예약(성공·실패 모두 1건으로 셈, 환불 없음).
 * - 950에서 차단 — 50건은 개발·프로브 여유분.
 * - 경유지 N구간은 N건을 한 번에(전부 또는 0) 예약.
 * - DO 안에서 get→put 사이에 외부 await가 없으므로 input gate가 원자성을 보장한다.
 * - 바인딩 없음/DO 실패 → 차단(fail-closed). 레이트리밋(fail-open)과 반대 — 돈이 걸린 쪽.
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
}

interface Usage {
  date: string;
  count: number;
}

/** today 기준으로 n건 예약. 상한을 넘으면 아무것도 쓰지 않고 false. 날짜가 바뀌면 0부터. */
export async function reserveDaily(
  storage: CounterStorage,
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

/** Durable Object — `POST https://quota/reserve?n=<구간 수>` → `{ ok: boolean }`. */
export class KakaoTransitQuota {
  constructor(
    private readonly state: DurableObjectState,
    _env: unknown,
    private readonly now: () => number = Date.now,
  ) {}

  async fetch(req: Request): Promise<Response> {
    const n = Number(new URL(req.url).searchParams.get('n') ?? '1');
    if (!Number.isInteger(n) || n < 1) return Response.json({ ok: false }, { status: 400 });
    const ok = await reserveDaily(this.state.storage, kstDate(this.now()), n);
    return Response.json({ ok });
  }
}

/** 프록시 쪽 예약 호출. 바인딩 없음·DO 오류·비정상 응답은 모두 false(fail-closed). */
export async function reserveKakaoTransit(
  ns: DurableObjectNamespace | undefined,
  n: number,
): Promise<boolean> {
  if (!ns) return false;
  try {
    const stub = ns.get(ns.idFromName('kakao-transit'));
    const res = await stub.fetch(`https://quota/reserve?n=${n}`, { method: 'POST' });
    if (!res.ok) return false;
    return ((await res.json()) as { ok?: unknown }).ok === true;
  } catch (err) {
    console.error('[quota] kakao transit counter unreachable — blocking:', err);
    return false;
  }
}
