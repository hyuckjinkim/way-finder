import { describe, it, expect } from 'vitest';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { SEOUL_CAFE, PLACE_DETAILS } from '@wayfinder/shared/mocks';
import { PlaceDetailSheet } from './PlaceDetailSheet.js';
import { PlaceSheetStatus } from './PlaceSheetStatus.js';
import { HomeScreen } from './HomeScreen.js';
import { OverlayPanel } from '../components/OverlayPanel.js';

const render = (el: React.ReactElement): string => renderToStaticMarkup(el);
const detail = { ...PLACE_DETAILS[SEOUL_CAFE.id]!, phone: '02-123-4567' };

describe('PlaceDetailSheet 액션', () => {
  const html = render(<PlaceDetailSheet detail={detail} onClose={() => {}} onSetOrigin={() => {}} onSetDestination={() => {}} />);

  it('출발·도착 버튼과 닫기를 하나씩 렌더한다', () => {
    expect(html).toContain('aria-label="출발지로 설정"');
    expect(html).toContain('aria-label="도착지로 설정"');
    expect(html.match(/aria-label="닫기"/g)).toHaveLength(1);
  });
  it('전화번호는 탭해서 거는 링크', () => {
    expect(html).toContain('aria-label="전화 걸기 02-123-4567"');
  });
});

describe('PlaceSheetStatus', () => {
  it('오류면 다시 시도·닫기를 낸다', () => {
    const html = render(<PlaceSheetStatus name="강남역" state="error" />);
    expect(html).toContain('강남역');
    expect(html).toContain('aria-label="다시 시도"');
    expect(html).toContain('aria-label="닫기"');
  });
  it('없는 장소(404)면 해요체 안내와 닫기만 — 다시 시도 없음', () => {
    const html = render(<PlaceSheetStatus state="notFound" />);
    expect(html).toContain('찾을 수 없어요');
    expect(html).not.toContain('다시 시도');
    expect(html).toContain('aria-label="닫기"');
  });
  it('로딩 중이면 다시 시도 없이 닫기만', () => {
    const html = render(<PlaceSheetStatus name="강남역" state="loading" />);
    expect(html).not.toContain('다시 시도');
    expect(html).toContain('불러오는 중');
  });
});

describe('HomeScreen', () => {
  it('위치 안내 토스트를 닫기 버튼과 함께 렌더한다', () => {
    const html = render(<HomeScreen notice="위치 권한을 허용하면 내 주변부터 보여드려요" onDismissNotice={() => {}} />);
    expect(html).toContain('위치 권한을 허용하면 내 주변부터 보여드려요');
    expect(html).toContain('aria-label="알림 닫기"');
  });
  it('패널이 없으면 검색바, 전체 패널이면 숨김(SSR은 폰 폭)', () => {
    expect(render(<HomeScreen />)).toContain('aria-label="장소 검색"');
    expect(render(<HomeScreen panel="full" />)).not.toContain('aria-label="장소 검색"');
  });
});

describe('OverlayPanel', () => {
  // SSR은 창 높이를 몰라 height:0 시트를 굽고 하이드레이션이 그 스타일을 안 고친다(fac444b) —
  // 정적 HTML엔 시트를 넣지 않고 마운트 후에만 그린다.
  it('SSR에선 시트를 굽지 않는다(마운트 후 렌더)', () => {
    const html = render(
      <OverlayPanel>
        <span>본문</span>
      </OverlayPanel>,
    );
    expect(html).not.toContain('본문');
    expect(html).not.toContain('aria-label="시트 높이 조절"');
  });
});
