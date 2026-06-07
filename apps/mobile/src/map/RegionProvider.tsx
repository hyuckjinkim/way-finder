/**
 * RegionProvider (스트림 B — B1).
 *
 * 카메라 중심/줌으로 지도 렌더러(한국=Kakao / 글로벌=MapLibre)를 선택한다.
 * `@wayfinder/shared/region`의 순수 함수 `selectRenderer`(히스테리시스·줌<6 강제)를
 * React 상태로 감싸, 직전 렌더러를 기억해 경계 패닝 시 깜빡임을 막는다.
 *
 * 렌더러 전환 시 카메라 상태는 props로 그대로 흐르므로(두 구현체가 동일 `CameraState`
 * 계약을 받음) 별도 이어받기 로직 없이 카메라가 이어진다. 이 모듈은 *선택*만 책임진다.
 */
import { useRef } from 'react';
import { selectRenderer } from '@wayfinder/shared/region';
import type { RegionRenderer } from '@wayfinder/shared/region';
import type { CameraState } from '@wayfinder/shared';

export type { RegionRenderer };

/**
 * 카메라 + 직전 렌더러로부터 다음 렌더러를 결정하는 순수 함수.
 * 히스테리시스/저줌 강제는 shared의 `selectRenderer`에 위임한다.
 * 훅과 디스패처(B4) 양쪽에서 재사용하며, 단위 테스트의 대상이다.
 */
export function nextRenderer(
  camera: CameraState,
  current?: RegionRenderer,
): RegionRenderer {
  return selectRenderer(camera.center, camera.zoom, current);
}

/**
 * 카메라 상태로부터 현재 렌더러를 결정하는 훅.
 *
 * 직전 렌더러를 ref에 보관해 히스테리시스를 적용한다(상태 갱신이 아니라 ref라
 * 추가 렌더를 유발하지 않으며, 반환값 변화는 부모의 camera 변경으로 이미 리렌더됨).
 *
 * @param camera 현재 카메라 상태(center + zoom)
 * @returns 'korea' | 'global'
 */
export function useRegionRenderer(camera: CameraState): RegionRenderer {
  const previous = useRef<RegionRenderer | undefined>(undefined);
  const next = nextRenderer(camera, previous.current);
  previous.current = next;
  return next;
}
