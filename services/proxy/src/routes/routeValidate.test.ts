/**
 * A3 입력 검증 + 장애 격리 단위 테스트.
 */
import { describe, it, expect, vi } from 'vitest';
import {
  validateRouteBody,
  runProviderOrError,
  MIN_STOPS,
  MAX_STOPS,
} from './routeValidate.js';

const VALID_STOP = { lat: 37.5, lng: 127.0 };
function stops(n: number) {
  return Array.from({ length: n }, () => ({ ...VALID_STOP }));
}

describe('validateRouteBody', () => {
  it('유효한 body → ok + 파싱된 request', () => {
    const r = validateRouteBody({ stops: stops(2), mode: 'car' });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.request.mode).toBe('car');
      expect(r.request.stops).toHaveLength(2);
    }
  });

  it('4모드 전부 화이트리스트 통과', () => {
    for (const mode of ['walk', 'transit', 'car', 'bike']) {
      expect(validateRouteBody({ stops: stops(2), mode }).ok).toBe(true);
    }
  });

  it('알 수 없는 mode → 실패', () => {
    expect(validateRouteBody({ stops: stops(2), mode: 'plane' }).ok).toBe(false);
  });

  it('mode 누락 → 실패', () => {
    expect(validateRouteBody({ stops: stops(2) }).ok).toBe(false);
  });

  it('stops 1개(최소 미만) → 실패', () => {
    expect(validateRouteBody({ stops: stops(MIN_STOPS - 1), mode: 'car' }).ok).toBe(false);
  });

  it('stops 7개(최대 초과) → 실패 (경유지 ≤5)', () => {
    const r = validateRouteBody({ stops: stops(MAX_STOPS + 1), mode: 'car' });
    expect(r.ok).toBe(false);
  });

  it('stops 6개(최대) → ok', () => {
    expect(validateRouteBody({ stops: stops(MAX_STOPS), mode: 'car' }).ok).toBe(true);
  });

  it('stops가 배열 아님 → 실패', () => {
    expect(validateRouteBody({ stops: 'nope', mode: 'car' }).ok).toBe(false);
  });

  it('범위 밖 좌표(lat 100) → 실패', () => {
    const bad = [{ lat: 100, lng: 0 }, VALID_STOP];
    expect(validateRouteBody({ stops: bad, mode: 'car' }).ok).toBe(false);
  });

  it('좌표 lng 누락 → 실패', () => {
    const bad = [{ lat: 37.5 }, VALID_STOP];
    expect(validateRouteBody({ stops: bad, mode: 'car' }).ok).toBe(false);
  });

  it('body가 객체 아님 → 실패', () => {
    expect(validateRouteBody(null).ok).toBe(false);
    expect(validateRouteBody('x').ok).toBe(false);
  });
});

describe('runProviderOrError', () => {
  it('성공 시 결과 반환', async () => {
    const r = await runProviderOrError(async () => 42, 'ok');
    expect(r).toBe(42);
  });

  it('throw 시 null 반환 + console.error 로깅 (silent 금지)', async () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const r = await runProviderOrError(async () => {
      throw new Error('boom');
    }, 'fail');
    expect(r).toBeNull();
    expect(spy).toHaveBeenCalled();
    spy.mockRestore();
  });
});
