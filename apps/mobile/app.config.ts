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
    // E2: expo-router app/ 라우트 도입으로 'static'(SSG) 모드로 전환.
    // 'static'은 expo-router의 파일 기반 라우트를 정적 HTML로 export한다.
    output: 'static',
  },
  extra: {
    proxyBaseUrl,
    demoMode,
    kakaoJsKey,
  },
  // 카카오 네이티브 config plugin 배선 (스트림 B / B2).
  // @react-native-kakao/core가 Expo config plugin(app.plugin.js)을 제공하며,
  // nativeAppKey로 Android/iOS 네이티브 SDK를 prebuild 시 구성한다.
  // 키 미설정(데모 모드)이면 플러그인을 배선하지 않아 키 0개로 빌드/웹 export가 통과한다.
  // 디바이스 동작 검증은 사용자 키 발급 후(§7 명시적 한계).
  plugins: kakaoNativeAppKey
    ? [['@react-native-kakao/core', { nativeAppKey: kakaoNativeAppKey }]]
    : [],
};

export default config;
