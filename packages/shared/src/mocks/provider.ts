/**
 * PlaceProvider 계약 + fixture 기반 구현 (설계 문서 §6·§9·§11).
 *
 * 이 인터페이스가 앱의 데모 모드(mock provider)와 프록시 테스트 양쪽의 공통 입력이다.
 * 실 모드에서는 프록시 호출 구현이, 데모 모드에서는 아래 fixture 구현이 동일 계약을 만족한다.
 */
import type { Place, PlaceDetail } from '../types/place.js';
import { PLACE_DETAILS, SEARCH_RESULTS } from './fixtures.js';

/**
 * 장소 공급자 계약.
 * - search: 질의어로 장소 리스트 반환 (검색·자동완성). 구글 호출 없음 (§11 lazy 방어선).
 * - getDetail: id로 상세 반환. 구글 평점·리뷰는 상세에서 lazy load.
 */
export interface PlaceProvider {
  search(query: string): Promise<Place[]>;
  getDetail(id: string): Promise<PlaceDetail>;
}

/** id로 찾을 수 없을 때 던지는 에러. */
export class PlaceNotFoundError extends Error {
  constructor(public readonly id: string) {
    super(`Place not found: ${id}`);
    this.name = 'PlaceNotFoundError';
  }
}

/**
 * fixture 기반 mock provider. 결정론적·동기 데이터를 Promise로 감싸 실 구현과
 * 동일한 비동기 계약을 유지한다 (한/영 입력 모두 동작).
 */
export const mockPlaceProvider: PlaceProvider = {
  async search(query: string): Promise<Place[]> {
    const q = query.trim().toLowerCase();
    if (q.length === 0) {
      return [];
    }
    return SEARCH_RESULTS.filter(
      (place) =>
        place.name.toLowerCase().includes(q) ||
        place.address.toLowerCase().includes(q) ||
        place.category.toLowerCase().includes(q),
    );
  },

  async getDetail(id: string): Promise<PlaceDetail> {
    const detail = PLACE_DETAILS[id];
    if (!detail) {
      throw new PlaceNotFoundError(id);
    }
    return detail;
  },
};
