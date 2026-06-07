/**
 * 로드뷰 화면 순수 로직 (C5 — react-native·expo 비의존).
 *
 * 한국=카카오 로드뷰(웹 JS API 자리, 키 0개면 placeholder),
 * 글로벌=구글 스트리트뷰 딥링크. 어느 쪽인지 판정만 여기서 한다.
 */
import type { PlaceDetail } from '@wayfinder/shared';

/** 로드뷰 모드: 한국 카카오 로드뷰 vs 글로벌 구글 스트리트뷰 딥링크. */
export type RoadviewMode = 'kakao-roadview' | 'google-streetview';

/**
 * 장소가 카카오 로드뷰(한국)를 갖는지에 따라 모드를 정한다.
 * PlaceDetail.roadview가 있으면 한국 로드뷰, 없으면 글로벌 스트리트뷰 딥링크(§5).
 */
export function selectRoadviewMode(detail: PlaceDetail): RoadviewMode {
  return detail.roadview ? 'kakao-roadview' : 'google-streetview';
}
