# P3 최종 통합 게이트 결과

> 실행: 2026-06-08 · 작업: P3 최종 통합 (navStore 생성 + nav.tsx 실연결 + "안내 시작" 버튼 + tsconfig 점검 + 게이트)
> 기준 커밋(작업 전 HEAD): `1b6b24c` (브랜치 feat/p3-navigation, 테스트 640 green)
> 계획: `.omc/plans/autopilot-impl-p3.md` §4 C3 (2)항 "상태 소유는 스토어"
> 3워커 완료 산출(A·C·D) 위에 통합 — stub NavState 제거, 라우트 교체 소유를 navStore에 정착.

## 게이트 결과 (전 항목 PASS)

| # | 게이트 | 명령 | 결과 |
|---|--------|------|------|
| 1 | typecheck | `pnpm -r typecheck` | **PASS** — shared / proxy / mobile 3패키지 무오류 |
| 2 | test | `pnpm -r test` | **PASS** — shared 66 + proxy 277 + mobile 305 = **648 green** (640 → +8 신규 navStore 테스트, **회귀 0**) |
| 3 | secret scan | `bash scripts/secret-scan.sh` | **PASS** — 하드코딩 키 없음 (exit 0) |
| 4 | proxy dry-run | `cd services/proxy && npx wrangler deploy --dry-run` | **PASS** — 키 없이 성공, CACHE(KV)·DEMO_MODE("auto") 바인딩 확인 (exit 0). P3는 프록시 미변경 — 응답 계약 유지 |
| 5 | web export | `cd apps/mobile && set -o pipefail; CI=1 npx expo export --platform web` | **PASS** — `/route/nav`(23KB) 포함 9개 정적 라우트 렌더, `Exported: dist` (pipefail로 실제 exit 0 검증) |
| 6 | 웹 데모 흐름 | navFlow.test.tsx + 라우트 export | **PASS** — 아래 §흐름 |

### 신규 테스트 분포 (648 = 640 + 8)
- `apps/mobile/src/state/navStore.test.ts` (+8): 세션 시작·기하 reduce(navigating↔off_route)·**status 중재(rerouting 오버레이)**·onSuccess route swap·onFailed reroute_failed 처리·**데모 wiring 정합(DEMO_ROUTE+DEMO_NAV_SEQUENCE)**·**데모 전체 재탐색 사이클(디바운스 경과→swap→navigating)**·stopNav 해지.
- shared(66)·proxy(277)는 무변경·무회귀.

### getRoute 주입(모듈 모킹 제거 — advisor 지적)
navStore의 재탐색 탐색기는 `startNav`에 **주입**(`getRoute?`, 미지정 시 `RouteService.getRoute`). 테스트는 fake를 주입해 전역 `vi.mock` 없이 격리 — **reroute.ts의 "모듈 모킹 대신 주입" 패턴 계승**. (초기 vi.mock 버전에서 관찰된 파일 간 mock 누수 가능성 원천 제거. 앱은 항상 미지정 — C3 (2)항 "스토어가 RouteService 배선" 불변.)

### status 중재 seam (이번 통합의 헤드라인 — advisor 핵심 지적)
`navReduce`는 매 표본 **기하만으로** status를 산출한다 — 재탐색 in-flight 중에도 기하는 여전히 `off_route`라 reduce가 `rerouting`을 매번 덮어쓴다. navStore가 **`rerouting` 오버레이를 기하 status 위에 적용**해 중재한다:
- `onRerouting` → 오버레이 ON → 표시 status `rerouting` 고정(이후 off_route 표본도 클로버 안 함).
- `onSuccess` → active route swap + `initialNavState`로 navMachine **재초기화**(C3 (2)항 "상태 소유는 스토어") → 오버레이 OFF.
- `onFailed` → 오버레이 OFF → 기하 `off_route` 자연 노출 = **reroute_failed 처리**(기존 경로 유지·재시도 가능). `reroute_failed`는 NavStatus enum에 없다(F1 동결) — enum 확장 없이 오버레이 해제로 표현(스코프 최소).

> 컴포넌트 렌더 테스트(navFlow.test.tsx)는 NavState를 prop 직접 주입하므로 이 클로버 버그를 검출 못 한다 — navStore.test.ts가 표본을 직접 구동해 in-flight 동안 status가 `rerouting`으로 유지됨을 단언(갭 보강).

## 웹 데모 흐름 (경로결과 → 안내시작 → 웹 비활성 / 모바일 합성 NavScreen)

1. **경로 결과** — `/route/result`: RouteResultScreen에 `onStartNav` 주입 시 **"안내 시작" 버튼** 렌더(route 있을 때만). 화면 로직 변경 최소(버튼+네비만).
2. **안내 시작** — `result.tsx`가 `router.push('/route/nav')` 배선. navStore가 `routeStore.result`를 안내 경로로 읽는다.
3. **웹**: `/route/nav` → `NavScreen.web.tsx`(.web 분기)가 **비활성 안내**("모바일 앱에서 이용하세요") + 경로 표시 폴백 렌더. 턴 안내 카드 없음(스펙 §1 — 웹은 경로 표시까지). navFlow.test.tsx 4 케이스 PASS.
4. **모바일**: `nav.tsx`가 **데모 모드(isDemoMode)에서 자기완결 `DEMO_ROUTE` + 합성 LocationProvider**(`DEMO_NAV_SEQUENCE`, cadence 800ms — 동일 geometry) + **재탐색용 `getRoute`=DEMO_ROUTE**를 navStore에 주입 → navReduce가 매 표본을 **실제 reduce**(목 NavState 아님) → NavScreen이 **턴 카드**(`DEMO_ROUTE.steps` — 좌회전·우회전·도착)·남은 거리 감소·**경로 이탈 배너 → 재탐색(rerouting) → swap → navigating**(전체 사이클)을 표시. 실 모드는 routeStore.result + expo LocationProvider(C2) 주입.

   > **데모 경로 정합(advisor 지적):** `routeStore.result`는 사용자 가변 입력이고 기본 mode=transit이라 walk 합성 시퀀스(`DEMO_NAV_SEQUENCE`)와 geometry 불일치(전 표본 즉시 off_route 발생). 따라서 데모는 `routeStore.result`를 안내 경로로 쓰지 않고 **`DEMO_NAV_SEQUENCE`와 동일 coords(REFERENCE_PATH)의 `DEMO_ROUTE`**(steps 앵커 포함)로 구동한다. navStore.test.ts의 "데모 wiring 정합" 테스트가 시퀀스→DEMO_ROUTE navReduce가 navigating(즉시 off_route 아님)·nextStep 노출·말미 off_route 전이를 단언(이 wiring을 가드하는 유일 테스트).

### 데모 재탐색 사이클 (전체 동작 — advisor 후속 지적으로 정정)
초기 판단은 "디바운스라 데모는 swap까지 도달 안 함"이었으나 **오판이었다(정정).** 재탐색 arm-timer는 합성 provider의 `setInterval`(표본 방출)과 **독립**이라, 세션이 mounted인 동안 시퀀스가 끝나도 `REROUTE_DEBOUNCE_MS`(5000ms) 경과 시 발사된다. 따라서 데모는 **전체 사이클**을 보인다: 턴 진행 → off_route 배너 → rerouting → **swap** → navigating.

정합 보장(advisor): 데모 분기는 `getRoute`도 **`DEMO_ROUTE`로 주입**한다 — 미주입 시 기본 getRoute가 `routeStore.mode`(기본 transit)로 **steps 없는 `TRANSIT_CHAIN`**을 반환해 데모가 비정합 경로로 점프하기 때문(이 결함을 1-line 주입으로 정정). 재탐색도 동일 geometry·steps 경로로 해소.

증명 테스트:
- `apps/mobile/src/nav/reroute.test.ts` (fake timers) — no-storm·인자·실패.
- `apps/mobile/src/state/navStore.test.ts` (fake timers + getRoute 주입) — 오버레이 중재·swap·reroute_failed·**데모 전체 사이클**(시퀀스 방출 후 디바운스 경과 → `activeRoute`가 steps 보유 `DEMO_ROUTE`로 swap·navigating 복귀 단언 — transit 점프 아님).

## tsconfig 처리 (계획 작업 4)

`apps/mobile/tsconfig.json`의 `allowImportingTsExtensions: true`는 **유지**(제거 안 함). 사유 주석을 tsconfig.json에 추가:
- `navFlow.test.tsx`가 `NavScreen.tsx`와 `NavScreen.web.tsx`를 **.tsx 확장자로 명시 import**해 플랫폼 분기를 각각 테스트한다. 확장자 없으면 resolver가 두 파일을 한 파일로 합쳐 분기 검증이 불가능해진다.
- `noEmit: true` 전용 프로젝트라 안전(emit 없음 — 확장자 import 부작용 0).
- "테스트가 .ts 확장자 import 안 하게" 하는 더 깔끔한 대안은 이 케이스에 **존재하지 않는다**(플랫폼 변형을 동일 식별자로 따로 로드해야 하는 본질적 요구) — 따라서 churn 없이 사유 주석만 추가.

## §8 디바이스 비-게이트 항목 (키+에뮬레이터 확보 후 별도 QA — 본 Phase 범위 밖)

> 계획 §7 "명시적 비-게이트" + §8 검증 분류표 ❌ 항목의 명시 복사. P3 "완료"는 위 게이트까지이며, 아래는 실기기/에뮬레이터 런타임 검증 대상.

| 항목 | 분류 | 검증 방법 |
|------|------|-----------|
| 실 GPS update cadence/accuracy | ❌ 디바이스 필요 | 키+에뮬레이터/실기기 후 QA |
| 백그라운드 추적 지속 (앱 백그라운드 중 위치 갱신) | ❌ 디바이스 필요 | 별도 QA |
| 실 이동 시 이탈 → 재탐색 런타임 동작 | ❌ 디바이스 필요 | 별도 QA |
| 안내 중 화면 wake 동작 | ❌ 디바이스 필요 | 별도 QA |

추가(배선+typecheck까지만, 디바이스 동작은 ❌):
- 백그라운드 추적 배선(`startLocationUpdatesAsync`·`app.config.ts` background mode) — ⚠️ 배선+typecheck.
- 화면 wake 배선(`expo-keep-awake`) — ⚠️ **미도입**(아래 발견 문제). 도입 시 디바이스 동작 ❌.

## 발견 문제 / 비고

1. **`expo-keep-awake` 미도입** — 화면 wake 배선은 신규 의존(`expo-keep-awake`) 필요. 규칙(의존성 추가 금지 — 필요판단 시 보고)에 따라 **추가하지 않음**. 안내 중 화면 wake는 디바이스 동작이라 §8 ❌ 항목과 함께 deferred. 도입 결정은 open-question(계획 §10.4) — 디바이스 QA 시점에 lockfile·빌드 무영향 확인 후 추가 권장.
2. **mock 누수 원천 제거(해결됨)** — 초기 navStore.test.ts는 `vi.mock('../services/RouteService.js')`(전역 모듈 교체)를 썼고, vitest `--` 부분 실행 시 RouteService.test.ts로 누수하는 케이스 1회 관찰. advisor 지적대로 **getRoute를 startNav 인자로 주입**(reroute.ts 패턴)하고 vi.mock을 삭제 — 전역 모듈 교체 0, 파일 간 누수 구조적 불가. 전체 실행 648 green 확인.
3. **expo-location 웹 export 안전 확인** — nav.tsx가 `locationProvider.expo.ts`(→ `import * as Location from 'expo-location'`)를 정적 import하나 웹 export PASS. 기존 `app/index.tsx`도 `LocationService`(expo-location 정적 import)를 import하며 이미 export 통과 — Expo 웹 shim이 처리. `require()` 동적 로드 불필요(코드 단순화).
4. **데모 transit 점프 결함 정정(해결됨)** — 데모 분기가 재탐색 `getRoute`를 미주입하면 디바운스 경과 시 기본 getRoute가 `routeStore.mode`(transit)로 steps 없는 `TRANSIT_CHAIN`을 반환해 데모가 비정합 경로로 swap(이탈 ~5s 후 가시적 점프). advisor 후속 지적으로 데모 분기에 `getRoute: ()=>DEMO_ROUTE` 1-line 주입 — 재탐색이 동일 geometry로 해소(전체 사이클 정합). navStore.test.ts 전체-사이클 테스트가 가드.
5. **워커 로직 무수정** — navMachine·navProgress·reroute·locationProvider(합성/expo)·NavScreen·gpsSequences 핵심 로직 미변경. 통합은 배선(nav.tsx·result.tsx)·신규 스토어(navStore)·UI 버튼(RouteResultScreen `onStartNav`)·픽스처 가산(`DEMO_NAV_SEQUENCE`·`DEMO_ROUTE`)에 한정.

## 변경 파일

| 파일 | 변경 |
|------|------|
| `apps/mobile/src/state/navStore.ts` | **신규** — 네비 세션 스토어(active route + NavState, LocationProvider 구독, rerouting 오버레이 중재, 재탐색 route swap 소유) |
| `apps/mobile/src/state/navStore.test.ts` | **신규** — 세션·status 중재·swap·reroute_failed·데모 wiring 정합·데모 전체 사이클·해지 (+8) |
| `apps/mobile/app/route/nav.tsx` | stub NavState 제거 → navStore 실연결, 데모=합성/실=expo provider 주입 |
| `apps/mobile/app/route/result.tsx` | `onStartNav` 배선 → `/route/nav` push |
| `apps/mobile/src/screens/RouteResultScreen.tsx` | `onStartNav?` prop + "안내 시작" 버튼(route 있을 때만, 로직 최소 변경) |
| `apps/mobile/src/nav/fixtures/gpsSequences.ts` | `DEMO_NAV_SEQUENCE` + `DEMO_ROUTE`(steps 포함 자기완결 walk 경로) 가산 |
| `apps/mobile/tsconfig.json` | `allowImportingTsExtensions` 사유 주석 추가(유지 결정) |
