/**
 * 딥링크 URL 헬퍼 (C4·C5 — 순수 로직).
 *
 * 외부 플랫폼 "더보기"·스트리트뷰 진입의 타깃 URL을 만든다.
 * expo-linking(Linking.openURL)은 컴포넌트 레이어에서만 호출하고, 이 모듈은
 * URL 문자열 생성만 담당한다(react-native·expo 비의존 → node 환경 단위 테스트 가능).
 */
import type { LatLng, PlaceLinks } from '@wayfinder/shared';

/** 플랫폼 탭의 "더보기" 딥링크 대상 플랫폼. */
export type DeeplinkPlatform = 'google' | 'naver' | 'kakao';

/** PlaceLinks에서 플랫폼별 "더보기" URL을 고른다. 미제공 시 undefined. */
export function resolvePlatformLink(
  links: PlaceLinks,
  platform: DeeplinkPlatform,
): string | undefined {
  switch (platform) {
    case 'google':
      return links.googleMaps;
    case 'naver':
      return links.naverPlace;
    case 'kakao':
      return links.kakaoMap;
  }
}

/**
 * 구글 스트리트뷰 딥링크 (글로벌 로드뷰 — C5).
 * Google Maps Street View 표준 파라미터(`?api=1&map_action=pano`)를 사용한다.
 */
export function buildStreetViewUrl(coord: LatLng): string {
  return `https://www.google.com/maps/@?api=1&map_action=pano&viewpoint=${coord.lat},${coord.lng}`;
}
