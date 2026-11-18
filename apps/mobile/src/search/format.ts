/**
 * 검색 결과 행 표시용 순수 포맷터 — 거리, 부제목, 일치 부분 강조.
 */
import type { Place } from '@wayfinder/shared';

/** 350 → "350m", 1234 → "1.2km", 12500 → "13km". */
export function formatDistance(meters: number): string {
  if (!Number.isFinite(meters) || meters < 0) return '';
  if (meters < 1000) return `${Math.round(meters)}m`;
  const km = meters / 1000;
  return km < 10 ? `${km.toFixed(1)}km` : `${Math.round(km)}km`;
}

/** `업종 · 거리 · 주소` — 비어 있는 항목은 건너뛴다. */
export function placeSubtitle(place: Pick<Place, 'category' | 'categoryGroup' | 'distanceM' | 'address'>): string {
  const parts = [
    place.categoryGroup || place.category,
    place.distanceM === undefined ? '' : formatDistance(place.distanceM),
    place.address,
  ];
  return parts.filter(Boolean).join(' · ');
}

export interface TextSegment {
  text: string;
  match: boolean;
}

/** text에서 query(공백 제거·대소문자 무시)와 일치하는 첫 부분을 분리한다. 일치가 없으면 통째로 1조각. */
export function splitMatch(text: string, query: string): TextSegment[] {
  const q = query.trim().toLowerCase();
  const at = q ? text.toLowerCase().indexOf(q) : -1;
  if (at < 0) return [{ text, match: false }];
  return [
    { text: text.slice(0, at), match: false },
    { text: text.slice(at, at + q.length), match: true },
    { text: text.slice(at + q.length), match: false },
  ].filter((s) => s.text.length > 0);
}
