# P2 E2 최종 통합 게이트 결과

> 실행: 2026-06-08 · 작업: E2 (라우트→화면 배선 + 데모 모드 경로 흐름 검증 + 최종 게이트)
> 기준 커밋(작업 전 HEAD): `50d6b9b` (브랜치 feat/p2-foundation, 테스트 376 green)
> 계획: `.omc/plans/autopilot-impl-p2.md` §E2

## 게이트 결과 (전 항목 PASS)

| # | 게이트 | 명령 | 결과 |
|---|--------|------|------|
| 1 | typecheck | `pnpm -r typecheck` | **PASS** — shared / proxy / mobile 3패키지 무오류 |
| 2 | test | `pnpm -r test` | **PASS** — shared 36 + proxy 185 + mobile 166 = **387 green** (376 → +11 신규 E2 테스트) |
| 3 | secret scan | `bash scripts/secret-scan.sh` | **PASS** — 하드코딩 키 없음 (exit 0) |
| 4 | proxy dry-run | `cd services/proxy && npx wrangler deploy --dry-run` | **PASS** — 키 없이 성공, `POST /v1/routes` 등록, CACHE(KV)·DEMO_MODE("auto") 바인딩 확인 (exit 0) |
| 5 | web export | `cd apps/mobile && set -o pipefail; CI=1 npx expo export --platform web` | **PASS** — `/route/input`(24KB)·`/route/result`(23KB) 포함 정적 라우트 렌더, `Exported: dist` (pipefail로 실제 exit 0 검증) |
| 6 | 번들 네이티브 맵 부재 grep | `dist/_expo/static/js/web/entry-*.js` (3.2MB) | **PASS** — 아래 불변식 |
| 7 | contract.test 드리프트 실증 | `routesPath` 등록 1회 누락 → contract.test | **PASS** — 드리프트가 테스트 실패로 잡힘, 즉시 복원 |

### 게이트 6 — 웹 번들 격리 불변식
실제 번들 `dist/_expo/static/js/web/entry-e30917bd0210c7c99eeec8a34fd90b8d.js` (3.2MB) grep:
- `@maplibre/maplibre-react-native` → **0** occurrences ✅
- `@react-native-kakao/map` → **0** occurrences ✅
- `@react-native-kakao/core` → **0** occurrences ✅
- (양성 대조) `maplibre-gl` (웹 라이브러리) → **1** occurrence ✅ — grep이 유효함을 확인

RouteResultScreen이 `../map/MapView`를 새로 import해 경로 결과 화면 서브그래프가 처음 웹 번들에 유입됐으나, 네이티브 맵 모듈은 transitively라도 유입되지 않음. 불변식 통과.

### 게이트 7 — contract.test 드리프트 실증 (1회)
- 절차: `services/proxy/src/index.ts:44` `app.post(routesPath, dispatchRoutes)` 줄을 주석 처리 → `vitest run src/contract.test.ts` 실행.
- 결과: **2 failed | 5 passed (7)** — 실패 케이스:
  - `POST /v1/routes 가 명시적으로 등록됨 (GET만이 아님)` → `expected false to be true`
  - subset 단언 `POST /v1/routes 등록됨` → 동일
- 즉시 복원 → 재실행 **7 passed**. `git status` 클린(`services/proxy/` 잔여 변경 0). 드리프트 = 테스트 실패임을 실증하고 레포 상태를 원복.

## 라우트 → 화면 연결 상태

| 라우트 | 화면 | 데이터/상태 | 어댑터 (배선 내용) |
|--------|------|-------------|--------------------|
| `app/route/input.tsx` → `/route/input` | RouteInputScreen (C2) | useRouteStore(setStops/setMode) | `onSubmit(RouteRequest)` → 스토어에 stops·mode 기록 → `/route/result` push. `onCancel`→router.back. provider는 화면 기본 mockPlaceProvider |
| `app/route/result.tsx` → `/route/result` | RouteResultScreen (D4) | useRouteStore(stops/mode) + **useRouteQuery (D 훅 주입)** | 스토어 stops·mode 읽어 `useRouteQuery`로 탐색 → `data ?? null`을 화면에 주입. `onBack`→router.back. QueryClientProvider는 `_layout.tsx` 제공 |
| `app/index.tsx` → `/` (홈) | HomeScreen (C1) | useAppStore + router | **신규 길찾기 진입 동선**: `onOpenRoute`→`/route/input` push |

- 화면 props 시그니처 **불변** — 어댑터는 전부 라우트 파일에 격리.
- 홈 화면에 길찾기 버튼 부재 → HomeScreen에 **`onOpenRoute?` optional prop 1개 + 나침반 FAB 1개** 추가(최소 변경, 기존 `onOpenSearch`/`onRequestLocation` 패턴 그대로). fabWrap에 `gap:12`로 2개 FAB 세로 정렬. 화면 로직 변경 아님(prop·UI 추가만).
- 데모 모드: 키 0개 → `isDemoMode` true → RouteService가 `mockRouteProvider` 데이터를 흘림.

## 데모 모드 경로 흐름 검증 (신규 테스트 2종)

§E2는 web export(정적 렌더, 게이트 5) + 라우트 레벨 렌더/데이터 흐름 테스트로 이중 보장한다(P1 routeRender/routeFlow 패턴, 의존성 추가 0).

### `src/screens/routeRenderE2.test.tsx` — 라우트 레벨 렌더 (react-native-web alias + renderToStaticMarkup)
- RouteInputScreen: 모드 탭 4종(도보·대중교통·자동차·자전거) + 출발·도착 + 경유지 추가 + 경로 탐색 버튼이 throw 없이 렌더.
- RouteResultScreen: 도보(15분 요약)·자동차 경유지·대중교통 leg-chaining(4호선·환승)·시외 3단 스티칭(KTX)·null(로딩) 렌더.

### `src/screens/routeFlowE2.test.ts` — 데모 모드 데이터 계약 흐름
- 경유지 구성: 출발+경유지 2개+도착 → `toStops` = 4 stops, 순서변경(`moveWaypointDown`)이 stops 순서에 반영.
- 모드탭 4종: `tabToMode` → `getRoute({stops,mode})`(데모=mockRouteProvider) → 4모드 전부 유효 Route + `routeSummary`(총시간/거리>0) + `routeToPolylines`(coords 비어있지 않음 — 앱은 디코드 안 함, leg.coords 그대로 사용).
- 시내 대중교통: leg-chaining 요약에 노선명·환승(≥1) 포함.
- 시외(서울→부산, 위도차>1.5°): 3단 스티칭 요약에 KTX 노선명 + 환승 ≥2 포함.

## 변경 파일 (최소 배선 + 어댑터)

| 파일 | 변경 |
|------|------|
| `apps/mobile/app/route/input.tsx` | placeholder stub → RouteInputScreen 어댑터 (onSubmit→스토어+네비) |
| `apps/mobile/app/route/result.tsx` | placeholder stub → RouteResultScreen 어댑터 (useRouteQuery 훅 주입) |
| `apps/mobile/src/screens/HomeScreen.tsx` | `onOpenRoute?` prop + 길찾기 FAB + fabWrap gap (최소) |
| `apps/mobile/app/index.tsx` | `onOpenRoute`→`/route/input` 배선 |
| `apps/mobile/src/screens/routeRenderE2.test.tsx` | 신규 — 입력·결과 화면 라우트 레벨 렌더 테스트 |
| `apps/mobile/src/screens/routeFlowE2.test.ts` | 신규 — 데모 모드 경로 흐름 데이터 계약 테스트 |

화면·핸들러 로직 변경 0(어댑터·배선·optional prop 추가만). 의존성 추가 0. proxy index.ts 드리프트 실증 후 클린 복원.

## 발견한 문제와 처리

- **발견 문제 없음.** P1 BUG-1(NodeNext `.js` specifier ↔ Metro 리졸버) 재발 우려가 있었으나(RouteService·routeQueries·routeToPolylines·RouteInputScreen·RouteResultScreen·ModeTabsBar 서브그래프가 처음 웹 번들 유입), P1이 도입한 `metro.config.js` resolveRequest 심이 신규 파일에도 정상 동작 — web export 첫 시도부터 PASS.
- LSP 진단 도구(`typescript-language-server`)는 환경에 미설치 → `pnpm -r typecheck`(tsc)로 타입 검증 대체(PASS).

## 검증 명령 재현
```
pnpm -r typecheck                                          # PASS
pnpm -r test                                               # 387 green
bash scripts/secret-scan.sh                                # PASS (exit 0)
cd services/proxy && npx wrangler deploy --dry-run         # PASS (POST /v1/routes)
cd apps/mobile && set -o pipefail; CI=1 npx expo export --platform web   # PASS
grep -c '@maplibre/maplibre-react-native' dist/_expo/static/js/web/entry-*.js   # 0
```
