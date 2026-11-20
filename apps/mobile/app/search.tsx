/**
 * Search 라우트 — /search (E3).
 *
 * C2 SearchScreen에 배선(시그니처 불변). provider = PlaceService(실 프록시, 데모 모드면 내부에서 mock).
 * 화면 기본값(mockPlaceProvider)을 그대로 두면 배포본 검색이 항상 mock이 된다(2026-11-18 수정).
 * 검색 기준 좌표는 지도 중심(스토어 카메라). 장소를 고르면 핀·카메라를 스토어에 기록한 뒤
 * /place/[id]?name&lat&lng 엿보기 시트를 push한다 — 뒤로가기는 검색어·결과가 남은 검색으로 돌아온다.
 * 장소 시트가 덮는 동안 검색 패널은 숨긴다(OverlayPanel hidden, 상태 유지).
 */
import React, { useCallback } from 'react';
import { useIsFocused, useRouter } from 'expo-router';
import type { CameraState, Place } from '@wayfinder/shared';
import { SearchScreen } from '../src/screens/SearchScreen';
import * as PlaceService from '../src/services/PlaceService';
import { OverlayPanel } from '../src/components/OverlayPanel';
import { useAppStore } from '../src/state/store';
import { placeHref } from '../src/search/placeUrl';

export default function SearchRoute() {
  const router = useRouter();
  const focusPlace = useAppStore((s) => s.focusPlace);
  const near = useAppStore((s) => s.camera.center);
  const isFocused = useIsFocused();

  const onSelectPlace = useCallback(
    (place: Place, camera: CameraState) => {
      focusPlace({ id: place.id, name: place.name, coord: place.coord }, camera);
      router.push(placeHref(place));
    },
    [router, focusPlace],
  );

  const onCancel = useCallback(() => router.back(), [router]);

  return (
    <OverlayPanel title="검색" hidden={!isFocused}>
      <SearchScreen provider={PlaceService} near={near} onSelectPlace={onSelectPlace} onCancel={onCancel} />
    </OverlayPanel>
  );
}
