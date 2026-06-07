/**
 * 한국 지역 판정 + 히스테리시스 (설계 문서 §5 "지역 전환 로직").
 * 순수 함수 — 카메라 중심 좌표/줌으로 지도 렌더러(한국=Kakao / 글로벌=MapLibre)를 선택.
 *
 * 규칙:
 * - 한국 bbox: 위도 33.0~38.7, 경도 124.5~132.0
 * - 히스테리시스 완충지대 ±0.5° (경계 패닝 시 렌더러 깜빡임 방지)
 * - 줌 < 6 (세계 지도 수준)이면 항상 글로벌 (카카오 타일은 한국 밖 빈 화면)
 */
import type { LatLng } from '../types/geo.js';

/** 어떤 지도 렌더러를 쓸지. */
export type RegionRenderer = 'korea' | 'global';

/** 한국 bbox 경계 (도 단위). */
export const KOREA_BBOX = {
  minLat: 33.0,
  maxLat: 38.7,
  minLng: 124.5,
  maxLng: 132.0,
} as const;

/** 히스테리시스 완충 폭 (도). */
export const HYSTERESIS_DEG = 0.5;

/** 이 줌 미만이면 항상 글로벌 (세계 지도 수준). */
export const GLOBAL_ZOOM_THRESHOLD = 6;

/**
 * 좌표가 한국 코어 bbox(완충·히스테리시스 없음) 안에 있는지.
 * 경로 지역 판정용 순수 함수 (§8 critic M2). 렌더러용 `selectRenderer`와
 * 별개 — 줌/히스테리시스 시맨틱 없음. 경로 워커는 이것만 사용한다.
 */
export function isKoreaCoord(coord: LatLng): boolean {
  return (
    coord.lat >= KOREA_BBOX.minLat &&
    coord.lat <= KOREA_BBOX.maxLat &&
    coord.lng >= KOREA_BBOX.minLng &&
    coord.lng <= KOREA_BBOX.maxLng
  );
}

/**
 * 경로 탐색용 지역 판정 (§8 critic M2).
 * 전체 stops가 한국 코어 bbox 안이면 'kr', 하나라도 밖이면 'global'.
 * 'kr' → 카카오모빌리티/TMAP/ODsay, 'global' → Google/Mapbox.
 */
export function routeRegion(stops: LatLng[]): 'kr' | 'global' {
  return stops.every(isKoreaCoord) ? 'kr' : 'global';
}

/** 좌표가 한국 코어 bbox(완충 없음) 안에 있는지. */
function isInsideCore(coord: LatLng): boolean {
  return isKoreaCoord(coord);
}

/** 좌표가 한국 bbox + 완충지대(±0.5°) 안에 있는지. */
function isInsideBuffered(coord: LatLng): boolean {
  return (
    coord.lat >= KOREA_BBOX.minLat - HYSTERESIS_DEG &&
    coord.lat <= KOREA_BBOX.maxLat + HYSTERESIS_DEG &&
    coord.lng >= KOREA_BBOX.minLng - HYSTERESIS_DEG &&
    coord.lng <= KOREA_BBOX.maxLng + HYSTERESIS_DEG
  );
}

/**
 * 히스테리시스를 적용해 렌더러를 선택한다.
 *
 * 줌이 임계값 미만이면 무조건 글로벌. 그 외에는:
 * - 현재 렌더러가 'korea'면 완충 bbox를 벗어날 때까지 'korea' 유지 (이탈 방지)
 * - 현재 렌더러가 'global'이거나 미지정이면 코어 bbox에 진입할 때만 'korea'로 전환
 *
 * 이렇게 하면 경계를 오가며 패닝해도 렌더러가 깜빡이지 않는다.
 *
 * @param coord 카메라 중심 좌표
 * @param zoom 현재 줌 레벨
 * @param current 직전 렌더러 (없으면 코어 bbox 기준 초기 판정)
 */
export function selectRenderer(
  coord: LatLng,
  zoom: number,
  current?: RegionRenderer,
): RegionRenderer {
  // 저줌은 항상 글로벌 — 카카오 타일은 한국 밖에서 빈 화면.
  if (zoom < GLOBAL_ZOOM_THRESHOLD) {
    return 'global';
  }

  if (current === 'korea') {
    // 한국 상태 유지: 완충지대를 완전히 벗어나야 글로벌로 전환.
    return isInsideBuffered(coord) ? 'korea' : 'global';
  }

  // 글로벌(또는 초기) 상태: 코어 bbox에 진입해야 한국으로 전환.
  return isInsideCore(coord) ? 'korea' : 'global';
}
