/**
 * 최근 검색어 — 웹은 localStorage(try/catch), 그 외는 메모리(추가 의존성 없음).
 */
export const RECENT_KEY = 'wayfinder.recentSearches';
export const MAX_RECENT = 10;

type KeyValueStorage = Pick<Storage, 'getItem' | 'setItem'>;

/** 맨 앞에 추가(중복은 끌어올림), 최대 MAX_RECENT개. 빈 검색어는 무시. */
export function pushRecent(list: readonly string[], query: string): string[] {
  const q = query.trim();
  if (!q) return [...list];
  return [q, ...list.filter((x) => x !== q)].slice(0, MAX_RECENT);
}

export function removeRecent(list: readonly string[], query: string): string[] {
  return list.filter((x) => x !== query);
}

function parse(raw: string | null): string[] {
  try {
    const v: unknown = JSON.parse(raw ?? '[]');
    return Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string').slice(0, MAX_RECENT) : [];
  } catch {
    return [];
  }
}

export interface RecentStore {
  load(): string[];
  save(list: string[]): void;
}

/** storage가 없거나 접근이 막히면(사생활 보호 모드 등) 메모리에만 보관한다. */
export function createRecentStore(getStorage: () => KeyValueStorage | undefined): RecentStore {
  let memory: string[] = [];
  return {
    load() {
      try {
        const s = getStorage();
        if (s) memory = parse(s.getItem(RECENT_KEY));
      } catch {
        // 저장소 접근 불가 — 메모리 값 사용
      }
      return memory;
    },
    save(list) {
      memory = list;
      try {
        getStorage()?.setItem(RECENT_KEY, JSON.stringify(list));
      } catch {
        // 저장 실패는 치명적이지 않다 — 이번 세션 동안은 메모리에 남는다.
      }
    },
  };
}

export const recentStore: RecentStore = createRecentStore(() =>
  typeof localStorage === 'undefined' ? undefined : localStorage,
);
