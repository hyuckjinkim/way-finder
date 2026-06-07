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
