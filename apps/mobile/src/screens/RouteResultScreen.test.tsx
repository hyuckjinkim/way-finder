/**
 * D4 — RouteResultScreen 렌더 테스트 (데모 모드).
 *
 * routeRender.test.tsx 패턴 그대로:
 * react-native → react-native-web alias + react-dom/server.renderToStaticMarkup으로
 * RN 컴포넌트 트리가 throw 없이 DOM 문자열을 렌더하는지 검증한다.
 *
 * renderToStaticMarkup은 useEffect를 실행하지 않으므로 fitBounds 호출은 이 테스트 범위 외.
 * boundsForRoute의 BBox 계산은 routeToPolylines.test.ts에서 별도로 단언한다.
 *
 * C3(P4): customMeta 표시 단언 — 선호 프로필 라벨 + 예산 내/초과 플래그.
 * customMeta 미존재(기존 P2 경로) 시 미표시 하위호환 단언 포함.
 */
import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import {
  WALK_SIMPLE,
  CAR_WAYPOINT,
  TRANSIT_CHAIN,
  INTERCITY_STITCH,
  BIKE_SIMPLE,
} from '@wayfinder/shared/mocks';
import { RouteResultScreen } from './RouteResultScreen.js';
import { ApiError } from '../services/apiClient.js';
import { TransitError } from '@wayfinder/shared/transit';

// OverlayPanel은 마운트 후에만 그린다(SSR 하이드레이션) — 정적 렌더 테스트에선 내용만 통과시킨다.
vi.mock('../components/OverlayPanel', async (orig) => ({
  ...(await orig<typeof import('../components/OverlayPanel')>()),
  OverlayPanel: ({ children }: { children: React.ReactNode }) => children,
}));

const render = (el: React.ReactElement): string => renderToStaticMarkup(el);

describe('RouteResultScreen — 렌더 (데모 모드)', () => {
  it('route=null: 로딩 상태 렌더 (throw 없음)', () => {
    const html = render(
      <RouteResultScreen route={null} onBack={() => {}} />,
    );
    expect(html.length).toBeGreaterThan(0);
    expect(html).toContain('탐색 중');
  });

  it('도보 단순 경로 렌더', () => {
    const html = render(
      <RouteResultScreen route={WALK_SIMPLE} onBack={() => {}} />,
    );
    expect(html.length).toBeGreaterThan(0);
    // 총 시간 포함 (900초 = 15분)
    expect(html).toContain('15분');
  });

  it('자동차 경유지 경로 렌더', () => {
    const html = render(
      <RouteResultScreen route={CAR_WAYPOINT} onBack={() => {}} />,
    );
    expect(html.length).toBeGreaterThan(0);
  });

  it('대중교통 leg-chaining 렌더 — 노선명 표시', () => {
    const html = render(
      <RouteResultScreen route={TRANSIT_CHAIN} onBack={() => {}} />,
    );
    expect(html.length).toBeGreaterThan(0);
    expect(html).toContain('4호선');
    expect(html).toContain('402번');
    expect(html).toContain('환승');
  });

  it('시외 3단 스티칭 렌더 — KTX 노선명 표시', () => {
    const html = render(
      <RouteResultScreen route={INTERCITY_STITCH} onBack={() => {}} />,
    );
    expect(html.length).toBeGreaterThan(0);
    expect(html).toContain('KTX');
  });

  it('자전거 경로 렌더', () => {
    const html = render(
      <RouteResultScreen route={BIKE_SIMPLE} onBack={() => {}} />,
    );
    expect(html.length).toBeGreaterThan(0);
  });

  it('onBack 미지정 시 화면 내 ← 버튼 없음 (스택 헤더와 중복 방지)', () => {
    const html = render(<RouteResultScreen route={WALK_SIMPLE} />);
    expect(html).not.toContain('←');
  });

  it('웹에서는 onStartNav가 있어도 "안내 시작" 미노출', () => {
    const html = render(<RouteResultScreen route={WALK_SIMPLE} onStartNav={() => {}} />);
    expect(html).not.toContain('안내 시작');
  });

  it('대안 경로 + 요금: 경로 카드 N개와 요금 표시', () => {
    const route = {
      ...TRANSIT_CHAIN,
      fare: 1650,
      alternatives: [{ ...TRANSIT_CHAIN, totalDurationSec: 3000, fare: 1850 }],
    };
    const html = render(<RouteResultScreen route={route} />);
    expect(html).toContain('1,650원');
    expect(html).toContain('1,850원');
    expect(html).toContain('경로 2,');
    expect(html).toContain('도착');
  });

  it('뒤로 가기 버튼 포함', () => {
    const html = render(
      <RouteResultScreen route={WALK_SIMPLE} onBack={() => {}} />,
    );
    expect(html).toContain('←');
  });
});

describe('RouteResultScreen — 요약 표시 정확성', () => {
  it('총 거리 표시 — km 또는 m 형식', () => {
    const html = render(
      <RouteResultScreen route={WALK_SIMPLE} onBack={() => {}} />,
    );
    // 1100m < 1000m 아니므로 km 표시
    expect(html).toMatch(/km|m/);
  });

  it('대중교통 환승 수 표시 — TRANSIT_CHAIN은 환승 1회', () => {
    const html = render(
      <RouteResultScreen route={TRANSIT_CHAIN} onBack={() => {}} />,
    );
    expect(html).toContain('환승 1회');
  });

  it('시외 스티칭 환승 2회 표시', () => {
    const html = render(
      <RouteResultScreen route={INTERCITY_STITCH} onBack={() => {}} />,
    );
    expect(html).toContain('환승 2회');
  });

  it('도보 경로 — 환승 표시 없음', () => {
    const html = render(
      <RouteResultScreen route={WALK_SIMPLE} onBack={() => {}} />,
    );
    expect(html).not.toContain('환승');
  });
});

// ─── C3(P4): customMeta 표시 ──────────────────────────────────────────────────

describe('RouteResultScreen — C3(P4) customMeta 프로필·예산 표시', () => {
  it('customMeta 없으면 예산 표시 미존재 (하위호환 — 기존 P2 경로)', () => {
    // WALK_SIMPLE은 customMeta 없음
    const html = render(
      <RouteResultScreen route={WALK_SIMPLE} onBack={() => {}} />,
    );
    expect(html).not.toContain('예산 내');
    expect(html).not.toContain('예산 초과');
  });

  it('withinBudget=true → "예산 내" 표시, 프로필 라벨 표시', () => {
    const route = {
      ...WALK_SIMPLE,
      customMeta: { preference: 'safe' as const, withinBudget: true },
    };
    const html = render(<RouteResultScreen route={route} onBack={() => {}} />);
    expect(html).toContain('예산 내');
    expect(html).toContain('안전');
    expect(html).not.toContain('예산 초과');
  });

  it('withinBudget=false → "예산 초과" 표시, 프로필 라벨 표시', () => {
    const route = {
      ...WALK_SIMPLE,
      customMeta: { preference: 'scenic' as const, withinBudget: false },
    };
    const html = render(<RouteResultScreen route={route} onBack={() => {}} />);
    expect(html).toContain('예산 초과');
    expect(html).toContain('풍경');
    expect(html).not.toContain('예산 내');
  });

  it('walkable 프로필 — "걷기좋은" 라벨 표시', () => {
    const route = {
      ...WALK_SIMPLE,
      customMeta: { preference: 'walkable' as const, withinBudget: true },
    };
    const html = render(<RouteResultScreen route={route} onBack={() => {}} />);
    expect(html).toContain('걷기좋은');
    expect(html).toContain('예산 내');
  });

  it('quiet 프로필 — "한적" 라벨 표시', () => {
    const route = {
      ...WALK_SIMPLE,
      customMeta: { preference: 'quiet' as const, withinBudget: true },
    };
    const html = render(<RouteResultScreen route={route} onBack={() => {}} />);
    expect(html).toContain('한적');
  });

  it('baselineDurationSec 있어도 렌더 정상 (선택 필드)', () => {
    const route = {
      ...WALK_SIMPLE,
      customMeta: {
        preference: 'safe' as const,
        withinBudget: true,
        baselineDurationSec: 800,
      },
    };
    const html = render(<RouteResultScreen route={route} onBack={() => {}} />);
    expect(html.length).toBeGreaterThan(0);
    expect(html).toContain('예산 내');
  });

  it('customMeta 있어도 기존 시간·거리 표시 불변', () => {
    const route = {
      ...WALK_SIMPLE,
      customMeta: { preference: 'safe' as const, withinBudget: true },
    };
    const html = render(<RouteResultScreen route={route} onBack={() => {}} />);
    // WALK_SIMPLE: 900초 = 15분
    expect(html).toContain('15분');
  });
});

describe('RouteResultScreen — 오류 상태 (회귀: 오류 시 "탐색 중" 영구 표시)', () => {
  it('501 MODE_UNAVAILABLE → 이동수단 미지원 안내, 로딩 문구 없음', () => {
    const html = render(
      <RouteResultScreen route={null} error={new ApiError(501, 'API error 501')} onBack={() => {}} />,
    );
    expect(html).toContain('이 이동수단은 아직 준비 중이에요');
    expect(html).not.toContain('탐색 중');
  });

  it('그 외 오류(502 등) → 일반 실패 안내', () => {
    const html = render(
      <RouteResultScreen route={null} error={new ApiError(502, 'API error 502')} onBack={() => {}} />,
    );
    expect(html).toContain('경로를 찾지 못했어요');
    expect(html).not.toContain('준비 중이에요');
  });

  const O = { label: '구디역', coord: { lat: 37.485, lng: 126.901 } };
  const D = { label: '강남역', coord: { lat: 37.498, lng: 127.028 } };

  it('quota → 쉬는 중 안내 + 카카오맵 링크 버튼', () => {
    const html = render(<RouteResultScreen route={null} error={new TransitError('quota')} origin={O} destination={D} mode="transit" />);
    expect(html).toContain('오늘 길찾기 이용량이 많아 잠시 쉬고 있어요');
    expect(html).toContain('카카오맵에서 보기');
    expect(html).not.toContain('다시 시도');
  });

  it('too_close → 도보 안내 질문 + 도보 전환 버튼', () => {
    const html = render(<RouteResultScreen route={null} error={new TransitError('too_close')} onSwitchToWalk={() => {}} />);
    expect(html).toContain('가까운 거리예요. 도보로 안내할까요?');
    expect(html).toContain('도보로 보기');
  });

  it('no_route → 대중교통 경로 없음, 재시도 버튼 없음', () => {
    const html = render(<RouteResultScreen route={null} error={new TransitError('no_route')} onRetry={() => {}} />);
    expect(html).toContain('이 구간은 대중교통 경로가 없어요');
    expect(html).not.toContain('다시 시도');
  });

  it('upstream → 일반 안내 + 다시 시도 버튼', () => {
    const html = render(<RouteResultScreen route={null} error={new TransitError('upstream')} onRetry={() => {}} />);
    expect(html).toContain('경로를 찾지 못했어요');
    expect(html).toContain('다시 시도');
  });
});

describe('RouteResultScreen — 카드 접근성 라벨', () => {
  it('소요·도착·요금·환승 포함', () => {
    const html = render(<RouteResultScreen route={{ ...TRANSIT_CHAIN, fare: 1650 }} />);
    expect(html).toMatch(/aria-label="경로 1, [^"]*분, \d\d:\d\d 도착, 요금 1,650원, 환승 1회"/);
  });
});

describe('RouteResultScreen — B1 결과 화면 정리', () => {
  const A = { lat: 37.485, lng: 126.901 };
  const B = { lat: 37.498, lng: 127.028 };

  it('뒤로 가기는 한국어 라벨만(영어 "back" 없음)', () => {
    const html = render(<RouteResultScreen route={WALK_SIMPLE} onBack={() => {}} />);
    expect(html).toContain('aria-label="뒤로 가기"');
    expect(html).not.toMatch(/aria-label="[^"]*back/i);
  });

  it('출발=도착이면 결과 대신 안내 문구(경로 카드 없음)', () => {
    const html = render(<RouteResultScreen route={WALK_SIMPLE} stops={[A, { lat: A.lat + 0.0001, lng: A.lng }]} />);
    expect(html).toContain('출발지와 도착지가 같아요');
    expect(html).not.toContain('경로 1,');
  });

  it('경유지가 있는 왕복(A→W→A)은 정상 결과', () => {
    const html = render(<RouteResultScreen route={WALK_SIMPLE} stops={[A, B, A]} />);
    expect(html).not.toContain('출발지와 도착지가 같아요');
    expect(html).toContain('경로 1,');
  });

  it('3시간 넘는 도보는 대중교통 권유 문구', () => {
    const long = { ...WALK_SIMPLE, totalDurationSec: 97 * 3600, legs: WALK_SIMPLE.legs.map((l) => ({ ...l, durationSec: 97 * 3600 })) };
    expect(render(<RouteResultScreen route={long} />)).toContain('대중교통을 이용해 보세요');
    expect(render(<RouteResultScreen route={WALK_SIMPLE} />)).not.toContain('대중교통을 이용해 보세요');
  });

  it('quota + URL 이름 없음 → stops 좌표로 카카오맵 링크 폴백', () => {
    const html = render(<RouteResultScreen route={null} error={new TransitError('quota')} stops={[A, B]} mode="transit" />);
    expect(html).toContain('카카오맵에서 보기');
  });
});
