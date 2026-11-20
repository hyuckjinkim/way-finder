/**
 * 저장한 장소(F1) — 웹은 localStorage(try/catch), 그 외·차단 시 메모리. recentSearches.ts와 같은 방식.
 *
 * ponytail: 카카오는 "로컬 API 결과 데이터를 별도로 저장해 사용하는 것"을 금지한다(devtalk FAQ 125610).
 * 사용자가 직접 고른 북마크만, 다시 여는 데 필요한 최소 필드(id·이름·좌표·업종·주소)만 이 기기에 둔다.
 * 이것이 금지 조항에 해당하는지는 공식 답변 전까지 열린 질문 — 답이 "불가"면 주소·업종부터 뺀다.
 */
import { useSyncExternalStore } from 'react';
import type { LatLng, Place } from '@wayfinder/shared';
import { parsePlaceHint } from '../search/placeUrl';

export const FAVORITES_KEY = 'wayfinder.favorites';
export const MAX_FAVORITES = 200;

export interface SavedPlace {
  id: string;
  name: string;
  coord: LatLng;
  category: string;
  address: string;
  /** 저장 시각(epoch ms). */
  savedAt: number;
}

type KeyValueStorage = Pick<Storage, 'getItem' | 'setItem'>;

export function isFavorite(list: readonly SavedPlace[], id: string): boolean {
  return list.some((p) => p.id === id);
}

/** 맨 앞에 추가(같은 id는 끌어올림), 최대 MAX_FAVORITES개. 필드는 골라 담는다 — 상세(리뷰·블로그 등)를 통째로 저장하지 않게. */
export function addFavorite(list: readonly SavedPlace[], place: Place, now: number = Date.now()): SavedPlace[] {
  const { id, name, coord, category, address } = place;
  const saved: SavedPlace = { id, name, coord: { lat: coord.lat, lng: coord.lng }, category, address, savedAt: now };
  return [saved, ...list.filter((p) => p.id !== id)].slice(0, MAX_FAVORITES);
}

export function removeFavorite(list: readonly SavedPlace[], id: string): SavedPlace[] {
  return list.filter((p) => p.id !== id);
}

export function toggleFavorite(list: readonly SavedPlace[], place: Place, now: number = Date.now()): SavedPlace[] {
  return isFavorite(list, place.id) ? removeFavorite(list, place.id) : addFavorite(list, place, now);
}

/** 깨진 항목은 버린다 — 특히 placeHref 힌트(이름·좌표)가 없으면 링크가 404라 남길 이유가 없다. */
function parse(raw: string | null): SavedPlace[] {
  let v: unknown;
  try {
    v = JSON.parse(raw ?? '[]');
  } catch {
    return [];
  }
  if (!Array.isArray(v)) return [];
  const out: SavedPlace[] = [];
  for (const x of v as Partial<SavedPlace>[]) {
    if (!x || typeof x.id !== 'string' || !x.id || typeof x.name !== 'string') continue;
    const hint = parsePlaceHint({ name: x.name, lat: String(x.coord?.lat), lng: String(x.coord?.lng) });
    if (!hint) continue;
    out.push({
      id: x.id,
      name: hint.name,
      coord: hint.coord,
      category: typeof x.category === 'string' ? x.category : '',
      address: typeof x.address === 'string' ? x.address : '',
      savedAt: typeof x.savedAt === 'number' ? x.savedAt : 0,
    });
  }
  return out.slice(0, MAX_FAVORITES);
}

export interface FavoriteStore {
  /** 같은 save() 사이에는 같은 배열 참조(useSyncExternalStore 스냅샷). */
  load(): SavedPlace[];
  save(list: SavedPlace[]): void;
  subscribe(listener: () => void): () => void;
}

export function createFavoriteStore(getStorage: () => KeyValueStorage | undefined): FavoriteStore {
  let memory: SavedPlace[] | undefined;
  const listeners = new Set<() => void>();
  return {
    load() {
      if (memory) return memory;
      memory = [];
      try {
        const s = getStorage();
        if (s) memory = parse(s.getItem(FAVORITES_KEY));
      } catch {
        // 저장소 접근 불가 — 빈 목록(메모리)으로 시작
      }
      return memory;
    },
    save(list) {
      memory = list;
      try {
        getStorage()?.setItem(FAVORITES_KEY, JSON.stringify(list));
      } catch {
        // 저장 실패는 치명적이지 않다 — 이번 세션 동안은 메모리에 남는다.
      }
      listeners.forEach((l) => l());
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}

export const favoriteStore: FavoriteStore = createFavoriteStore(() =>
  typeof localStorage === 'undefined' ? undefined : localStorage,
);

const NONE: SavedPlace[] = [];

/** 장소 시트·검색 화면이 같은 목록을 본다(검색 패널은 시트 아래에 마운트된 채 남는다). SSR은 빈 목록. */
export function useFavorites(): SavedPlace[] {
  return useSyncExternalStore(favoriteStore.subscribe, favoriteStore.load, () => NONE);
}
