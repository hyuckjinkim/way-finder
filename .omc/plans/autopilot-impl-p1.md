# wayfinder Phase 1 — 구현 계획 (autopilot direct 모드)

> 단일 진실 소스: `docs/superpowers/specs/2026-06-07-map-navigation-app-design.md`
> 미션 계약: `.omc/autopilot/spec.md`
> 작성: 2026-06-07 / 모드: direct (인터뷰 생략, 스펙 승인 완료)
> 실행: **5명 병렬 워커** — 기반(Foundation)을 먼저 깔고 그 위에서 스트림 A~E 병렬

---

## 0. 핵심 설계 원칙 (실행 워커 필독)

1. **계약 우선 병렬화 (contract-first parallelism).** 어떤 스트림도 다른 스트림의 *구현*을 `blockedBy`로 가리키지 않는다 (**유일한 예외: 최종 통합 게이트 E3** — 완료된 C/D 산출의 join). 모든 의존은 Foundation(F1~F5: 스캐폴드 · 공유 타입 · 목 픽스처 · 도구체인 · MapView stub)으로만 향한다. 만약 작업이 `blockedBy: [스트림 X]`가 되면, `blockedBy: [F2 타입, F3 픽스처]`로 다시 쓴다 — 이것이 실제 병렬화 여부를 판별하는 테스트다.
2. **키 없이 전체 빌드·테스트 통과.** 모든 외부 API는 모킹. 앱은 **데모 모드(mock provider)**로 키 없이 동작. 실 API 키는 사용자가 나중에 발급(§"사용자 액션 필요"). 키 발급 전에도 `typecheck`·`test`·`web export`가 전부 green이어야 한다.
3. **키는 클라이언트에 절대 노출 금지.** 앱은 Cloudflare Workers 프록시만 호출. 키는 `wrangler secret` 전용. (§4·§6)
4. **웹이 Phase 1 검증 게이트.** 네이티브(Kakao/MapLibre RN)는 Mac/실기기 없음 + Expo Go 불가 → 네이티브 구현체의 완료 기준은 **typecheck + config plugin 배선**이지 디바이스 동작 검증이 아니다. 디바이스 동작은 §12 명시적 한계.
5. **장애 격리(graceful degradation)는 테스트 대상.** 공급자 한 곳 실패 시 해당 섹션만 생략하고 나머지는 렌더링. silent failure 금지(에러 로깅). (§6·§11)

### 모노레포 레이아웃 (확정)

```
wayfinder/
├─ package.json              # pnpm workspaces 루트
├─ pnpm-workspace.yaml
├─ tsconfig.base.json        # 공통 컴파일러 옵션
├─ packages/
│   └─ shared/               # @wayfinder/shared — 정규화 타입 + MapView 인터페이스 + 목 픽스처
│       ├─ src/types/        # Place, PlaceDetail, Review, BlogPost, LatLng, BBox, CameraState, Route, RouteLeg
│       ├─ src/map/          # MapViewProps, MapViewRef, MapMarker, MapPolyline
│       ├─ src/mocks/        # 픽스처 + mock provider 계약
│       └─ src/region/       # 한국 bbox 판정 + 히스테리시스 (순수 함수)
├─ apps/
│   └─ mobile/               # Expo (RN + TS), react-native-web
└─ services/
    └─ proxy/                # Cloudflare Workers + Hono
```

> **패키지 매니저: pnpm workspaces.** Expo는 pnpm을 지원하나 hoisting 이슈가 있어 루트 `.npmrc`에 `node-linker=hoisted` 설정(아래 F1 참고). 모노레포 명령은 `pnpm -r <script>` 형태.

---

## 1. Foundation (순차 — 모든 스트림을 blocking)

> F1 → F2 → F3는 순서대로. F4는 F1 이후 병렬 가능. Foundation 완료 후 A~E 동시 시작.

### F1. 모노레포 스캐폴드
- **파일:** `package.json`, `pnpm-workspace.yaml`, `tsconfig.base.json`, `.gitignore`, `.nvmrc`, `pnpm-lock.yaml`
- **내용:** pnpm workspaces 정의(`packages/*`, `apps/*`, `services/*`). 루트에 `typecheck`/`test`/`build` 스크립트(`pnpm -r`). `pnpm-workspace.yaml`에 `nodeLinker: hoisted`(Expo+pnpm 공식 권장 위치). `.gitignore`에 `node_modules`·`.expo`·`dist`·`.wrangler`·`*.local`·시크릿 파일. **핵심 도구체인 버전 핀**: `expo`, `react-native`, `react-native-web`, `wrangler`, `@react-native-kakao/map`, `@maplibre/maplibre-react-native`, `maplibre-gl`을 정확 버전으로 고정.
- **blockedBy:** 없음
- **완료 기준:** `pnpm install` 성공(WSL2 폴링 환경변수 적용 — §WSL2), `pnpm -r typecheck` 무오류(빈 워크스페이스라도 exit 0), **`pnpm-lock.yaml` 커밋(동결)** — 이후 모든 스트림은 동결된 lockfile 기준으로 `pnpm add` 후 lockfile 델타를 커밋 (재해석 금지: lockfile 커밋 없이는 F1 미완료)
- **난이도:** sonnet

### F2. 공유 타입 패키지 (`@wayfinder/shared`)
- **파일:** `packages/shared/package.json`, `packages/shared/tsconfig.json`, `packages/shared/src/types/*.ts`, `packages/shared/src/map/*.ts`, `packages/shared/src/index.ts`
- **내용:** §5·§7·§8의 모든 정규화 모델을 타입으로 정의 — `LatLng`, `BBox`, `CameraState`, `Place`, `PlaceDetail`(rating·reviews·blogs.naver/kakao·links·roadview), `Review`, `BlogPost`, `Route`, `RouteLeg`(§8 다구간 전제 — P1엔 미사용이나 스키마 안정성 위해 포함). `MapViewProps`, `MapViewRef`, `MapMarker`, `MapPolyline`. **구현 없음, 타입·인터페이스만.**
- **blockedBy:** F1
- **완료 기준:** `pnpm --filter @wayfinder/shared typecheck` 무오류. 모든 §7 필드가 타입에 존재(설계 문서 §5·§7·§8 대조).
- **난이도:** sonnet

### F3. 목 픽스처 + 모킹 계약 (`@wayfinder/shared/mocks`)
- **파일:** `packages/shared/src/mocks/fixtures.ts`, `packages/shared/src/mocks/provider.ts`, `packages/shared/src/region/koreaBbox.ts`
- **내용:** 정규화 타입(F2)을 채운 결정론적 픽스처 — 한국 장소(예: 서울 카페, 구글 평점+리뷰5+네이버/카카오 블로그+로드뷰 좌표) + 글로벌 장소(예: 도쿄, 로드뷰 없음). 검색 결과 리스트 픽스처. **mock provider 계약**(`PlaceProvider` 인터페이스: `search`, `getDetail`)을 정의하고 fixture 기반 구현 제공 — 이것이 앱의 데모 모드와 프록시 테스트 양쪽의 공통 입력. 한국 bbox 판정 순수 함수(위도 33.0~38.7 / 경도 124.5~132.0, ±0.5° 히스테리시스, 줌<6 강제 글로벌)도 여기 둔다.
- **blockedBy:** F2
- **완료 기준:** `pnpm --filter @wayfinder/shared test`(Vitest)로 픽스처가 타입을 만족하고 region 판정 단위 테스트(경계·완충지대·저줌) 통과.
- **난이도:** sonnet

### F4. 도구체인 / CI / 인프라 설정
- **파일:** `vitest.config.ts`(루트 + workspace), `services/proxy/wrangler.toml`(시크릿 없음, KV 네임스페이스 바인딩 placeholder), `apps/mobile/app.json`/`app.config.ts`(Kakao config plugin 슬롯 — 키는 env에서 주입, 미설정 시 데모 모드), `.github/workflows/ci.yml`(install→typecheck→test→**secret scan**→web export, 키 불요), 루트 `README` 빌드/테스트 명령
- **내용:** 모든 패키지 공통 Vitest 설정. 프록시는 `@cloudflare/vitest-pool-workers`. WSL2 폴링 env 문서화. EAS는 `eas.json` 스캐폴드만(빌드 실행은 사용자 액션). **자동 시크릿 스캔 게이트**: CI에 키 패턴 grep/secret-scan 단계 추가 — 하드코딩 키가 들어오면 수동 diff 검사가 아니라 빌드가 실패해야 함 (5워커 자율 실행 전제).
- **blockedBy:** F1
- **완료 기준:** `pnpm -r test` 루트에서 실행 가능(빈 스위트라도 green), CI yml lint 통과, `wrangler deploy --dry-run` 키 없이 성공, 시크릿 스캔이 의도적 더미 키 커밋을 잡아내는지 1회 검증.
- **난이도:** sonnet

### F5. MapView 계약 stub (Foundation 소유)
- **파일:** `apps/mobile/src/map/MapView.tsx`, `apps/mobile/src/map/MapView.web.tsx`
- **내용:** `@wayfinder/shared`의 `MapViewProps`/`MapViewRef` 계약을 만족하는 **no-op stub** (회색 placeholder 뷰 + 카메라 상태 텍스트). 스트림 C(C1)는 이 고정 경로만 import하고 **절대 이 파일을 생성/수정하지 않는다**. 스트림 B(B4)의 첫 행동은 이 stub을 실제 디스패처 구현으로 **덮어쓰는 것** (동일 경로, 소유권 핸드오프 문서화).
- **blockedBy:** F2
- **완료 기준:** stub이 typecheck 통과, C1이 import 가능, B4 핸드오프 규칙이 본 계획에 명시됨.
- **난이도:** haiku

---

## 2. 병렬 스트림 (Foundation 완료 후 5워커 동시 실행)

### 스트림 A — 백엔드 프록시 (Cloudflare Workers + Hono)
**워커 1 · blockedBy: F2, F3, F4**

| # | 작업 | 파일 | blockedBy | 완료 기준 | 난이도 |
|---|------|------|-----------|-----------|--------|
| A1 | 정규화 함수 | `services/proxy/src/normalize/{kakaoPlace,googlePlace,naverBlog,kakaoBlog}.ts` | F2,F3 | Vitest: 각 공급자 raw 픽스처 → `Place`/`PlaceDetail`/`BlogPost` 변환 단위 테스트 통과 (`pnpm --filter proxy test`) | sonnet |
| A2 | 엔드포인트 4종 | `services/proxy/src/routes/{places-search,place-detail,blogs}.ts`, `services/proxy/src/index.ts` | A1 | `GET /v1/places/search`(지역→카카오/구글 라우팅), `GET /v1/places/:id`(기본정보+**lazy** 구글 평점·리뷰 병합), `GET /v1/blogs`(네이버+카카오 병합). 통합 테스트(`@cloudflare/vitest-pool-workers`, fetch 모킹)로 정규화 응답 검증 | sonnet |
| A3 | 캐싱 + TTL 강제 | `services/proxy/src/cache/kv.ts` | A2 | 블로그 6h·장소 기본정보 24h KV TTL. 구글 데이터 30일 한도 TTL 강제. 캐시 히트/미스 단위 테스트 통과 | sonnet |
| A4 | 장애 격리 + 레이트리밋 | `services/proxy/src/middleware/{degradation,ratelimit}.ts` | A2 | **graceful degradation 테스트**: 구글 fetch가 throw → 응답은 200, `reviews` 생략·`rating` 없음, 에러 로깅, 블로그 탭 정상. IP 레이트리밋 단위 테스트 | opus |
| A5 | 데모 모드 스위치 | `services/proxy/src/config.ts` | A2 | 키 env 미설정 시 F3 mock provider로 응답(실 fetch 미발생). `wrangler deploy --dry-run` 키 없이 성공 | sonnet |

### 스트림 B — MapView 구현체 4종 + Region Provider
**워커 2 · blockedBy: F2 (F3의 region 함수 사용)**

| # | 작업 | 파일 | blockedBy | 완료 기준 | 난이도 |
|---|------|------|-----------|-----------|--------|
| B1 | Region Provider | `apps/mobile/src/map/RegionProvider.tsx` | F2,F3 | 카메라 center로 렌더러 선택(F3 koreaBbox 사용), 히스테리시스·줌<6 강제·전환 시 카메라 상태 이어받기. 선택 로직 단위 테스트 통과 | sonnet |
| B2 | MapView 한국 (네이티브/웹) | `apps/mobile/src/map/MapView.kakao.tsx`, `MapView.kakao.web.tsx` | F2 | `@react-native-kakao/map`(네이티브 — **착수 시 최신 버전이 Expo SDK config plugin과 호환되는지 먼저 확인**, 마지막 배포 ~1년 전) / Kakao JS API(웹 — npm import 아님: **동적 `<script>` 주입 로더**(`loadKakaoSdk()` 유틸, appkey env)로 로드, 키 없으면 placeholder 렌더). `MapViewProps`/`Ref` 구현. **완료=typecheck + config plugin 배선**(디바이스 동작 비검증, §12) | opus |
| B3 | MapView 글로벌 (네이티브/웹) | `apps/mobile/src/map/MapView.maplibre.tsx`, `MapView.maplibre.web.tsx` | F2 | `@maplibre/maplibre-react-native`(네이티브) / `maplibre-gl`(웹) + OpenFreeMap 스타일(무료). `MapViewProps`/`Ref` 구현. 웹 export에서 마운트 typecheck 통과 | opus |
| B4 | 통합 `<MapView>` 디스패처 | `apps/mobile/src/map/MapView.tsx`, `MapView.web.tsx` (**F5 stub을 덮어씀** — 소유권 핸드오프) | B1,B2,B3,F5 | RegionProvider 결과로 한국/글로벌 구현체 분기(`flyTo`/`fitBounds` ref 위임). 서울↔도쿄 카메라 변경 시 렌더러 전환을 단위 테스트로 검증(렌더러 선택 함수 레벨). **웹 번들 격리 불변식**: `.web.tsx` 경로에서 네이티브 모듈(`@maplibre/maplibre-react-native`, `@react-native-kakao/map`)이 transitively라도 import되지 않을 것 — E3 스모크에서 웹 export 산출물에 네이티브 맵 모듈 부재 assert | sonnet |

### 스트림 C — 화면 (지도 홈 · 검색 · 장소 상세)
**워커 3 · blockedBy: F2, F3 (목 데이터로 동작, B/D 구현 대기 안 함)**

| # | 작업 | 파일 | blockedBy | 완료 기준 | 난이도 |
|---|------|------|-----------|-----------|--------|
| C1 | 지도 홈 화면 | `apps/mobile/src/screens/HomeScreen.tsx` | F2,F3,F5 | `<MapView>`는 **F5 stub 경로(`src/map/MapView`)만 import** — 이 파일을 절대 생성/수정하지 않음(M2 핸드오프 규칙). 검색바 + 현재 위치 버튼. 웹 export 렌더 통과 | sonnet |
| C2 | 검색 화면 | `apps/mobile/src/screens/SearchScreen.tsx` | F2,F3 | 자동완성 리스트(목 검색 결과) → 핀 + 카메라 이동 콜백. 한국어/영어 입력 모두 결과 표시. 컴포넌트 단위 테스트(목 데이터) | sonnet |
| C3 | 장소 상세 바텀시트 | `apps/mobile/src/screens/PlaceDetailSheet.tsx` | F2,F3 | 기본정보 + **플랫폼 탭(구글/네이버/카카오)** + 로드뷰 진입 버튼. **라이브러리 확정: Reanimated 의존 없는 plain RN View 기반 자체 시트** (Phase 1은 제스처 물리 불요 — gorhom v5의 Reanimated 4/gesture-handler 네이티브 피어가 WSL 웹 export를 위협. 추후 필요 시 교체). 탭도 View 기반 segmented control 자체 구현. `PlaceDetail` 전 필드 표시. 단위 테스트로 각 탭 렌더 | opus |
| C4 | 플랫폼 탭 + 딥링크 | `apps/mobile/src/components/{GoogleTab,NaverTab,KakaoTab,Deeplink}.tsx` | C3 | 구글=평점+리뷰5(**탭 열릴 때 lazy load**), 네이버/카카오=블로그 목록. 더보기=각 플랫폼 딥링크(`links.*`). 구글 탭 쿼터 초과 시 degradation UI(빈 상태 안내, 다른 탭 정상). 단위 테스트 + **(a) lazy 부정 테스트: 검색·상세 열기에서 구글 fetch 미발생, 구글 탭 열 때만 발생 (§11 과금 방어선의 행동 검증)** + **(b) 클라이언트측 degradation 렌더 테스트: 한 공급자 섹션 부재 시 나머지 탭 정상 렌더** | opus |
| C5 | 로드뷰 화면 (M1) | `apps/mobile/src/screens/RoadviewScreen.tsx` | F2,F3 | 스펙 §5 "장소 상세에서 **전용 화면** 진입". 한국=카카오 로드뷰(웹 JS API, 키 0개 placeholder / 네이티브 SDK는 typecheck-only §12), 글로벌=구글 스트리트뷰 **딥링크**. C3 로드뷰 버튼의 네비게이션 타깃. 데모 모드 렌더 단위 테스트 | sonnet |

### 스트림 D — 서비스 레이어 + 상태관리 + 데모 모드
**워커 4 · blockedBy: F2, F3**

| # | 작업 | 파일 | blockedBy | 완료 기준 | 난이도 |
|---|------|------|-----------|-----------|--------|
| D1 | API 클라이언트 | `apps/mobile/src/services/apiClient.ts` | F2 | 프록시 base URL(env) fetch 래퍼. env 미설정 시 데모 모드 플래그 | sonnet |
| D2 | PlaceService | `apps/mobile/src/services/PlaceService.ts` | F2,F3 | `search`/`getDetail` — 실 모드=프록시 호출, 데모 모드=F3 mock provider. 인터페이스는 동일. 단위 테스트(모킹된 fetch + mock provider 양쪽) | sonnet |
| D3 | 위치 서비스 | `apps/mobile/src/services/LocationService.ts` | F2 | `expo-location` 래퍼, 웹/네이티브 분기. 권한 거부·미지원 graceful fallback(기본 카메라). 단위 테스트 | sonnet |
| D4 | 상태 + 쿼리 | `apps/mobile/src/state/{store.ts,queries.ts}` | D2 | Zustand 스토어(카메라·선택 장소·검색) + TanStack Query 훅(검색·상세, 상세는 lazy). 단위 테스트로 캐시 키·lazy 동작 검증 | sonnet |

### 스트림 E — 앱 셸 / 네비게이션 / 웹 export 게이트
**워커 5 · blockedBy: F1, F4 (스트림 C/D의 산출을 후반 통합)**

| # | 작업 | 파일 | blockedBy | 완료 기준 | 난이도 |
|---|------|------|-----------|-----------|--------|
| E1 | Expo 앱 부트스트랩 | `apps/mobile/package.json`, `apps/mobile/App.tsx`, `apps/mobile/metro.config.js`, `babel.config.js` | F1,F4 | Expo + RN web + `@wayfinder/shared` 워크스페이스 의존 배선. Metro에 모노레포 `watchFolders`/`nodeModulesPaths` + **WSL2 폴링**. `expo export --platform web` 성공 | opus |
| E2 | 네비게이션 셸 | `apps/mobile/src/navigation/index.tsx` | E1 | Home↔Search↔Detail↔**Roadview** 라우팅(expo-router 또는 react-navigation). 빈 화면 stub로 우선 배선, C 산출 도착 시 연결 | sonnet |
| E3 | 데모 모드 통합 + 웹 게이트 | `apps/mobile/app.config.ts`(env 배선), 스모크 스크립트 | E1,C*,D* (**완료된** C/D 산출의 join — 개별 C/D 작업을 막지 않는 최종 통합 게이트, 원칙 #1의 명시적 예외) | 키 0개로 `expo export --platform web` green + 데모 모드로 홈·검색·상세(**PlaceDetailSheet 렌더 포함**)·**로드뷰 화면** 흐름이 목 데이터로 동작(웹) + **웹 export 산출물에 네이티브 맵 모듈 부재 assert**(B4 불변식). **이것이 Phase 1 최종 검증 게이트** | opus |
| E4 | 스모크 테스트 분리 | `apps/mobile/e2e/smoke.skip.ts`, `services/proxy/smoke/*.ts` | E1 | 실 API 키 필요한 스모크 테스트는 기본 스킵(env gated). 단위/통합과 분리되어 CI green 불방해 | sonnet |

---

## 3. 의존 그래프 요약

```
F1 ─┬─> F2 ─┬─> F3 ─┬─> A(프록시)        [워커1]
    │       │       ├─> B(MapView)       [워커2]  (F2 필수, F3 region, F5 stub 덮어씀)
    │       │       ├─> C(화면)          [워커3]  (F5 stub import)
    │       │       └─> D(서비스)         [워커4]
    │       └─> F5(MapView stub)
    └─> F4 ────────┬─> A,            (도구체인)
                   └─> E(앱셸/게이트)   [워커5]  (F1,F4 + 후반 C/D 통합)
```

- **Foundation 임계 경로:** F1→F2→F3 (순차). F4는 F1 후, F5는 F2 후 병렬.
- **병렬 진입점:** Foundation 완료 즉시 A·B·C·D·E 동시 시작. 스트림 간 `blockedBy` 없음(전부 Foundation으로만 향함).
- **MapView 소유권 핸드오프(M2):** F5가 stub 생성 → C는 import만 → B4가 동일 경로를 실제 구현으로 덮어씀. C는 어떤 시점에도 `src/map/` 파일을 쓰지 않는다.
- **유일한 스트림 간 통합:** E3(웹 게이트)가 **완료된** C·D 산출을 데모 모드로 묶음 — 원칙 #1의 명시적 예외인 최종 통합 단계이지 개별 작업 차단 아님(C/D는 stub 대상으로 독립 진행 가능).

---

## 4. 사용자 액션 필요 (키 발급 — 빌드/테스트엔 불필요)

> 아래는 **실 데이터 동작·스모크 테스트·EAS 빌드**에만 필요. 키 0개로도 전체 빌드·단위·통합 테스트·웹 export는 데모 모드로 green.

1. **Kakao Developers** — JavaScript 키(웹 지도) + 네이티브 앱 키(Android/iOS) + Local API/블로그 검색 사용 설정. → `wrangler secret`(Local/블로그) + 앱 env(지도 키).
2. **Google Cloud** — Places API 활성화 + **API별 일일 쿼터를 무료 한도로 하드캡**(초과 시 과금 대신 호출 실패) + **월 예산 알림 설정**(§11 셋업 체크리스트). → `wrangler secret`.
3. **Naver Developers** — 블로그 검색 API(클라이언트 ID/Secret, 25,000/일 무료). → `wrangler secret`.
4. **Cloudflare** — Workers/Pages 계정 + KV 네임스페이스 생성 + `wrangler login`.
5. **(선택) EAS** — `eas login` + dev client 빌드(Kakao 네이티브 검증용 Android 에뮬레이터). 무료 빌드 한도 관리 위해 웹 우선.

> **ODsay·TMAP·카카오모빌리티는 Phase 2 범위 — Phase 1 키 발급 불요.**

---

## 5. WSL2 (/mnt/d Windows 마운트) 주의사항

- **inotify 불가(drvfs):** Metro/Expo web 파일 watch가 동작 안 함 → env 설정 필수. F4/E1에 반영:
  - `WATCHPACK_POLLING=true`, `CHOKIDAR_USEPOLLING=true` (웹 dev 서버)
  - Metro `config.watcher.healthCheck` 폴링 또는 `WATCHMAN_DISABLE`로 watchman 우회
- **심볼릭 링크 취약:** pnpm 기본 심링크 구조가 /mnt/d에서 깨질 수 있음 → `.npmrc` `node-linker=hoisted`로 회피(F1).
- **느린 install/IO:** `pnpm install`·`expo export`가 네이티브 FS보다 느림 — 타임아웃 여유. 가능하면 `~/`(WSL 네이티브 FS) 사용 권장이나, 본 저장소는 /mnt/d 고정이므로 폴링으로 대응.
- **EAS/네이티브 빌드는 클라우드(EAS)** — 로컬 네이티브 빌드 불요라 WSL 네이티브 빌드 이슈 회피.

---

## 6. Phase 1 완료 기준 (전체 게이트 — 키 0개)

- [ ] `pnpm install` 성공 (WSL2 폴링 env) + **`pnpm-lock.yaml` 동결 커밋** (M3)
- [ ] `pnpm -r typecheck` 무오류 (shared / proxy / mobile)
- [ ] `pnpm -r test` 전부 green — 정규화 함수·region 판정·서비스 레이어·degradation(프록시+**클라이언트 렌더**) 단위/통합 테스트, **구글 lazy 부정 테스트**, 외부 API 전부 모킹
- [ ] `wrangler deploy --dry-run` (proxy) 키 없이 성공
- [ ] `expo export --platform web` (mobile) 성공 + **산출물에 네이티브 맵 모듈 부재 assert**
- [ ] **데모 모드 웹 흐름**: 홈(하이브리드 지도 슬롯) → 검색(한/영) → 장소 상세(플랫폼 탭 + 딥링크) → **로드뷰 전용 화면**(M1)이 목 데이터로 동작
- [ ] 키·시크릿이 저장소/바이너리에 미포함 — **CI 자동 시크릿 스캔 green** (수동 diff 아님)
- [ ] 네이티브 MapView 구현체는 typecheck + config plugin 배선 완료 (디바이스 동작은 §12 명시적 한계 — Android 에뮬레이터 검증은 사용자 키 발급 후)

---

## 7. 명시적 한계 (설계 문서 §5·§12)

- 네이티브 지도(Kakao RN / MapLibre RN) 디바이스 동작은 Mac/실기기 부재 + Expo Go 불가로 본 Phase에서 미검증. 웹이 일상 검증 채널, Android 에뮬레이터는 사용자 키 발급 후.
- 한국 판정은 단순 bbox(독도·이어도 등 오차 허용) — 문제 보고 시 폴리곤으로 교체(Phase 1 범위 밖).
- 구글 탭은 쿼터 하드캡 전제 — 초과 시 해당 탭만 graceful degradation, 나머지 탭 정상.
- **(critic 지적) Kakao JS API의 Expo web 내 렌더 품질은 PoC에서 실증되지 않음** — poc/map-compare는 MapLibre만 렌더하고 카카오는 딥링크 비교였음. B2 착수 시 최소 재현(스크립트 주입 + 단일 마커)을 가장 먼저 확인하고, 실패 시 한국 웹도 MapLibre 폴백으로 전환하는 결정을 즉시 에스컬레이션.
- `@react-native-kakao/map` 유지보수 정체 가능성(마지막 배포 ~1년 전) — B2 착수 시 Expo SDK 호환성 선확인.
