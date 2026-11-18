/**
 * PlaceDetail 라우트 — /place/[id]?name=&lat=&lng= (E3).
 *
 * transparentModal(_layout.tsx)로 홈 지도 위에 엿보기 바텀시트(폰)/플로팅 카드(데스크톱)로 뜬다.
 * name·lat·lng는 프록시 힌트(카카오는 id 단건 조회가 없음) — 새로고침·공유 링크에서도 상세가 열리도록
 * URL에 싣는다. 이 라우트가 포커스를 가지면 스토어에 선택 장소를 기록해 홈이 핀을 찍는다.
 *
 * 구글 평점·리뷰는 PlaceDetailSheet 내부에서 lazy 로드되며 loadGoogle 어댑터로 getGoogleData(id)를
 * 주입한다(구글 탭 활성 시에만 호출). 정적 export(SSR) 시 detail은 undefined — 가드 후 렌더한다.
 */
import React, { useCallback, useEffect } from 'react';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import type { PlaceDetail } from '@wayfinder/shared';
import { OverlayPanel } from '../../src/components/OverlayPanel';
import { PlaceDetailSheet, type GoogleData } from '../../src/screens/PlaceDetailSheet';
import { PlaceSheetStatus } from '../../src/screens/PlaceSheetStatus';
import { cameraForPlace } from '../../src/screens/searchCamera';
import { usePlaceDetailQuery } from '../../src/state/queries';
import { useAppStore } from '../../src/state/store';
import { getGoogleData } from '../../src/services/PlaceService';
import { parsePlaceHint } from '../../src/search/placeUrl';
import { routeInputHref } from '../../src/search/placeActions';

export default function PlaceDetailRoute() {
  const params = useLocalSearchParams<{ id: string; name?: string; lat?: string; lng?: string }>();
  const router = useRouter();
  const id = params.id ?? null;
  const hint = parsePlaceHint(params);
  const { data: detail, isError, refetch, isFetching } = usePlaceDetailQuery(id, hint);

  // 포커스를 가질 때 선택 장소를 기록(딥링크·새로고침 포함). 검색에서 막 골랐다면 이미 같은 id라 건드리지 않는다.
  const hintKey = hint ? `${hint.name}|${hint.coord.lat}|${hint.coord.lng}` : '';
  useFocusEffect(
    useCallback(() => {
      if (!id || !hint) return;
      const state = useAppStore.getState();
      if (state.selectedPlace?.id !== id) {
        state.focusPlace({ id, ...hint }, cameraForPlace(hint));
      }
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [id, hintKey]),
  );

  // 이 시트가 사라지면(✕·브라우저 뒤로가기 모두) 핀을 지운다 — 다른 장소가 이미 선택됐다면 그대로 둔다.
  useEffect(
    () => () => {
      const state = useAppStore.getState();
      if (state.selectedPlace?.id === id) state.setSelectedPlace(null);
    },
    [id],
  );

  const loadGoogle = useCallback(
    (): Promise<GoogleData> => getGoogleData(id ?? ''),
    [id],
  );

  const onOpenRoadview = useCallback(
    (d: PlaceDetail) => router.push(`/roadview/${encodeURIComponent(d.id)}`),
    [router],
  );

  const onClose = useCallback(() => {
    if (router.canGoBack()) router.back();
    else router.replace('/');
  }, [router]);

  const onSetOrigin = useCallback(
    (d: PlaceDetail) => router.push(routeInputHref('origin', d)),
    [router],
  );
  const onSetDestination = useCallback(
    (d: PlaceDetail) => router.push(routeInputHref('destination', d)),
    [router],
  );

  const name = detail?.name ?? hint?.name;

  return (
    <OverlayPanel initialSnap="peek" title={name ?? '장소 정보'}>
      {detail ? (
        <PlaceDetailSheet
          detail={detail}
          loadGoogle={loadGoogle}
          onOpenRoadview={onOpenRoadview}
          onSetOrigin={onSetOrigin}
          onSetDestination={onSetDestination}
          onClose={onClose}
        />
      ) : (
        <PlaceSheetStatus
          name={name}
          state={isError ? 'error' : 'loading'}
          retrying={isFetching}
          onRetry={() => void refetch()}
          onClose={onClose}
        />
      )}
    </OverlayPanel>
  );
}
