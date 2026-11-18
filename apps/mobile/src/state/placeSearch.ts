/**
 * 입력 중 장소 검색 — 디바운스 + "마지막 입력만 반영".
 *
 * 한글 IME는 "강→강남→강남ㅇ→강남역"처럼 조합 단계마다 onChangeText를 쏜다. 매 입력마다 검색하면
 * (1) 응답 순서가 뒤바뀌어 늦게 온 중간 단어("강남ㅇ" → 0건)가 최종 결과를 덮고,
 * (2) 프록시 레이트리밋(60/분)·KV 쓰기 쿼터를 빠르게 소진한다. 둘 다 여기서 막는다.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import type { LatLng, Place } from '@wayfinder/shared';

export const SEARCH_DEBOUNCE_MS = 250;

export type SearchStatus = 'idle' | 'loading' | 'done' | 'error';

interface Searcher {
  /** near: 지도 중심·GPS — 있으면 프록시가 거리순·거리값을 채운다. */
  search(query: string, near?: LatLng): Promise<Place[]>;
}

/** 고정 좌표 또는 매 검색 시점에 읽는 getter(지도가 움직여도 최신 중심을 쓰려고). */
export type NearSource = LatLng | (() => LatLng | undefined);

export interface PlaceSearchState {
  results: Place[];
  status: SearchStatus;
}

/** React 없이 테스트 가능한 코어. setQuery마다 이전 예약·진행 중 응답을 무효화한다. */
export function createPlaceSearcher(
  provider: Searcher,
  onChange: (state: PlaceSearchState) => void,
  delayMs: number = SEARCH_DEBOUNCE_MS,
  near?: NearSource,
): { setQuery(text: string): void; dispose(): void } {
  let seq = 0;
  let timer: ReturnType<typeof setTimeout> | null = null;

  const cancel = (): void => {
    seq += 1;
    if (timer !== null) clearTimeout(timer);
    timer = null;
  };

  return {
    setQuery(text) {
      cancel();
      const q = text.trim();
      if (!q) {
        onChange({ results: [], status: 'idle' });
        return;
      }
      const my = seq;
      onChange({ results: [], status: 'loading' });
      timer = setTimeout(() => {
        const at = typeof near === 'function' ? near() : near;
        (at ? provider.search(q, at) : provider.search(q)).then(
          (results) => my === seq && onChange({ results, status: 'done' }),
          () => my === seq && onChange({ results: [], status: 'error' }),
        );
      }, delayMs);
    },
    dispose: cancel,
  };
}

/** 화면용 훅 — 입력값을 setQuery로 넘기고 state를 렌더한다. */
export function usePlaceSearch(provider: Searcher, near?: LatLng): PlaceSearchState & {
  setQuery(text: string): void;
} {
  const [state, setState] = useState<PlaceSearchState>({ results: [], status: 'idle' });
  const searcher = useRef<ReturnType<typeof createPlaceSearcher> | null>(null);
  const nearRef = useRef(near);
  nearRef.current = near;
  useEffect(() => {
    searcher.current = createPlaceSearcher(provider, setState, SEARCH_DEBOUNCE_MS, () => nearRef.current);
    return () => searcher.current?.dispose();
  }, [provider]);
  const setQuery = useCallback((text: string) => searcher.current?.setQuery(text), []);
  return { ...state, setQuery };
}
