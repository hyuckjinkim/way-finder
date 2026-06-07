/**
 * 프록시 스모크 테스트 (E4).
 *
 * 실 API 키(Kakao / Google / Naver)가 필요한 테스트. env 미설정 시 자동 skip.
 * 단위/통합 테스트(src/**‌/*.test.ts)와 분리되어 기본 CI를 깨지 않는다.
 *
 * 실행: KAKAO_LOCAL_API_KEY=<key> GOOGLE_PLACES_API_KEY=<key> pnpm --filter @wayfinder/proxy test:smoke
 */
import { describe, it, expect } from 'vitest';

const kakaoKey = process.env.KAKAO_LOCAL_API_KEY ?? '';
const googleKey = process.env.GOOGLE_PLACES_API_KEY ?? '';
const naverClientId = process.env.NAVER_CLIENT_ID ?? '';

const hasKakao = kakaoKey.length > 0;
const hasGoogle = googleKey.length > 0;
const hasNaver = naverClientId.length > 0;

describe.skipIf(!hasKakao)('smoke: Kakao Local API', () => {
  it('카카오 장소 검색 — 실 API 응답', async () => {
    const url = 'https://dapi.kakao.com/v2/local/search/keyword.json?query=카페&size=1';
    const res = await fetch(url, {
      headers: { Authorization: `KakaoAK ${kakaoKey}` },
    });
    expect(res.ok).toBe(true);
    const json = await res.json() as { documents: unknown[] };
    expect(Array.isArray(json.documents)).toBe(true);
  });
});

describe.skipIf(!hasGoogle)('smoke: Google Places API', () => {
  it('구글 장소 검색 — 실 API 응답', async () => {
    const url = `https://maps.googleapis.com/maps/api/place/textsearch/json?query=cafe+seoul&key=${googleKey}&language=ko`;
    const res = await fetch(url);
    expect(res.ok).toBe(true);
    const json = await res.json() as { status: string };
    // OK 또는 ZERO_RESULTS — 둘 다 정상 응답.
    expect(['OK', 'ZERO_RESULTS']).toContain(json.status);
  });
});

describe.skipIf(!hasNaver)('smoke: Naver Blog Search API', () => {
  it('네이버 블로그 검색 — 실 API 응답', async () => {
    const naverSecret = process.env.NAVER_CLIENT_SECRET ?? '';
    const url = 'https://openapi.naver.com/v1/search/blog.json?query=카페&display=1';
    const res = await fetch(url, {
      headers: {
        'X-Naver-Client-Id': naverClientId,
        'X-Naver-Client-Secret': naverSecret,
      },
    });
    expect(res.ok).toBe(true);
    const json = await res.json() as { items: unknown[] };
    expect(Array.isArray(json.items)).toBe(true);
  });
});
