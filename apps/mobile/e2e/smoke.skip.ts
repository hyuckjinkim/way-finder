/**
 * 모바일 앱 스모크 테스트 (E4).
 *
 * 실 API 키가 필요한 테스트. env 미설정 시 자동 skip — CI를 깨지 않는다.
 * 실행하려면: EXPO_PUBLIC_PROXY_BASE_URL=<url> pnpm --filter @wayfinder/mobile test:smoke
 *
 * 이 파일은 일반 vitest include 패턴(src/**)에서 제외되어 기본 `pnpm test`에 포함되지 않는다.
 */
import { describe, it, expect } from 'vitest';

const proxyBaseUrl = process.env.EXPO_PUBLIC_PROXY_BASE_URL ?? '';
const hasRealProxy = proxyBaseUrl.length > 0;

describe.skipIf(!hasRealProxy)('smoke: mobile → proxy 연결', () => {
  it('프록시 헬스체크 응답', async () => {
    const res = await fetch(`${proxyBaseUrl}/health`);
    expect(res.ok).toBe(true);
  });

  it('장소 검색 — 실 API 응답', async () => {
    const res = await fetch(
      `${proxyBaseUrl}/v1/places/search?q=${encodeURIComponent('카페')}`,
    );
    expect(res.ok).toBe(true);
    const json = await res.json() as unknown;
    expect(json).toBeDefined();
  });

  it('장소 상세 — 실 API 응답', async () => {
    const res = await fetch(
      `${proxyBaseUrl}/v1/places/${encodeURIComponent('kakao:26338954')}`,
    );
    // 실 키 없이도 데모 모드면 200, 실 키 있으면 실 데이터.
    expect([200, 404]).toContain(res.status);
  });
});
