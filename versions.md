# Toolchain Version Pins (Phase 1)

> 확인 일자: 2026-06-07 (`npm view <pkg> version`)
> 이 핀들은 루트 `package.json`의 `overrides` (pnpm-workspace.yaml)로 강제된다. 각 패키지의 **실제 설치**는
> 해당 스트림(주로 스트림 E의 Expo 본설치, 스트림 A의 Wrangler, 스트림 B의 지도 SDK)에서 수행한다.
> Foundation(F1)에서는 핀만 기록하고 `overrides` (pnpm-workspace.yaml)로 강제한다.

## 핵심 도구체인 (정확 버전 고정)

| 패키지 | 핀 버전 | 설치 스트림 | 비고 |
|--------|---------|-------------|------|
| `expo` | 56.0.9 | E (E1) | Expo SDK |
| `react-native` | 0.85.3 | E (E1) | |
| `react-native-web` | 0.21.2 | E (E1) | 웹 렌더링 |
| `wrangler` | 4.98.0 | A | Cloudflare Workers CLI |
| `@react-native-kakao/map` | 2.2.7 | B (B2) | 한국 네이티브 지도 (착수 시 Expo 호환 선확인) |
| `@maplibre/maplibre-react-native` | 11.3.3 | B (B3) | 글로벌 네이티브 지도 |
| `maplibre-gl` | 5.24.0 | B (B3) | 글로벌 웹 지도 |

## Foundation에서 실제 설치되는 도구

| 패키지 | 핀 버전 | 위치 |
|--------|---------|------|
| `typescript` | 6.0.3 | 루트 devDependency |
| `vitest` | 4.1.8 | 루트 devDependency |
| `react` | 19.2.7 | apps/mobile (F5 stub typecheck) |
| `react-native` | 0.85.3 | apps/mobile (F5 stub typecheck, overrides로 강제) |

> 주의: `overrides` (pnpm-workspace.yaml)는 트리에 아직 존재하지 않는 패키지(expo, maplibre 등)에는 무효(inert)하다.
> 해당 스트림이 `pnpm add`로 추가할 때 overrides가 핀을 강제한다.

## E1 (Expo 부트스트랩 + 전 스트림 일괄 설치)에서 추가된 핀

> 추가 일자: 2026-06-07. 출처: Expo SDK 56의 `bundledNativeModules.json`(Expo 관리 피어) + `npm view <pkg> version`(비-Expo).
> Expo 관리 패키지는 SDK가 보증하는 캐럿/틸드 범위를 그대로 따른다 (latest 임의 핀 금지 — SDK 호환 깨짐 방지).

| 패키지 | 핀 | 출처 | 비고 |
|--------|----|----|------|
| `react-dom` | 19.2.7 | react와 정합 | 웹 export 필수(react-native-web 렌더 타깃) |
| `@expo/metro-runtime` | ~56.0.14 | SDK 56 bundled | 웹 enable 런타임 |
| `expo-constants` | ~56.0.17 | SDK 56 bundled | expo-router 피어 |
| `expo-linking` | ~56.0.13 | SDK 56 bundled | expo-router 피어(딥링크) |
| `expo-status-bar` | ~56.0.4 | SDK 56 bundled | App.tsx StatusBar |
| `expo-location` | ~56.0.16 | SDK 56 bundled | 스트림 D(D3) 위치 |
| `expo-router` | ~56.2.9 | SDK 56 bundled | 네비게이션(E2). E1은 설치만, classic index.js 엔트리 유지 |
| `react-native-screens` | 4.25.2 | SDK 56 bundled | expo-router 피어 |
| `react-native-safe-area-context` | ~5.7.0 | SDK 56 bundled | (npm latest 5.8.0 아님 — SDK 보증판) |
| `react-native-gesture-handler` | ~2.31.1 | SDK 56 bundled | expo-router 피어 |
| `react-native-reanimated` | 4.3.1 | SDK 56 bundled | expo-router 피어. **주의: WSL 웹 export 위협(C3) — E1 stub은 미import이므로 무관, E2/E3가 라우터 배선 후 export 재검증 필요** |
| `zustand` | 5.0.14 | npm latest | 비-Expo 상태관리(D4) |
| `@tanstack/react-query` | 5.101.0 | npm latest | 비-Expo 쿼리(D4) |
| `@react-native-kakao/core` | 2.2.7 | map과 정합 | @react-native-kakao/map의 피어 |
| `@babel/core` | ^7.25.0 | Expo 템플릿 표준 | metro/babel 빌드 devDep |
