import { describe, it, expect } from 'vitest';
import { SEOUL_CAFE, TOKYO_PLACE } from '@wayfinder/shared/mocks';
import {
  resolvePlatformLink,
  buildStreetViewUrl,
} from './deeplinks.js';

describe('resolvePlatformLink — 플랫폼별 더보기 URL', () => {
  it('google/naver/kakao 각각 올바른 링크를 고른다', () => {
    expect(resolvePlatformLink(SEOUL_CAFE.links, 'google')).toBe(
      SEOUL_CAFE.links.googleMaps,
    );
    expect(resolvePlatformLink(SEOUL_CAFE.links, 'naver')).toBe(
      SEOUL_CAFE.links.naverPlace,
    );
    expect(resolvePlatformLink(SEOUL_CAFE.links, 'kakao')).toBe(
      SEOUL_CAFE.links.kakaoMap,
    );
  });

  it('미제공 플랫폼은 undefined (글로벌 장소는 네이버·카카오 링크 없음)', () => {
    expect(resolvePlatformLink(TOKYO_PLACE.links, 'naver')).toBeUndefined();
    expect(resolvePlatformLink(TOKYO_PLACE.links, 'kakao')).toBeUndefined();
    expect(resolvePlatformLink(TOKYO_PLACE.links, 'google')).toBe(
      TOKYO_PLACE.links.googleMaps,
    );
  });
});

describe('buildStreetViewUrl — 구글 스트리트뷰 딥링크(글로벌 로드뷰)', () => {
  it('좌표를 viewpoint 파라미터로 담은 표준 pano URL', () => {
    const url = buildStreetViewUrl(TOKYO_PLACE.coord);
    expect(url).toContain('map_action=pano');
    expect(url).toContain(
      `viewpoint=${TOKYO_PLACE.coord.lat},${TOKYO_PLACE.coord.lng}`,
    );
  });
});
