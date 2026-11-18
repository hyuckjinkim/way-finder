import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Place } from '@wayfinder/shared';
import { createPlaceSearcher, type PlaceSearchState } from './placeSearch.js';

const place = (name: string): Place =>
  ({ id: name, name, coord: { lat: 37.5, lng: 127 }, category: '', address: '' }) as Place;

/** 쿼리별 응답을 수동으로 resolve할 수 있는 provider. */
function controllable() {
  const pending = new Map<string, { resolve(r: Place[]): void; reject(e: unknown): void }>();
  const search = vi.fn(
    (q: string) => new Promise<Place[]>((resolve, reject) => pending.set(q, { resolve, reject })),
  );
  return { search, pending };
}

describe('createPlaceSearcher', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('IME 조합 중 연속 입력은 디바운스로 마지막 한 번만 검색한다', () => {
    const p = controllable();
    const s = createPlaceSearcher(p, () => {}, 250);
    for (const t of ['강', '강남', '강남ㅇ', '강남역']) s.setQuery(t);
    vi.advanceTimersByTime(250);
    expect(p.search).toHaveBeenCalledTimes(1);
    expect(p.search).toHaveBeenCalledWith('강남역');
  });

  it('늦게 도착한 이전 쿼리 응답이 최신 결과를 덮지 않는다', async () => {
    const p = controllable();
    const states: PlaceSearchState[] = [];
    const s = createPlaceSearcher(p, (st) => states.push(st), 250);
    s.setQuery('강남ㅇ');
    vi.advanceTimersByTime(250);
    s.setQuery('강남역');
    vi.advanceTimersByTime(250);
    p.pending.get('강남역')!.resolve([place('강남역 2호선')]);
    await vi.runAllTimersAsync();
    p.pending.get('강남ㅇ')!.resolve([]); // 늦게 도착한 0건
    await vi.runAllTimersAsync();
    expect(states.at(-1)).toEqual({ results: [place('강남역 2호선')], status: 'done' });
  });

  it('실패는 error 상태로 드러나고 빈 입력은 idle로 비운다', async () => {
    const p = controllable();
    const states: PlaceSearchState[] = [];
    const s = createPlaceSearcher(p, (st) => states.push(st), 0);
    s.setQuery('강남역');
    vi.advanceTimersByTime(0);
    p.pending.get('강남역')!.reject(new Error('429'));
    await vi.runAllTimersAsync();
    expect(states.at(-1)?.status).toBe('error');
    s.setQuery('  ');
    expect(states.at(-1)).toEqual({ results: [], status: 'idle' });
  });

  it('near를 검색에 실어 보낸다(getter는 검색 시점 값)', () => {
    const p = controllable();
    let center = { lat: 37.5, lng: 127.0 };
    const s = createPlaceSearcher(p, () => {}, 250, () => center);
    s.setQuery('카페');
    center = { lat: 35.1, lng: 129.0 }; // 디바운스 중 지도가 움직임
    vi.advanceTimersByTime(250);
    expect(p.search).toHaveBeenCalledWith('카페', { lat: 35.1, lng: 129.0 });
  });

  it('near가 없으면 기존처럼 질의만 넘긴다(하위호환)', () => {
    const p = controllable();
    const s = createPlaceSearcher(p, () => {}, 250);
    s.setQuery('카페');
    vi.advanceTimersByTime(250);
    expect(p.search).toHaveBeenCalledWith('카페');
  });
});
