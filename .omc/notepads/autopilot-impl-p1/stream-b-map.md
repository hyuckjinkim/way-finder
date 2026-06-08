# Stream B — MapView 구현체 4종 + Region Provider (완료)

## 산출물 (apps/mobile/src/map/)
- `RegionProvider.tsx` — `useRegionRenderer` 훅 + 순수 `nextRenderer(camera, current)`. shared `selectRenderer` 위임.
- `loadKakaoSdk.ts` — Kakao JS SDK 동적 `<script>` 주입 로더(appkey env, autoload=false → kakao.maps.load). 최소 타입 선언. zoom↔level 변환(level≈22-zoom, 1~14 클램프).
- `MapView.kakao.web.tsx` — Kakao JS SDK 웹 구현. 키 없으면 placeholder.
- `MapView.kakao.tsx` — @react-native-kakao/map 2.2.7 네이티브 래퍼.
- `MapView.maplibre.web.tsx` — maplibre-gl 웹 구현. OpenFreeMap liberty.
- `MapView.maplibre.tsx` — @maplibre/maplibre-react-native 네이티브.
- `MapView.tsx` / `MapView.web.tsx` — F5 stub 덮어쓴 디스패처(소유권 핸드오프 M2).
- `RegionProvider.test.ts` + `vitest.config.ts` — 격리 테스트(루트 hoisted vitest 사용, 의존성 추가 X).

## @react-native-kakao/map 2.2.7 호환성 (중요)
- Expo config plugin은 **@react-native-kakao/core**가 제공(`app.plugin.js`, 옵션 `{ nativeAppKey, android?, ios? }`). app.config.ts에 배선 완료.
- **KakaoMapRef가 빈 인터페이스 `{}`** — 명령형 flyTo/fitBounds 없음 → controlled `camera` prop을 로컬 state로 구동해 구현(근사). fitBounds는 bbox 중심 이동.
- **마커/폴리라인 하위 컴포넌트 미export** (v2.2.7) → 네이티브 마커 렌더 불가(웹은 정상). props로 받되 네이티브에선 무시(typecheck-only).
- `Camera` 타입 named export 없음 → 로컬 KakaoCamera 타입 정의.
- SDK 초기화: `KakaoMap.initializeKakaoMapSDK(appKey)` 필요(앱 부트스트랩 책임, 미배선 — 디바이스 검증 시 추가).

## 웹 번들 격리 불변식 (B4) — 정적 검증됨
- 네이티브 모듈 실제 import는 `MapView.kakao.tsx`(@react-native-kakao/map), `MapView.maplibre.tsx`(@maplibre/maplibre-react-native) 두 파일뿐.
- `MapView.web.tsx` → `MapView.kakao.web` + `MapView.maplibre.web` + RegionProvider(순수)만 import. Metro가 web에서 `.web.tsx` 우선 해석 → 네이티브 디스패처/구현 웹 번들 미유입.

## 검증
- 맵 단위 테스트: 6/6 green (`vitest run --config apps/mobile/src/map/vitest.config.ts`).
- `pnpm --filter @wayfinder/mobile typecheck`: EXIT 0 (전체 패키지).

## 주의 (다음 워커/Phase 2)
- Kakao 웹 렌더 품질은 미실증(§7 critic 지적) — 실패 시 한국 웹도 MapLibre 폴백 에스컬레이션.
- maplibre-gl/Kakao는 [lng, lat] 순서. shared LatLng는 {lat,lng} — 변환 주의.
