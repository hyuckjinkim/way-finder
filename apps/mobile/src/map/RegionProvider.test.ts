/**
 * RegionProvider 렌더러 선택 로직 단위 테스트 (B1).
 *
 * 순수 함수 `nextRenderer`(shared의 `selectRenderer` 위임)를 검증한다.
 * 히스테리시스·줌<6 강제·전환 시 직전 렌더러 이어받기를 다룬다.
 *
 * 실행: mobile 패키지엔 test 러너가 없으므로(의존성 추가 금지) 루트 vitest 바이너리로
 *   `node_modules/.bin/vitest run apps/mobile/src/map` 직접 지정해 실행한다.
 */
import { describe, it, expect } from 'vitest';
import { nextRenderer } from './RegionProvider.js';
import type { CameraState } from '@wayfinder/shared';

const cam = (lat: number, lng: number, zoom: number): CameraState => ({
  center: { lat, lng },
  zoom,
});

const SEOUL = cam(37.5665, 126.978, 12);
const TOKYO = cam(35.6762, 139.6503, 12);

describe('nextRenderer — 기본 판정', () => {
  it('서울은 한국', () => {
    expect(nextRenderer(SEOUL)).toBe('korea');
  });

  it('도쿄는 글로벌', () => {
    expect(nextRenderer(TOKYO)).toBe('global');
  });
});

describe('nextRenderer — 저줌 강제 글로벌', () => {
  it('줌 < 6이면 서울이라도 글로벌', () => {
    expect(nextRenderer(cam(37.5665, 126.978, 5), 'korea')).toBe('global');
  });
});

describe('nextRenderer — 히스테리시스(직전 렌더러 이어받기)', () => {
  // 완충지대(코어 밖 +0.25°) 동일 좌표가 직전 상태에 따라 다르게 판정된다.
  const buffered = cam(38.95, 128.0, 12); // maxLat(38.7) + 0.25°

  it('한국 상태면 완충지대 내부에서 한국 유지', () => {
    expect(nextRenderer(buffered, 'korea')).toBe('korea');
  });

  it('글로벌 상태면 같은 완충지대 좌표에서 글로벌 유지(코어 미진입)', () => {
    expect(nextRenderer(buffered, 'global')).toBe('global');
  });
});

describe('B4 디스패처 — 서울↔도쿄 카메라 변경 시 렌더러 전환', () => {
  it('서울 → 도쿄 → 서울 순차 전환을 렌더러 선택이 추종', () => {
    // 디스패처는 직전 렌더러를 이어받으며 nextRenderer를 호출한다.
    let current = nextRenderer(SEOUL); // 초기: 한국
    expect(current).toBe('korea');

    current = nextRenderer(TOKYO, current); // 도쿄로 이동 → 글로벌
    expect(current).toBe('global');

    current = nextRenderer(SEOUL, current); // 다시 서울 → 한국
    expect(current).toBe('korea');
  });
});
