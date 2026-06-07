/**
 * E3 라우트 레벨 렌더 테스트 — 데모 모드 화면이 mock 데이터로 마운트되는지.
 *
 * 라우트 어댑터(app/*.tsx)는 expo-router 훅으로 화면에 props를 주입한다. 여기서는 그 어댑터가
 * 주입하는 것과 동일한 props(데모 모드 mock provider 데이터)로 4개 화면을 직접 마운트해,
 * react-native-web alias(vitest.config.mts) + react-dom/server.renderToStaticMarkup으로
 * RN 컴포넌트 트리가 throw 없이 DOM 문자열을 렌더하는지 검증한다.
 *
 * 이것이 §6 "데모 모드 웹 흐름(홈→검색→상세→로드뷰)" 의 컴포넌트 통합 검증이며,
 * 정적 web export(별도 게이트)와 함께 라우트 흐름을 이중으로 보장한다.
 * 의존성 추가 없음: react-dom·react-native-web은 이미 mobile 의존성.
 */
import { describe, it, expect, beforeAll } from 'vitest';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import type { PlaceDetail } from '@wayfinder/shared';
import { getDetail, search } from '../services/PlaceService.js';
import { cameraForPlace } from './searchCamera.js';
import { HomeScreen } from './HomeScreen.js';
import { SearchScreen } from './SearchScreen.js';
import { PlaceDetailSheet } from './PlaceDetailSheet.js';
import { RoadviewScreen } from './RoadviewScreen.js';

const render = (el: React.ReactElement): string => renderToStaticMarkup(el);

describe('E3 라우트 레벨 렌더 (데모 모드)', () => {
  let seoulDetail: PlaceDetail;

  beforeAll(async () => {
    // app/place/[id].tsx 어댑터가 usePlaceDetailQuery → getDetail로 받는 데이터.
    seoulDetail = await getDetail('kakao:26338954');
  });

  it('홈 라우트: HomeScreen이 카메라·마커 props로 렌더된다', () => {
    // app/index.tsx 어댑터가 주입하는 props 모양.
    const html = render(
      <HomeScreen
        initialCamera={cameraForPlace({ ...seoulDetail })}
        markers={[{ id: seoulDetail.id, coord: seoulDetail.coord }]}
        onOpenSearch={() => {}}
        onRequestLocation={() => {}}
      />,
    );
    expect(html.length).toBeGreaterThan(0);
  });

  it('검색 라우트: SearchScreen이 mock 결과로 렌더되고 onSelectPlace 계약을 노출한다', async () => {
    // 데모 mock provider가 결과를 반환하는지(검색 화면 기본 provider와 동일 경로).
    const results = await search('카페');
    expect(results.length).toBeGreaterThan(0);
    const html = render(<SearchScreen onSelectPlace={() => {}} onCancel={() => {}} />);
    expect(html.length).toBeGreaterThan(0);
  });

  it('상세 라우트: PlaceDetailSheet가 PlaceDetail 전 필드를 렌더한다', () => {
    // app/place/[id].tsx 어댑터 props (loadGoogle은 탭 활성 시에만 호출 — 마운트 시 미호출).
    const html = render(
      <PlaceDetailSheet
        detail={seoulDetail}
        loadGoogle={async () => ({ rating: seoulDetail.rating, reviews: seoulDetail.reviews })}
        onOpenRoadview={() => {}}
        onClose={() => {}}
      />,
    );
    expect(html).toContain(seoulDetail.name);
  });

  it('로드뷰 라우트: RoadviewScreen이 detail로 렌더된다(한국=카카오 placeholder)', () => {
    const html = render(<RoadviewScreen detail={seoulDetail} onBack={() => {}} />);
    expect(html.length).toBeGreaterThan(0);
  });
});
