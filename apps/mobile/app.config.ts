/**
 * Expo 앱 설정 (Foundation F4 스캐폴드).
 *
 * 키는 env에서 주입한다. 미설정 시 데모 모드(mock provider)로 동작 — 키 0개로 빌드·웹 export 통과.
 * 카카오 네이티브 config plugin 슬롯을 예약해 둔다(스트림 B가 실제 플러그인 배선).
 *
 * 주의: 이 파일에 키 리터럴을 절대 넣지 말 것. process.env 경유만 허용.
 */
import type { ExpoConfig } from 'expo/config';

const kakaoNativeAppKey = process.env.EXPO_PUBLIC_KAKAO_NATIVE_APP_KEY ?? '';
const kakaoJsKey = process.env.EXPO_PUBLIC_KAKAO_JS_KEY ?? '';
const proxyBaseUrl = process.env.EXPO_PUBLIC_PROXY_BASE_URL ?? '';

// 프록시 URL 또는 카카오 키가 없으면 데모 모드.
const demoMode = proxyBaseUrl.length === 0;

const config: ExpoConfig = {
  name: 'wayfinder',
  slug: 'wayfinder',
  version: '0.1.0',
  orientation: 'portrait',
  platforms: ['ios', 'android', 'web'],
  web: {
    bundler: 'metro',
    // 'single'(SPA) = classic registerRootComponent 엔트리(E1)와 정합 — index.html을 생성한다.
    // 'static'(SSG)은 expo-router 라우트를 전제하므로 라우트 없는 E1에서는 빈 .routes.json만 내고
    // index.html을 만들지 않아 웹 산출물이 로드 불가가 된다. E2가 실 라우트 도입 시 'static'으로 전환 가능.
    output: 'single',
  },
  extra: {
    proxyBaseUrl,
    demoMode,
    kakaoJsKey,
  },
  // 카카오 네이티브 config plugin 슬롯 — 스트림 B(B2)가 실제 플러그인으로 채운다.
  // 예: ['@react-native-kakao/core', { nativeAppKey: kakaoNativeAppKey }]
  plugins: kakaoNativeAppKey
    ? [
        // ['@react-native-kakao/core', { nativeAppKey: kakaoNativeAppKey }],
      ]
    : [],
};

export default config;
