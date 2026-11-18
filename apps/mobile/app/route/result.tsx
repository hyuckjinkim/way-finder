/**
 * 경로 결과 라우트 — /route/result (E2 + P4 D1).
 *
 * 입력은 URL(?o&d&w&mode)이 우선이라 새로고침·공유 링크에서도 복원된다. URL이 없으면
 * D2 routeStore(stops·mode)로 폴백하고, 둘 다 없으면 입력 화면으로 돌아가는 안내를 보인다.
 * preference·maxExtraMinutes는 URL에 싣지 않으므로 스토어 값을 쓴다.
 * 선택된 경로는 routeStore.result에 동기화해 /route/nav(안내 시작)가 읽게 한다.
 * QueryClientProvider는 app/_layout.tsx가 제공한다.
 */
import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { RouteResultScreen } from '../../src/screens/RouteResultScreen';
import { useRouteStore } from '../../src/state/routeStore';
import { useRouteQuery } from '../../src/state/routeQueries';
import { parseRouteParams } from '../../src/route/routeUrl';
import { resolveRouteInput } from '../../src/route/routeInput';

const NO_STOPS: never[] = [];

export default function RouteResultRoute() {
  const router = useRouter();
  const params = useLocalSearchParams<{ o?: string; d?: string; w?: string; mode?: string }>();
  const storeStops = useRouteStore((s) => s.stops);
  const storeMode = useRouteStore((s) => s.mode);
  const preference = useRouteStore((s) => s.preference);
  const maxExtraMinutes = useRouteStore((s) => s.maxExtraMinutes);
  const setResult = useRouteStore((s) => s.setResult);

  // stops 배열 정체성이 매 렌더 바뀌면 useRouteQuery의 디바운스가 무한 재설정되므로 파라미터 값으로 메모.
  const { o, d, w, mode: modeParam } = params;
  const input = React.useMemo(
    () => resolveRouteInput(parseRouteParams({ o, d, w, mode: modeParam }), { stops: storeStops, mode: storeMode }),
    [o, d, w, modeParam, storeStops, storeMode],
  );

  const { data, error } = useRouteQuery(
    input?.stops ?? NO_STOPS,
    input?.mode ?? storeMode,
    preference,
    maxExtraMinutes,
  );

  const onStartNav = React.useCallback(() => router.push('/route/nav'), [router]);

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

  // 스택 헤더가 뒤로 가기를 제공하므로 화면 내 ← 버튼(onBack)은 두지 않는다.
  return (
    <RouteResultScreen
      route={data ?? null}
      error={error}
      onStartNav={onStartNav}
      onSelectedRouteChange={setResult}
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
