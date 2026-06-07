/**
 * Search 라우트 — /search (E3).
 *
 * C2 SearchScreen에 배선(시그니처 불변). provider는 화면 기본값(mockPlaceProvider)을 그대로 사용 —
 * 데모 모드에서 mock 데이터가 흐른다. 장소 선택 시 D4 스토어에 카메라·선택 장소를 기록하고
 * /place/[id] 상세로 이동한다.
 */
import React, { useCallback } from 'react';
import { useRouter } from 'expo-router';
import type { CameraState, Place } from '@wayfinder/shared';
import { SearchScreen } from '../src/screens/SearchScreen';
import { useAppStore } from '../src/state/store';

export default function SearchRoute() {
  const router = useRouter();
  const setCamera = useAppStore((s) => s.setCamera);
  const selectPlace = useAppStore((s) => s.selectPlace);

  const onSelectPlace = useCallback(
    (place: Place, camera: CameraState) => {
      setCamera(camera);
      selectPlace(place.id);
      router.push(`/place/${encodeURIComponent(place.id)}`);
    },
    [router, setCamera, selectPlace],
  );

  const onCancel = useCallback(() => router.back(), [router]);

  return <SearchScreen onSelectPlace={onSelectPlace} onCancel={onCancel} />;
}
