/**
 * 경로 입력 라우트 — /route/input (E2 + P4 D1).
 *
 * C2 RouteInputScreen에 어댑터로 배선(화면 시그니처 불변, 어댑터는 라우트 파일).
 * onSubmit(RouteRequest) → D2 routeStore에 stops·mode·preference·maxExtraMinutes 기록 후 /route/result로 이동
 * (선호·예산은 URL pref·max에도 싣는다).
 * provider = PlaceService(실 프록시, 데모 모드면 내부에서 mock) — 화면 기본값(mock)을 쓰면 배포본이 항상 mock.
 *
 * P4 D1: RouteOptionsBar 슬롯 배선. B 스트림 완료 전 placeholder stub 사용.
 */
import React, { useCallback, useMemo, useState } from 'react';
import { useLocalSearchParams, useRouter, type Href } from 'expo-router';
import type { RoutePreference, RouteRequest, TravelMode } from '@wayfinder/shared';
import { RouteInputScreen } from '../../src/screens/RouteInputScreen';
import * as PlaceService from '../../src/services/PlaceService';
import { getCurrentCamera, DEFAULT_CAMERA } from '../../src/services/LocationService';
import { useRouteStore } from '../../src/state/routeStore';
import { useCapabilities } from '../../src/state/routeQueries';
import { RouteOptionsBar } from '../../src/route/RouteOptionsBar';
import { showWalkPreferences } from '../../src/route/capabilities';
import { parseRouteParams, routeQuery, type RouteUrlState } from '../../src/route/routeUrl';
import { OverlayPanel } from '../../src/components/OverlayPanel';

/** 현재 위치. 권한 거부·실패 시 LocationService가 기본 카메라(서울)로 폴백하므로 그 값은 "위치 없음"으로 본다. */
async function locateUser() {
  const { center } = await getCurrentCamera();
  const isFallback = center.lat === DEFAULT_CAMERA.center.lat && center.lng === DEFAULT_CAMERA.center.lng;
  return isFallback ? null : center;
}

export default function RouteInputRoute() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const capabilities = useCapabilities();
  const setStops = useRouteStore((s) => s.setStops);
  const setMode = useRouteStore((s) => s.setMode);
  const preference = useRouteStore((s) => s.preference);
  const maxExtraMinutes = useRouteStore((s) => s.maxExtraMinutes);
  const setPreference = useRouteStore((s) => s.setPreference);
  const setMaxExtraMinutes = useRouteStore((s) => s.setMaxExtraMinutes);
  const [selectedMode, setSelectedMode] = useState<TravelMode>('transit');

  // 장소 시트의 '/route/input?d=lat,lng,이름' 같은 링크로 프리필.
  const initial = useMemo(() => {
    const u = parseRouteParams(params);
    return { origin: u.origin, destination: u.destination, mode: u.mode };
    // 최초 진입 값만 프리필(deps 의도적 비움)
  }, []);

  const onSubmit = useCallback(
    (req: RouteRequest, urlState: RouteUrlState) => {
      // 도보 선호는 도보 + 서버 지원일 때만 유효 — 그 외엔 이전에 고른 값이 새어 나가지 않게 비운다.
      const keepPrefs = showWalkPreferences(capabilities, req.mode);
      if (!keepPrefs) {
        setPreference(undefined);
        setMaxExtraMinutes(undefined);
      }
      setStops(req.stops);
      setMode(req.mode);
      // 새로고침·공유 링크에서도 복원되도록 입력(선호·예산 포함, 비운 뒤 값)을 URL에 싣는다.
      const prefs = keepPrefs ? { preference, maxExtraMinutes } : {};
      router.push(`/route/result${routeQuery({ ...urlState, ...prefs })}` as Href);
    },
    [router, setStops, setMode, setPreference, setMaxExtraMinutes, capabilities, preference, maxExtraMinutes],
  );

  const onCancel = useCallback(() => router.back(), [router]);

  const onPreferenceChange = useCallback(
    (pref: RoutePreference | undefined) => setPreference(pref),
    [setPreference],
  );

  const onMaxExtraMinutesChange = useCallback(
    (minutes: number | undefined) => setMaxExtraMinutes(minutes),
    [setMaxExtraMinutes],
  );

  return (
    <OverlayPanel>
      {showWalkPreferences(capabilities, selectedMode) && (
        <RouteOptionsBar
          preference={preference}
          maxExtraMinutes={maxExtraMinutes}
          onPreferenceChange={onPreferenceChange}
          onMaxExtraMinutesChange={onMaxExtraMinutesChange}
        />
      )}
      <RouteInputScreen
        provider={PlaceService}
        onSubmit={onSubmit}
        onCancel={onCancel}
        initial={initial}
        locate={locateUser}
        capabilities={capabilities}
        onModeChange={setSelectedMode}
      />
    </OverlayPanel>
  );
}
