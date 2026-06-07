# P1 E3 최종 통합 게이트 결과

> 실행: 2026-06-07 · 작업: E3 (라우트→화면 배선 + mobile 테스트 인프라 정식화 + 최종 게이트)
> 기준 커밋(작업 전 HEAD): `73b13ec`

## 게이트 5종 결과

| # | 게이트 | 명령 | 결과 |
|---|--------|------|------|
| 1 | typecheck | `pnpm -r typecheck` | **PASS** — shared / proxy / mobile 3패키지 무오류 |
| 2 | test | `pnpm -r test` | **PASS** — shared 19 + proxy 68 + mobile 60 = **147 green** (mobile 신규 포함) |
| 3 | secret scan | `bash scripts/secret-scan.sh` | **PASS** — 하드코딩 키 없음 (exit 0) |
| 4 | proxy dry-run | `cd services/proxy && npx wrangler deploy --dry-run` | **PASS** — 키 없이 성공, KV/DEMO_MODE 바인딩 확인 |
| 5 | web export | `cd apps/mobile && CI=1 npx expo export --platform web` | **PASS** — 6개 라우트 정적 렌더, `dist` 산출 (pipefail로 실제 exit 검증) |

### B4 웹 번들 격리 불변식 (게이트 5 부속)
실제 번들 `dist/_expo/static/js/web/entry-*.js` (3.3MB) grep:
- `@maplibre/maplibre-react-native` → **0** occurrences ✅
- `@react-native-kakao/map` → **0** occurrences ✅
- `@react-native-kakao/core` → **0** occurrences ✅
- (양성 대조) `maplibre-gl` (웹 라이브러리) → 2 occurrences ✅ — 웹 맵은 정상 포함, grep이 유효함을 확인

네이티브 맵 모듈이 웹 번들에 transitively라도 유입되지 않음. 불변식 통과.

## 라우트 → 화면 연결 상태

| 라우트 | 화면 (C) | 데이터 훅 (D) | 어댑터 |
|--------|----------|---------------|--------|
| `app/index.tsx` → `/` | HomeScreen | useAppStore(camera/selectedPlace) + getCurrentCamera | 카메라·마커 props, 검색바→/search, 위치버튼→LocationService |
| `app/search.tsx` → `/search` | SearchScreen | useAppStore(setCamera/selectPlace) | onSelectPlace→스토어 기록 + /place/[id] 이동 (provider는 화면 기본 mock) |
| `app/place/[id].tsx` → `/place/[id]` | PlaceDetailSheet | usePlaceDetailQuery + getGoogleData(lazy) | detail 가드 후 렌더, loadGoogle=getGoogleData(구글 탭 활성 시만), 로드뷰→/roadview/[id] |
| `app/roadview/[id].tsx` → `/roadview/[id]` | RoadviewScreen | usePlaceDetailQuery | detail 가드 후 렌더, onBack→router.back |

- 화면 props 시그니처 **불변** — 어댑터는 전부 라우트 파일에 격리.
- 데모 모드: 키 0개 → mockPlaceProvider 데이터가 흐름. 정적 export에서 detail undefined 구간은 가드 처리.
- `GoogleData`(PlaceDetailSheet) ≡ `GooglePlaceData`(PlaceService) 구조 동일 → 어댑터 타입 정합.

## 테스트 인프라 정식화 (작업 1)

- 신규 단일 설정 `apps/mobile/vitest.config.mts` — `include: src/**/*.test.{ts,tsx}`, `environment: node`.
  - `resolve.alias`: `react-native` → `react-native-web` (라우트 렌더 테스트용 RN 프리미티브 DOM 매핑).
  - `resolve.extensions`: `.web.tsx` 우선 — 화면이 import하는 `../map/MapView`를 웹 디스패처로 해석(네이티브 Flow 모듈 회피).
  - `define`: `__DEV__`, `process.env.EXPO_OS` — expo-constants import 시점 전역 참조 충족.
- `package.json`에 `"test": "vitest run"` 추가 → 루트 `pnpm -r test`에 mobile 포함(이전엔 누락).
- 산발 설정 제거: `src/__tests__/vitest.config.ts`, `src/map/vitest.config.ts` 삭제.
- 라우트 레벨 렌더 테스트 `src/screens/routeRender.test.tsx` 추가 — 4개 화면을 데모 mock 데이터로 `renderToStaticMarkup` (의존성 추가 없음: react-dom·react-native-web 기존 의존).
  - 데이터 흐름 테스트 `src/screens/routeFlow.test.ts`도 포함(검색→상세→로드뷰 계약 + 구글 lazy 부정).

## 발견한 문제와 처리

### [BUG-1] NodeNext `.js` import specifier ↔ Metro 리졸버 불일치 (라우트 배선이 표면화)
- **증상:** 첫 web export 실패 — `Unable to resolve module ./searchCamera.js from SearchScreen.tsx`.
- **근본 원인:** src 코드(C/B/D 스트림)가 `moduleResolution: "Bundler"` 하에서 상대 import에
  `.js` 확장자를 단다(예: `./searchCamera.js` → 실제 파일 `searchCamera.ts`, 12+ 파일).
  vitest/Vite·tsc는 이를 해석하나 Metro 기본 리졸버는 `.js`→`.ts` 재작성을 하지 않는다.
  이전 "web export green"은 라우트가 placeholder stub이라 실제 화면이 번들 그래프에 없었기 때문 —
  E3 배선이 화면을 끌어오며 잠복 버그가 표면화됨(배선이 버그를 만든 게 아님).
- **처리(최소·in-lane):** `apps/mobile/metro.config.js`에 `resolveRequest` 심을 추가 —
  상대 `.js` specifier만 확장자를 제거해 기본 리졸버에 위임(플랫폼 확장자 `.web.tsx` 우선 보존,
  실제 `.js` 파일이면 원본 재시도). 화면/서비스 로직은 일절 변경 안 함. 12+ 파일을 단일 설정으로 해결.
- **검증:** 재export 성공, 6라우트 정적 렌더, B4 불변식 통과.
- **에스컬레이션 권고(검증 게이트용):** 더 깔끔한 대안은 src 전반의 `.js` import specifier를
  extensionless로 정규화하는 것. 단 이는 다수 워커 파일 수정(스코프 밖)이라 E3에선 리졸버 심으로 처리.
  architect/code-reviewer가 정규화 vs 심 유지를 판정 권고.

### [INFRA-1] react-dom/server 타입 부재
- `@types/react-dom` 미설치(의존성 추가 금지). routeRender 테스트가 `renderToStaticMarkup`만 사용 →
  `apps/mobile/src/types/react-dom-server.d.ts`에 최소 앰비언트 선언으로 처리(타입 정합).

### [NOTE] EXPORT_EXIT 거짓 신호 교정
- 첫 export는 `... | tail; echo $?`로 tail의 exit(0)를 캡처해 번들 실패를 가렸음.
  `set -o pipefail`로 실제 expo exit를 검증하도록 교정 후 게이트 5 PASS를 확정.
