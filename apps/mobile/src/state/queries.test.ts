/**
 * D4 — queries.ts 단위 테스트.
 *
 * queryOptions 팩토리를 순수 함수로 테스트한다 (QueryClientProvider 불필요).
 * 캐시 키 구조 · enabled 플래그 · lazy-google 동작을 검증한다.
 *
 * lazy 부정 테스트 (§11 과금 방어선):
 *   - 검색 · 상세 조회 시 googleDataQueryOptions.enabled = false
 *   - 구글 탭 활성화(isGoogleTabActive=true)일 때만 enabled = true
 *
 * 실행: node_modules/.bin/vitest run --config apps/mobile/src/__tests__/vitest.config.ts
 */
import { describe, it, expect } from 'vitest';
import { ApiError } from '../services/apiClient.js';
import {
  shouldRetryPlaceDetail,
  queryKeys,
  searchQueryOptions,
  placeDetailQueryOptions,
  googleDataQueryOptions,
} from './queries.js';

describe('queryKeys — 캐시 키 구조', () => {
  it('search 키는 [places, search, query] 형태', () => {
    expect(queryKeys.search('카페')).toEqual(['places', 'search', '카페']);
  });

  it('detail 키는 [places, detail, id] 형태', () => {
    expect(queryKeys.detail('kakao:123')).toEqual(['places', 'detail', 'kakao:123']);
  });

  it('googleData 키는 [places, google, id] 형태', () => {
    expect(queryKeys.googleData('kakao:123')).toEqual(['places', 'google', 'kakao:123']);
  });

  it('검색·상세·구글은 서로 다른 키', () => {
    const id = 'kakao:123';
    expect(queryKeys.search(id)).not.toEqual(queryKeys.detail(id));
    expect(queryKeys.detail(id)).not.toEqual(queryKeys.googleData(id));
  });
});

describe('searchQueryOptions — 활성화 조건', () => {
  it('비어 있지 않은 query면 enabled=true', () => {
    const opts = searchQueryOptions('카페');
    expect(opts.enabled).toBe(true);
  });

  it('빈 query면 enabled=false', () => {
    const opts = searchQueryOptions('');
    expect(opts.enabled).toBe(false);
  });

  it('공백만 있으면 enabled=false', () => {
    const opts = searchQueryOptions('   ');
    expect(opts.enabled).toBe(false);
  });
});

describe('placeDetailQueryOptions — 활성화 조건', () => {
  it('id가 있으면 enabled=true', () => {
    const opts = placeDetailQueryOptions('kakao:123');
    expect(opts.enabled).toBe(true);
  });

  it('id가 null이면 enabled=false', () => {
    const opts = placeDetailQueryOptions(null);
    expect(opts.enabled).toBe(false);
  });
});

describe('googleDataQueryOptions — lazy-google 방어선 (§11)', () => {
  it('isGoogleTabActive=false이면 enabled=false (구글 탭 미열림 → 구글 fetch 없음)', () => {
    const opts = googleDataQueryOptions('kakao:123', false);
    expect(opts.enabled).toBe(false);
  });

  it('isGoogleTabActive=true이면 enabled=true (탭 열림 → fetch 허용)', () => {
    const opts = googleDataQueryOptions('kakao:123', true);
    expect(opts.enabled).toBe(true);
  });

  it('id=null이면 isGoogleTabActive=true라도 enabled=false', () => {
    const opts = googleDataQueryOptions(null, true);
    expect(opts.enabled).toBe(false);
  });

  it('검색 시점(isGoogleTabActive=false)에는 구글 fetch 없음 — 부정 테스트', () => {
    // 검색 결과를 받았을 때 구글 탭이 아직 안 열린 상황
    const searchOpts = searchQueryOptions('카페');
    const googleOpts = googleDataQueryOptions('kakao:123', false);

    // 검색 쿼리는 활성화, 구글 쿼리는 비활성화
    expect(searchOpts.enabled).toBe(true);
    expect(googleOpts.enabled).toBe(false);
  });

  it('상세 열기 시점에도 구글 탭 미활성이면 구글 fetch 없음', () => {
    const detailOpts = placeDetailQueryOptions('kakao:123');
    const googleOpts = googleDataQueryOptions('kakao:123', false);

    // 상세 쿼리는 활성화, 구글 쿼리는 비활성화
    expect(detailOpts.enabled).toBe(true);
    expect(googleOpts.enabled).toBe(false);
  });
});

describe('googleDataQueryOptions — 구글 캐시 키 분리', () => {
  it('상세 키와 구글 키가 다르므로 별도 캐시 항목 사용', () => {
    const id = 'kakao:123';
    const detailOpts = placeDetailQueryOptions(id);
    const googleOpts = googleDataQueryOptions(id, true);
    expect(detailOpts.queryKey).not.toEqual(googleOpts.queryKey);
  });
});

describe('shouldRetryPlaceDetail — 404는 재시도하지 않는다', () => {
  it('404 ApiError는 즉시 실패', () => {
    expect(shouldRetryPlaceDetail(0, new ApiError(404, 'not found'))).toBe(false);
  });
  it('그 외 오류는 2번까지 재시도', () => {
    expect(shouldRetryPlaceDetail(0, new ApiError(502, 'bad gateway'))).toBe(true);
    expect(shouldRetryPlaceDetail(1, new Error('network'))).toBe(true);
    expect(shouldRetryPlaceDetail(2, new Error('network'))).toBe(false);
  });
});
