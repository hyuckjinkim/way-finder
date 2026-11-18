/**
 * expo-router 루트 HTML (웹 static export 전용 — Node에서 SSG 시점에 렌더).
 *
 * 기본 템플릿(meta·ScrollViewStyleReset) 유지 + 성능/PWA 헤드:
 * - Kakao SDK를 번들 실행 전에 async로 선로드(loadKakaoSdk가 이 태그를 재사용) → 직렬 체인 단축.
 * - 지도 타일·프록시·ODsay 오리진 preconnect/dns-prefetch.
 * - manifest·theme-color·apple-touch-icon (service worker 없음).
 * env는 EXPO_PUBLIC_* 맨 점 표기만 (apiClient.test.ts 가드).
 */
import type { PropsWithChildren } from 'react';
import { ScrollViewStyleReset } from 'expo-router/html';
import { KAKAO_SDK_TAG_ID, kakaoSdkUrl } from '../src/map/loadKakaoSdk';

const kakaoJsKey = process.env.EXPO_PUBLIC_KAKAO_JS_KEY ?? '';
const proxyBaseUrl = process.env.EXPO_PUBLIC_PROXY_BASE_URL ?? '';

function originOf(url: string): string | null {
  try {
    return new URL(url).origin;
  } catch {
    return null; // 미설정/비정상 → preconnect 생략
  }
}

const proxyOrigin = originOf(proxyBaseUrl);

export default function Root({ children }: PropsWithChildren) {
  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta httpEquiv="X-UA-Compatible" content="IE=edge" />
        <meta name="viewport" content="width=device-width, initial-scale=1, shrink-to-fit=no" />
        <meta name="theme-color" content="#1a73e8" />
        <link rel="manifest" href="/manifest.webmanifest" />
        <link rel="apple-touch-icon" href="/icons/apple-touch-icon.png" />
        <link rel="preconnect" href="https://dapi.kakao.com" crossOrigin="anonymous" />
        <link rel="preconnect" href="https://t1.kakaocdn.net" />
        {proxyOrigin ? <link rel="preconnect" href={proxyOrigin} crossOrigin="anonymous" /> : null}
        <link rel="dns-prefetch" href="https://mts.kakaocdn.net" />
        <link rel="dns-prefetch" href="https://t1.daumcdn.net" />
        <link rel="dns-prefetch" href="https://map.daumcdn.net" />
        <link rel="dns-prefetch" href="https://api.odsay.com" />
        {kakaoJsKey ? <script id={KAKAO_SDK_TAG_ID} src={kakaoSdkUrl(kakaoJsKey)} async /> : null}
        <ScrollViewStyleReset />
      </head>
      <body>{children}</body>
    </html>
  );
}
