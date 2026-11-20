/**
 * 경로 결과 라우트 — /route/result (E2 + P4 D1).
 *
 * 입력은 URL(?o&d&w&mode&pref&max)이 우선이라 새로고침·공유 링크에서도 복원된다. URL이 없으면
 * D2 routeStore로 폴백하고, 둘 다 없으면 입력 화면으로 돌아가는 안내를 보인다.
 * URL에서 해석한 입력은 스토어에 다시 써서 공유 링크로 들어와도 /route/nav 재탐색이 같은 입력을 쓴다.
 * 선택된 경로는 routeStore.result에 동기화해 /route/nav(안내 시작)가 읽게 한다.
 * QueryClientProvider는 app/_layout.tsx가 제공한다.
 */
import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { useLocalSearchParams, useNavigation, useRouter, type Href } from 'expo-router';
import { RouteResultScreen } from '../../src/screens/RouteResultScreen';
import { useRouteStore } from '../../src/state/routeStore';
import { useRouteQuery } from '../../src/state/routeQueries';
import { parseRouteParams, routeQuery } from '../../src/route/routeUrl';
import { resolveRouteInput } from '../../src/route/routeInput';
import { isSameStop } from '../../src/route/routeResultView';

const NO_STOPS: never[] = [];

export default function RouteResultRoute() {
  const router = useRouter();
  const navigation = useNavigation();
  const params = useLocalSearchParams<{ o?: string; d?: string; w?: string; mode?: string; pref?: string; max?: string }>();
  const storeStops = useRouteStore((s) => s.stops);
  const storeMode = useRouteStore((s) => s.mode);
  const storePreference = useRouteStore((s) => s.preference);
  const storeMaxExtraMinutes = useRouteStore((s) => s.maxExtraMinutes);
  const setResult = useRouteStore((s) => s.setResult);

  // stops 배열 정체성이 매 렌더 바뀌면 useRouteQuery의 디바운스가 무한 재설정되므로 파라미터 값으로 메모.
  const { o, d, w, mode: modeParam, pref, max } = params;
  const urlState = React.useMemo(
    () => parseRouteParams({ o, d, w, mode: modeParam, pref, max }),
    [o, d, w, modeParam, pref, max],
  );
  const hasUrlStops = !!urlState.origin && !!urlState.destination;
  // URL에 o·d가 있으면 스토어 stops·pref·max를 보지 않는다 — 아래 스토어 쓰기가 다시 input을 바꿔
  // useRouteQuery 디바운스를 재설정하지 않게.
  const fbStops = hasUrlStops ? NO_STOPS : storeStops;
  const fbPreference = hasUrlStops ? undefined : storePreference;
  const fbMaxExtraMinutes = hasUrlStops ? undefined : storeMaxExtraMinutes;
  const input = React.useMemo(
    () =>
      resolveRouteInput(urlState, {
        stops: fbStops,
        mode: storeMode,
        preference: fbPreference,
        maxExtraMinutes: fbMaxExtraMinutes,
      }),
    [urlState, fbStops, storeMode, fbPreference, fbMaxExtraMinutes],
  );

  // 공유 링크·새로고침 진입도 재탐색(/route/nav)이 같은 입력을 쓰도록 URL 해석 결과를 스토어에 쓴다.
  React.useEffect(() => {
    if (!hasUrlStops || !input) return;
    const st = useRouteStore.getState();
    const key = (p: { lat: number; lng: number }[]) => p.map((c) => `${c.lat},${c.lng}`).join('|');
    if (key(st.stops) !== key(input.stops)) st.setStops(input.stops);
    if (st.mode !== input.mode) st.setMode(input.mode);
    if (st.preference !== input.preference) st.setPreference(input.preference);
    if (st.maxExtraMinutes !== input.maxExtraMinutes) st.setMaxExtraMinutes(input.maxExtraMinutes);
  }, [hasUrlStops, input]);

  // 경유지 없이 출발=도착이면 탐색하지 않는다(쿼터 낭비·"경로 없음" 대신 화면이 안내).
  const stops = input?.stops ?? NO_STOPS;
  const sameStops = stops.length === 2 && isSameStop(stops[0]!, stops[1]!); // 왕복(A→W→A)은 탐색
  const { data, error, refetch } = useRouteQuery(
    sameStops ? NO_STOPS : stops,
    input?.mode ?? storeMode,
    input?.preference,
    input?.maxExtraMinutes,
  );

  const onStartNav = React.useCallback(() => router.push('/route/nav'), [router]);
  // 경로 입력에서 왔으면 뒤로(입력 상태 유지), 공유 링크·새로고침 진입(아래가 홈)이면 입력값을 채운 경로 입력으로.
  const onBack = React.useCallback(() => {
    const routes = navigation.getState()?.routes ?? [];
    if (routes[routes.length - 2]?.name === 'route/input') router.back();
    else router.replace(`/route/input${routeQuery(urlState)}` as Href);
  }, [navigation, router, urlState]);
  const onRetry = React.useCallback(() => void refetch(), [refetch]);
  // URL mode가 스토어보다 우선이라 URL을 바꾼다(스토어 폴백 진입이어도 url.mode가 이긴다).
  const onSwitchToWalk = React.useCallback(() => router.setParams({ mode: 'walk' }), [router]);

  if (!input) {
    return (
      <View style={styles.missing}>
        <Text style={styles.missingText}>경로 정보가 없어요. 출발지와 도착지를 다시 입력해 주세요.</Text>
        <Pressable
          style={styles.missingBtn}
          onPress={() => router.replace('/route/input')}
          accessibilityRole="button"
          accessibilityLabel="경로 입력으로 가기"
        >
          <Text style={styles.missingBtnText}>경로 입력으로 가기</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <RouteResultScreen
      route={data ?? null}
      onBack={onBack}
      stops={input.stops}
      error={error}
      onStartNav={onStartNav}
      onSelectedRouteChange={setResult}
      onRetry={onRetry}
      onSwitchToWalk={onSwitchToWalk}
      origin={urlState.origin}
      destination={urlState.destination}
      mode={input.mode}
    />
  );
}

const styles = StyleSheet.create({
  missing: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, gap: 16, backgroundColor: '#fff' },
  missingText: { fontSize: 15, color: '#333', textAlign: 'center' },
  missingBtn: {
    minHeight: 48,
    paddingHorizontal: 24,
    borderRadius: 10,
    backgroundColor: '#1565c0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  missingBtnText: { color: '#fff', fontSize: 15, fontWeight: '700' },
});
