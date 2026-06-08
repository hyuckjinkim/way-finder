/**
 * D2 — 데모 모드 커스텀 경로(프로필 + N분) 흐름 데이터 계약 테스트.
 *
 * routeFlowE2.test.ts 패턴 확장: 라우트 어댑터(app/route/*.tsx)가 의존하는 데모 모드
 * 커스텀 경로 데이터 계약을 라우트 레벨 흐름으로 검증한다. 키 0개 데모 모드에서
 *
 *   경로입력(stops) → 옵션(4프로필 탭 + N분 스테퍼) → RouteService.getRoute(데모)
 *     → mockRouteProvider 합성 customMeta(F2) → routeSummary가 프로필·예산 플래그 노출
 *
 * 가 목 데이터로 동작함을 단언한다. **풍경(scenic)은 ENABLE_SCENIC=false로 탭 미노출**.
 * 합성 플래그라 실 Valhalla 컨테이너 불요(게이트 B와 분리) — D2 = 데모 웹 게이트.
 */
import { describe, it, expect } from 'vitest';
import type { LatLng } from '@wayfinder/shared';
import {
  PREFERENCE_TAB_ORDER,
  tabToPreference,
  ENABLE_SCENIC,
} from '../route/routePreference.js';
import {
  clampExtraMinutes,
  toRouteExtraMinutes,
  DEFAULT_EXTRA_MINUTES,
} from '../route/extraMinutes.js';
import { toStops, type WaypointEntry } from '../route/waypoints.js';
import { getRoute } from '../services/RouteService.js';
import { routeSummary } from '../route/routeSummary.js';

// 서울 시내 좌표.
const ORIGIN: LatLng = { lat: 37.5563, lng: 126.9723 };
const DEST: LatLng = { lat: 37.5665, lng: 126.978 };
const NO_WP: WaypointEntry[] = [];

describe('D2 옵션 — 프로필 탭 4종(풍경 미노출) + N분 스테퍼', () => {
  it('ENABLE_SCENIC=false 상태에서 탭 순서는 빠른/걷기좋은/안전/한적 4종이며 풍경 미포함', () => {
    expect(ENABLE_SCENIC).toBe(false);
    expect([...PREFERENCE_TAB_ORDER]).toEqual([
      'fastest',
      'walkable',
      'safe',
      'quiet',
    ]);
    expect(PREFERENCE_TAB_ORDER).not.toContain('scenic');
  });

  it('N분 스테퍼: 기본값·클램프·전달 변환이 일관된다', () => {
    expect(clampExtraMinutes(DEFAULT_EXTRA_MINUTES)).toBe(DEFAULT_EXTRA_MINUTES);
    // 0(MIN)은 무제한 → undefined로 전달.
    expect(toRouteExtraMinutes(0)).toBeUndefined();
    // 비-0은 클램프된 값 그대로 전달.
    expect(toRouteExtraMinutes(10)).toBe(10);
    expect(toRouteExtraMinutes(999)).toBe(30); // MAX 클램프.
  });
});

describe('D2 데모 흐름 — 프로필 선택 → getRoute(데모) → customMeta 예산 플래그', () => {
  it('비-fastest 프로필은 mockRouteProvider 합성 customMeta(프로필·예산)를 산출한다', async () => {
    const stops = toStops(ORIGIN, NO_WP, DEST);
    // 풍경 제외 4탭 중 비-fastest 프로필만 검증(fastest는 하위호환 — 메타 없음).
    for (const tab of PREFERENCE_TAB_ORDER) {
      const preference = tabToPreference(tab);
      const route = await getRoute({
        stops,
        mode: 'walk',
        preference,
        maxExtraMinutes: toRouteExtraMinutes(DEFAULT_EXTRA_MINUTES),
      });
      const summary = routeSummary(route);
      if (preference === 'fastest') {
        // 하위호환: fastest는 customMeta 미존재 → 플래그 미표시.
        expect(summary.customMeta).toBeUndefined();
      } else {
        // 커스텀 프로필: 합성 메타가 프로필·예산 플래그를 노출.
        expect(summary.customMeta).toBeDefined();
        expect(summary.customMeta!.preference).toBe(preference);
        expect(typeof summary.customMeta!.withinBudget).toBe('boolean');
      }
    }
  });

  it('작은 N(타이트 예산)이면 안전 프로필이 예산 초과로 표시된다(플래그 실제 행사)', async () => {
    const stops = toStops(ORIGIN, NO_WP, DEST);
    // safe 합성 추가 = 8분. N=3분(타이트) → 예산 초과(withinBudget=false).
    const route = await getRoute({
      stops,
      mode: 'walk',
      preference: 'safe',
      maxExtraMinutes: 3,
    });
    const summary = routeSummary(route);
    expect(summary.customMeta!.preference).toBe('safe');
    expect(summary.customMeta!.withinBudget).toBe(false);
  });

  it('넉넉한 N(무제한)이면 동일 프로필이 예산 내로 표시된다', async () => {
    const stops = toStops(ORIGIN, NO_WP, DEST);
    // N 미지정(무제한) → withinBudget=true.
    const route = await getRoute({
      stops,
      mode: 'walk',
      preference: 'safe',
    });
    const summary = routeSummary(route);
    expect(summary.customMeta!.withinBudget).toBe(true);
  });
});
