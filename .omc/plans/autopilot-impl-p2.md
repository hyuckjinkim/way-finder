# wayfinder Phase 2 — 경유지 길찾기 구현 계획 (autopilot direct 모드)

> 단일 진실 소스: `docs/superpowers/specs/2026-06-07-map-navigation-app-design.md` (§8이 P2 범위)
> 미션 계약: `.omc/autopilot/spec.md`
> 구조 참고: `.omc/plans/autopilot-impl-p1.md`
> 작성: 2026-06-07 / 모드: direct (인터뷰 생략, 스펙 승인 완료) / 기반: P1 완료 (커밋 6e7fdad, 테스트 162개)
> 실행: **5명 병렬 워커** — Foundation(와이어 계약 포함)을 먼저 깔고 그 위에서 스트림 A~E 병렬

---

## 0. 핵심 설계 원칙 (실행 워커 필독 — P1에서 계승)

1. **계약 우선 병렬화.** 어떤 스트림도 다른 스트림의 *구현*을 `blockedBy`로 가리키지 않는다 (유일한 예외: 최종 통합 게이트 E3). 모든 의존은 Foundation(F1~F4)으로만 향한다. `blockedBy: [스트림 X]`가 되면 `blockedBy: [F1 와이어계약, F2 픽스처]`로 다시 쓴다.
2. **키 없이 전체 빌드·테스트 통과.** 모든 외부 라우팅 API는 모킹. 앱·프록시 모두 **데모 모드**로 키 0개 동작. `typecheck`·`test`·`web export`가 전부 green이어야 한다.
3. **키는 클라이언트에 절대 노출 금지.** 앱은 프록시(`POST /v1/routes`)만 호출. 키는 `wrangler secret` 전용.
4. **웹이 P2 검증 게이트.** 경로 표시는 웹 export로 검증. 네이티브 디바이스 동작은 §"명시적 한계".
5. **장애 격리는 테스트 대상.** 한 공급자/한 leg 실패 시 silent failure 금지 — 에러 로깅 + 명시적 부분 결과 또는 에러 응답.

### P1에서 계승한 결정적 교훈 — 와이어 계약 (이번 계획의 1순위)

P1에서 A워커(프록시)와 D워커(앱 서비스)가 경로를 다르게 가정해 REJECT 1라운드를 소모했다. 그 사후 대응으로 P1은 `@wayfinder/shared/api` (`packages/shared/src/api/paths.ts`)에 경로 상수 모듈을 도입했다. **그러나 현 상태(6e7fdad)는 절반만 봉합돼 있다:**

- 앱 측(`PlaceService.ts`)은 `shared/api` 상수를 import해 쓴다. ✅
- **프록시 측(`services/proxy/src/index.ts`)은 여전히 문자열 리터럴(`'/v1/places/search'`)을 하드코딩**한다. ❌ 상수가 존재하나 프록시에 강제되지 않음 — P1 드리프트 취약점이 잠복 중.
- **상수가 실제로 양쪽에 등록됐는지 검증하는 introspection 테스트가 없다.** ❌

→ **P2 Foundation은 이 골격을 "프로즈가 아니라 실행 가능한 테스트"로 완성한다.** (advisor 지적: 드리프트를 테스트 실패로 만들어라.) 구체:
1. `shared/api`에 `routesPath` 상수 추가.
2. 프록시·앱 양측이 **리터럴을 버리고** 상수로 라우트 등록/호출 (프록시 `index.ts`도 기존 GET 4종을 상수로 리팩터 — 잠복 취약점 제거).
3. **Hono `app.routes` introspection 테스트**: shared가 export하는 모든 경로 상수가 올바른 method로 등록돼 있다고 단언. `POST /v1/routes`를 포함 (GET만이 아님).

### 와이어 계약의 새로운 함정 — `apiClient`는 GET 전용 (advisor 지적)

현 `apps/mobile/src/services/apiClient.ts`는 `fetch(url)` GET 전용 — method/body 인자 없음. `POST /v1/routes`는 body(`{stops, mode}`)가 필요하다. → **`apiClient`에 POST 변형 추가가 Foundation/D 작업**이고, introspection 테스트는 POST를 커버해야 한다. (현재 프록시에 POST 라우트가 0개 — 첫 POST다.)

### P2 스트림 형태는 P1과 다르다 (advisor 지적 — 5워커를 기계적으로 복제하지 말 것)

- **MapView 구현 스트림 없음.** `MapPolyline`(`{id, coords: LatLng[], color?, width?}`)·`MapViewProps.polylines?`가 §5에서 이미 "Phase 2 경로 표시용"으로 존재한다 (P1 산출, 검증됨). 경로 표시는 **화면/컴포넌트 관심사**이지 MapView 재구현이 아니다. → P2엔 MapView 스트림 대신 **경로 입력 UI + 결과 표시 스트림**이 들어간다.
- **프록시가 P2의 헤비 스트림.** 4모드 × 2지역 + leg-chaining + 시외 3단 스티칭. → leg-chaining과 시외 스티칭은 **각자 완료 기준을 가진 별개 알고리즘 작업**으로 분리한다 (하나의 "엔드포인트" 작업에 묻지 않음).

### P2 신규 결정 (이 계획이 확정 — §8이 위임한 항목)

| 항목 | 결정 | 근거 |
|------|------|------|
| **단일 Route vs alternatives** | **단일 `Route` 반환** | §8은 단일 경로 전제(`Route { legs }`). alternatives·"+N분" 필터는 Phase 4. 투기적 plumbing 금지. |
| **자전거 공급자(§8 "계획 시 결정")** | **한국=TMAP 자전거 경로 API**, 글로벌=Google Routes (`travelMode: BICYCLE`). TMAP 자전거 미가용 구간은 도보 leg-chaining 폴백. | TMAP이 한국 자전거 경로를 제공(보행자 API와 동일 키 체계). 카카오모빌리티는 자전거 미제공. open-questions에 "TMAP 자전거 실 API 형식 미검증" 로깅. |
| **외부 API 응답 형식** | 워커 지식 기반으로 §"공급자 형식 부록"에 문서화 → 워커가 fetch 없이 픽스처 작성 | fetch 불가 환경. 실 형식 byte-perfect 검증은 **스모크 테스트 / 사용자 액션으로 연기** (P1 스모크 분리 패턴). 키 0개 게이트는 실 API를 건드리지 않음. |
| **라우팅 쿼터 방어선** | ODsay 일 1,000건 → KV 경로 캐싱(A 스트림) + 클라이언트 디바운스(D 스트림)를 각자 완료 기준을 가진 명시적 작업으로 | §11 무료 티어 정책. P1의 lazy/과금 방어선과 동일 격. |

### 모노레포 레이아웃 (P1 확정 — 변경 없음)

```
wayfinder/
├─ packages/shared/   # @wayfinder/shared — 타입 + api 경로상수 + 목 픽스처 (P2: route 확장)
├─ apps/mobile/       # Expo (RN + TS) — P2: 경로 입력·결과 화면 + RouteService
└─ services/proxy/    # Cloudflare Workers + Hono — P2: POST /v1/routes + 공급자 정규화
```

---

## 1. Foundation (순차 — 모든 스트림을 blocking · 와이어 계약 우선)

> F1 → F2 순서. F3는 F1 후 병렬. **F1(와이어 계약 + introspection 테스트)을 fan-out 전에 깐다** — 이것이 P1 REJECT 재발 방지 게이트.

### F1. 와이어 계약 — route 스키마 + 경로 상수 + introspection 테스트 + POST 클라이언트
- **파일:**
  - `packages/shared/src/types/route.ts` (확장 — `RouteRequest` 신규 + `RouteLeg` 동결)
  - `packages/shared/src/api/paths.ts` (확장 — `routesPath` 추가)
  - `packages/shared/src/index.ts` (RouteRequest export 추가)
  - `services/proxy/src/index.ts` (리터럴 → shared 상수 리팩터 + `app.post(routesPath, …)` 슬롯)
  - `services/proxy/src/contract.test.ts` (**신규 — introspection 테스트**)
  - `apps/mobile/src/services/apiClient.ts` (POST 변형 `apiPost(path, body)` 추가)
- **내용:**
  1. **`RouteRequest` 정의** (현재 `route.ts`에 없음 — 신규): `{ stops: LatLng[]; mode: TravelMode }`. `stops` 길이 제약(2..6, 경유지 ≤5)은 런타임 검증(A 스트림)으로, 타입엔 `LatLng[]` + JSDoc 명시.
  2. **`RouteLeg` 형태 동결 결정** (advisor 지적 — "스키마 변경 없음"을 맹신 말 것). 현 `RouteLeg = {start,end,mode,durationSec,distanceM,polyline?}`. **(critic C1) 지오메트리 표준 확정: `coords: LatLng[]` 필수 필드 추가, `polyline?`(encoded string)은 제거.** 근거: 카카오모빌리티(vertexes 평면배열)·TMAP(GeoJSON coordinates)·Mapbox(geojson)·ODsay는 좌표 배열을 주고 Google만 encoded polyline — **디코딩은 프록시 정규화 레이어에서 1회 수행**하고 앱은 절대 디코드하지 않는다(앱 폴리라인 코덱 의존 0). 대중교통 leg에 `transit?: { lineName: string; lineType: 'subway'|'bus'|'train'|'express'|'air'; headsign?: string }` 선택 필드 추가 (`'air'`는 ODsay 도시간 응답에서만 생성 — 다른 정규화기는 사용 금지). **(critic 부수) 환승 대기 버퍼 상수를 shared에 동결: `TRANSFER_BUFFER_SEC = 300`** (`packages/shared/src/constants/routing.ts` 신설 — B2 합성·F2 픽스처 산술이 같은 상수를 import). 도보/차/자전거 leg는 transit 미사용. **이 이상은 추가 금지**(YAGNI).
  3. **`routesPath = '/v1/routes'` 상수 추가** + JSDoc.
  4. **프록시 리터럴 제거**: `index.ts`의 GET 4종을 `placesSearchPath`/`placeDetailPath`/`placeGooglePath`/`blogsPath` 상수로 등록하도록 리팩터 (P1 잠복 취약점 봉합). `:id` 파라미터 경로는 빌더 상수와 정합되는 Hono 패턴(`/v1/places/:id`)을 상수 곁 주석으로 고정.
  5. **(critic C2) 모드 디스패치를 Foundation이 소유**: `services/proxy/src/routes/modeHandlers.ts` 신설 — `Record<TravelMode, RouteHandler>` 레지스트리 + 모드별 핸들러 파일 4개(`routeCar.ts`/`routeWalk.ts`/`routeBike.ts`/`routeTransit.ts`)를 **501 stub으로 F1이 생성**. `app.post(routesPath, dispatchRoutes)` 배선. 이후 **A는 car/walk/bike 핸들러 파일만 덮어쓰고, B는 transit 핸들러 파일만 덮어쓴다** — 디스패치 파일·index.ts는 fan-out 후 불가침(동일 파일 동시 편집 원천 차단, P1 F5 stub 핸드오프 패턴).
  6. **introspection 테스트(`contract.test.ts`)**: Hono `app.routes` 배열을 읽어 `{ method, path }` 집합을 만들고, shared가 export하는 모든 경로(정적 상수 + 빌더 + `routesPath` POST)가 등록됐다고 단언. **(critic M1) 빌더 검증 메커니즘 확정**: 빌더는 센티널로 구체화(`placeDetailPath('__SENTINEL__')`)하고, 등록된 Hono 패턴의 `:param` 세그먼트를 동일 센티널로 치환한 문자열과 **정확 일치** 단언 (예: `/v1/places/:id` → `/v1/places/__SENTINEL__` ≡ `placeDetailPath('__SENTINEL__')`). 인코딩 영향 없는 센티널([A-Za-z_]) 사용.
  7. **`apiClient` POST 변형**: `apiPost(path: string, body: unknown): Promise<unknown>` — `fetch(url, { method:'POST', headers:{'content-type':'application/json'}, body: JSON.stringify(body) })`. 데모 모드 가드는 기존 `apiFetch`와 동일.
  8. **(critic M2) 경로용 지역 판정 함수 export**: `packages/shared/src/region/`에 순수 함수 `isKoreaCoord(c: LatLng): boolean`(코어 bbox, 히스테리시스 없음 — 렌더러용 `selectRenderer`와 별개)과 `routeRegion(stops: LatLng[]): 'kr' | 'global'`(전체 stops가 한국 안 → 'kr', 그 외 'global') 추가 + 단위 테스트. A2는 이것만 사용 (private `isInsideCore` 의존·줌 시맨틱 오용 금지).
- **blockedBy:** 없음 (P1 산출 위에서 시작)
- **완료 기준:** `pnpm --filter @wayfinder/shared typecheck` + `pnpm --filter proxy test` green. **`contract.test.ts`가 의도적 누락(예: `routesPath` 등록 주석 처리)을 잡아내는지 1회 검증** (드리프트 = 테스트 실패임을 실증). 기존 162개 테스트 회귀 없음.
- **난이도:** opus (계약 설계 + 회귀 안전)

### F2. 라우팅 목 픽스처 + RouteProvider 계약
- **파일:** `packages/shared/src/mocks/routeFixtures.ts`, `packages/shared/src/mocks/routeProvider.ts`, `packages/shared/src/mocks/index.ts`(export 추가)
- **내용:** §8 전 모드·경유지·시외 케이스를 덮는 결정론적 `Route` 픽스처:
  - 도보 A→B 단순(1 leg), 차 A→B→C 경유지(2 leg, 카카오모빌리티 다중경유지 형태), 자전거 A→B(1 leg),
  - **대중교통 leg-chaining**: A→B→C 3정거장이 환승 버퍼 포함 여러 leg(`transit` 메타 채움)로 합성된 픽스처 — `totalDurationSec = Σ leg + 버퍼` 산술이 픽스처에서 성립,
  - **시외 스티칭**: 서울 출발지→서울역(시내) + 서울역→부산역(KTX, `lineType:'train'`) + 부산역→목적지(시내) 3단 합성 픽스처.
  - **`RouteProvider` 계약** (mock provider — P1 `PlaceProvider` 패턴 그대로): `getRoute(req: RouteRequest): Promise<Route>`. fixture 구현 제공 — **앱 데모 모드와 프록시 테스트 양쪽의 공통 입력**. `mode`+stops 수로 적절한 픽스처 선택.
- **blockedBy:** F1 (RouteRequest·RouteLeg 형태)
- **완료 기준:** `pnpm --filter @wayfinder/shared test` — 모든 픽스처가 `Route` 타입을 만족하고, leg-chaining 픽스처의 총합 산술(Σ+버퍼)이 단언으로 검증되고, `mockRouteProvider.getRoute`가 4모드 전부 + 경유지 + 시외 케이스를 반환.
- **난이도:** sonnet

### F3. 의존성 일괄 설치 (Foundation에서만 — 병렬 워커는 코드만)
- **파일:** `apps/mobile/package.json`, `services/proxy/package.json`, `pnpm-lock.yaml`(델타 커밋)
- **내용:** P2가 추가하는 런타임 의존을 Foundation에서 일괄 설치(P1 교훈 #3). 폴리라인 디코딩(`@googlemaps/polyline-codec` 또는 동등)은 **services/proxy에만 설치** — C1 확정에 따라 디코드는 프록시 정규화 1회뿐, 앱은 `coords`를 그대로 받으므로 mobile에 코덱 의존 0. 경로 입력 UI의 드래그 순서변경은 **Reanimated/gesture-handler 신규 의존 도입 금지**(P1 C3 교훈 — WSL 웹 export 위협) → plain RN 기반 위/아래 버튼식 순서변경으로 구현, 신규 네이티브 피어 0개. **새 네이티브 모듈 의존을 추가하지 않는 것이 기본**; 순수 JS 유틸만 추가.
- **blockedBy:** F1
- **완료 기준:** `pnpm install` 성공(WSL2 폴링 env) + **lockfile 동결 커밋**. `pnpm -r typecheck` green. 추가 의존이 전부 순수 JS(네이티브 피어 0)임을 확인. 의존 미정 시 코드는 자체 구현으로 진행하고 의존 0으로 완료 가능.
- **난이도:** sonnet

> **Foundation 완료 = F1·F2·F3 전부 green + 기존 162 테스트 회귀 없음.** 이후 A~E 동시 시작.

---

## 2. 병렬 스트림 (Foundation 완료 후 5워커 동시 실행)

### 스트림 A — 프록시 라우팅 (자동차·도보·자전거: 다이렉트 모드)
**워커 1 · blockedBy: F1, F2**
경유지 네이티브 지원 모드. 카카오모빌리티(한국 차)·TMAP(한국 도보/자전거)·Google Routes(글로벌)·Mapbox 정규화.

| # | 작업 | 파일 | blockedBy | 완료 기준 | 난이도 |
|---|------|------|-----------|-----------|--------|
| A1 | 경로 정규화 함수 (다이렉트 모드) | `services/proxy/src/normalize/{kakaoMobility,tmapPedestrian,tmapBike,googleRoutes,mapboxDirections}.ts` | F1,F2 | 각 공급자 raw 픽스처(§부록 형식) → `Route`/`RouteLeg` 변환 단위 테스트. encoded polyline → `LatLng[]` 디코드 포함. `pnpm --filter proxy test` | opus |
| A2 | car/walk/bike 핸들러 구현 | `services/proxy/src/routes/{routeCar,routeWalk,routeBike}.ts` (**F1 stub 덮어쓰기** — `modeHandlers.ts`·`index.ts` 수정 금지) | A1 | body `{stops, mode}` 파싱·검증은 공용 `routeValidate`(A3)로, 지역 판정은 **shared `routeRegion(stops)`(F1.8)** 로 — 'kr'=카카오모빌리티/TMAP, 'global'=Google/Mapbox 위임. `@cloudflare/vitest-pool-workers` 통합 테스트(fetch 모킹)로 3모드 × 2지역 정규화 응답 + introspection 테스트(F1) 통과 | opus |
| A3 | 입력 검증 + 장애 격리 | `services/proxy/src/routes/routeValidate.ts`, 미들웨어 재사용 | A2 | stops 수·좌표 유효성·mode 화이트리스트 검증(설계 §1 경계 검증). 공급자 fetch throw 시 silent failure 금지 — 명시적 에러 응답(부분 결과 아님, 단일 경로라 leg 누락 무의미). 단위 테스트 | sonnet |
| A4 | 데모 모드 스위치 (라우팅) | `services/proxy/src/config.ts`(기존 확장) | A2 | 키 env 미설정 시 F2 `mockRouteProvider`로 응답(실 fetch 미발생). `wrangler deploy --dry-run` 키 없이 성공 | sonnet |

### 스트림 B — 프록시 대중교통 (leg-chaining + 시외 스티칭)
**워커 2 · blockedBy: F1, F2** — A와 파일 경계 분리. **(C2 확정 구조)** 디스패치(`modeHandlers.ts`)와 `index.ts`는 F1 소유로 fan-out 후 불가침. B는 **`routes/routeTransit.ts`(F1이 만든 501 stub)를 덮어쓰는 것만으로** transit 모드에 연결된다 — A와 같은 파일을 만질 일이 없음.

| # | 작업 | 파일 | blockedBy | 완료 기준 | 난이도 |
|---|------|------|-----------|-----------|--------|
| B1 | 시내 대중교통 정규화 (단일 구간) | `services/proxy/src/normalize/{odsayTransit,googleTransit}.ts` | F1,F2 | ODsay(한국)·Google transit(글로벌) raw 픽스처 → `RouteLeg[]`(`transit` 메타: lineName/lineType/headsign) 변환. 단위 테스트 | opus |
| B2 | **leg-chaining** 합성 엔진 | `services/proxy/src/routes/routeTransitChain.ts` + `routeTransit.ts`(F1 stub 덮어쓰기) | B1 | §8 핵심: A→B, B→C 구간 독립 탐색(B1) 후 병합. **총 소요 = Σ구간 + `TRANSFER_BUFFER_SEC`(shared 상수 — F1.2 동결, 자체 상수 금지)**. 경유지 ≤5 leg-chain. transit 핸들러(F1 stub)를 체인 엔진으로 교체. 합성 산술·leg 순서·버퍼 적용 단위 테스트(F2 픽스처와 동일 상수 기준) | opus |
| B3 | **시외 3단 스티칭** | `services/proxy/src/routes/routeIntercityStitch.ts` | B1,B2 | §8: `출발지→출발역(시내)` + `도시간(KTX 등, ODsay 도시간)` + `도착역→목적지(시내)` 3단 합성. 도시간 구간 판정(시내 검색 vs 도시간 검색 분기). 3단 leg 순서·역/터미널 좌표 연결 단위 테스트(F2 시외 픽스처) | opus |
| B4 | 대중교통 KV 캐싱 (ODsay 쿼터 방어) | `services/proxy/src/cache/routeCache.ts` | B2 | §11 ODsay 일 1,000건 방어. (stops, mode) 키 정규화 + TTL. 캐시 히트 시 fetch 미발생 단위 테스트. 캐시 키 결정론성 검증 | sonnet |

### 스트림 C — 경로 입력 UI (출발/도착/경유지 + 모드 탭)
**워커 3 · blockedBy: F1, F2 (목 데이터로 동작, A/B 구현 대기 안 함)**

| # | 작업 | 파일 | blockedBy | 완료 기준 | 난이도 |
|---|------|------|-----------|-----------|--------|
| C1 | 경유지 리스트 상태 + 순서변경 로직 | `apps/mobile/src/route/waypoints.ts`, `waypoints.test.ts` | F1 | 출발/도착/경유지(≤5) 추가·삭제·순서변경 **순수 함수**(immutable). 드래그 의존 없이 위/아래 이동 + 5개 한도 단위 테스트. UI 무관 로직 분리 | sonnet |
| C2 | 경로 입력 화면 | `apps/mobile/src/screens/RouteInputScreen.tsx` | C1,F2 | 출발/도착/경유지 입력 필드(검색 결과는 P1 PlaceService 재사용) + 경유지 추가·순서변경(C1) + 제출. plain RN(신규 네이티브 의존 0). 웹 export 렌더 통과 | sonnet |
| C3 | 모드 탭 (도보/대중교통/차/자전거) | `apps/mobile/src/route/ModeTabs.tsx` | F1 | 4모드 segmented control(P1 탭 패턴 재사용, View 기반 자체 구현). 선택 모드 → `RouteRequest.mode` 매핑. 단위 테스트로 4모드 매핑 | sonnet |

### 스트림 D — RouteService + 상태 + 결과 표시
**워커 4 · blockedBy: F1, F2**

| # | 작업 | 파일 | blockedBy | 완료 기준 | 난이도 |
|---|------|------|-----------|-----------|--------|
| D1 | RouteService | `apps/mobile/src/services/RouteService.ts`, `RouteService.test.ts` | F1,F2 | `getRoute(req: RouteRequest): Promise<Route>` — 실 모드=`apiPost(routesPath, req)`(F1 POST 클라이언트 + **`routesPath` import**), 데모 모드=F2 `mockRouteProvider`. 동일 인터페이스. 단위 테스트(모킹 POST + mock provider 양쪽) + **(critic C3) 앱측 와이어 테스트: apiPost 스파이가 `routesPath` 상수(shared import)와 정확히 같은 첫 인자로 호출됨을 단언** — 앱측 리터럴 하드코딩(P1 실제 사고 방향)을 테스트 실패로 만듦 | sonnet |
| D2 | 경로 상태 + 쿼리 + 디바운스 | `apps/mobile/src/state/{routeStore.ts,routeQueries.ts}` | D1 | Zustand(stops·mode·결과) + TanStack Query 훅. **디바운스**(§11 쿼터 방어 — 경유지 편집 중 연속 호출 억제, 디바운스 간격 상수). 캐시 키(stops+mode)·디바운스 동작 단위 테스트 | sonnet |
| D3 | 경로→폴리라인/요약 매핑 | `apps/mobile/src/route/routeToPolylines.ts`, `routeSummary.ts` + 테스트 | F1 | `Route.legs` → `MapPolyline[]` — **`leg.coords`를 그대로 사용(C1 확정: 앱은 디코드하지 않음)**, 모드/노선별 색상. 요약(총 시간/거리, 환승 수, leg별 `transit.lineName`). **`MapPolyline` 적합성 검증**: 다구간·대중교통 라인별 색상이 현 `{id,coords,color?,width?}`로 표현 가능함을 단언. 단위 테스트 | sonnet |
| D4 | 경로 결과 화면 (지도 폴리라인 + 요약 패널) | `apps/mobile/src/screens/RouteResultScreen.tsx` | D2,D3 | `<MapView polylines={...}>`(P1 stub 경로 `src/map/MapView` import만, 수정 금지) + 요약 패널(D3). `fitBounds`로 전체 경로 뷰. 데모 모드 렌더 단위 테스트 | sonnet |

### 스트림 E — 네비게이션 통합 + 웹 게이트
**워커 5 · blockedBy: F1, F3 (스트림 C/D 산출을 후반 통합)**

| # | 작업 | 파일 | blockedBy | 완료 기준 | 난이도 |
|---|------|------|-----------|-----------|--------|
| E1 | 라우트 어댑터 + 네비게이션 배선 | `apps/mobile/app/route/input.tsx`, `apps/mobile/app/route/result.tsx`, `apps/mobile/app/_layout.tsx`(라우트 추가) | F1,F3 | P1 expo-router 구조에 경로 입력·결과 라우트 추가. 홈→경로입력→결과 네비 배선. 빈 stub 우선, C/D 도착 시 연결. 웹 export 라우트 등록 | sonnet |
| E2 | 데모 모드 통합 + 웹 게이트 | E2 스모크 스크립트(P1 `routeFlow.test.ts` 패턴 확장) | E1,C*,D* (**완료된** C/D의 join — 원칙 #1 예외) | 키 0개로 `expo export --platform web` green + **데모 모드 경로 흐름**: 경로입력(출발·도착·경유지 추가·순서변경) → 모드탭 4종 → 결과(폴리라인+요약)가 목 데이터로 동작(웹). leg-chaining 시외 케이스 요약 표시 포함. **이것이 P2 최종 검증 게이트** | opus |
| E3 | 스모크 테스트 분리 (실 라우팅 API) | `services/proxy/smoke/routes.skip.ts` | A2,B2 | 카카오모빌리티·TMAP·ODsay·Google Routes 실 키 스모크는 env-gated 스킵(§부록 형식 실증용). 단위/통합과 분리 CI green 불방해 | sonnet |

---

## 3. 의존 그래프 요약

```
F1 (와이어계약: route스키마+routesPath+introspection테스트+apiClient POST)
 ├─> F2 (라우팅 픽스처 + RouteProvider) ─┬─> A (다이렉트: 차·도보·자전거)  [워커1]
 │                                        ├─> B (대중교통: leg-chaining·시외) [워커2]
 │                                        ├─> C (경로 입력 UI)              [워커3]
 │                                        └─> D (RouteService·결과·디바운스) [워커4]
 └─> F3 (의존 일괄 설치) ─────────────────> E (네비 통합 + 웹 게이트)        [워커5]
```

- **Foundation 임계 경로:** F1 → F2 (순차). F3는 F1 후 병렬.
- **병렬 진입점:** Foundation 완료 즉시 A·B·C·D·E 동시 시작. 스트림 간 `blockedBy` 없음(전부 Foundation으로).
- **A/B 파일 경계 (C2 확정):** 디스패치 `modeHandlers.ts`+`index.ts`+`routeValidate` 슬롯 = **F1(Foundation) 소유, fan-out 후 불가침**. A=`normalize/{kakaoMobility,tmap*,googleRoutes,mapbox}` + `routes/{routeCar,routeWalk,routeBike}.ts`(stub 덮어쓰기), B=`normalize/{odsayTransit,googleTransit}` + `routes/routeTransit.ts`(stub 덮어쓰기)·`routeTransitChain`·`routeIntercityStitch`. A↔B 공유 파일 0개.
- **와이어 계약 강제:** D1이 `routesPath`를 import해 POST → F1 introspection 테스트 범위에 자동 포함. A2가 같은 `routesPath`로 등록. 양측 리터럴 0 → P1 드리프트 재발 불가.
- **MapView 불변:** 경로 표시는 기존 `polylines` prop 사용. D4는 P1 `src/map/MapView` import만, MapView 파일 수정 금지.
- **유일한 스트림 간 통합:** E2(웹 게이트)가 **완료된** C·D 산출을 데모 모드로 묶음 — 원칙 #1 명시적 예외.

---

## 4. P2 완료 기준 (전체 게이트 — 키 0개)

- [ ] `pnpm install` 성공(WSL2 폴링) + **lockfile 동결 커밋**
- [ ] `pnpm -r typecheck` 무오류 (shared / proxy / mobile)
- [ ] `pnpm -r test` 전부 green — **기존 162 테스트 회귀 없음** + 신규: 정규화(차·도보·자전거·대중교통×지역)·**leg-chaining 합성 산술**·**시외 3단 스티칭**·route 검증·디바운스·routeToPolylines·MapPolyline 적합성 단위/통합, **와이어 계약 introspection 테스트**(POST 포함), 외부 API 전부 모킹
- [ ] **`contract.test.ts`가 경로 드리프트(상수 미등록)를 실패로 잡아냄** — 1회 실증
- [ ] `wrangler deploy --dry-run` (proxy) 키 없이 성공 — `POST /v1/routes` 등록
- [ ] `expo export --platform web` (mobile) 성공
- [ ] **데모 모드 웹 흐름**: 경로 입력(출발·도착·경유지 ≤5 추가·순서변경) → 모드 탭(도보·대중교통·차·자전거) → 결과(지도 폴리라인 + 요약 패널, 대중교통 leg-chaining·시외 스티칭 요약 포함)가 목 데이터로 동작
- [ ] 키·시크릿 미포함 — **CI 자동 시크릿 스캔 green**

---

## 5. 사용자 액션 필요 (키 발급 — 빌드/테스트엔 불필요)

> 키 0개로 전체 빌드·단위·통합·웹 export는 데모 모드로 green. 아래는 실 라우팅 데이터·스모크에만 필요.

1. **카카오모빌리티** — 자동차 다중경유지 Directions API(`/v1/waypoints/directions`) 사용 설정. → `wrangler secret` (KAKAO_MOBILITY_KEY).
2. **TMAP (SK open API)** — 보행자 경로 + 자전거 경로 API appKey. → `wrangler secret` (TMAP_APP_KEY).
3. **ODsay** — 대중교통(시내·도시간) API key. 일 1,000건 무료 — 캐싱·디바운스 전제. → `wrangler secret` (ODSAY_API_KEY).
4. **Google Cloud** — Routes API 활성화 + **일일 쿼터 무료 한도 하드캡** + 월 예산 알림(§11). → `wrangler secret` (재사용 가능 시 GOOGLE_ROUTES_KEY).
5. **(선택) Mapbox** — 글로벌 폴백. Directions API 토큰.

---

## 6. 공급자 응답 형식 부록 (워커 fetch 불가 → 지식 기반 픽스처 작성용)

> 아래는 워커가 **실 fetch 없이** 정규화 함수·픽스처를 작성하기 위한 핵심 형식 요약(작성 시점 지식 기준). **byte-perfect 보장 아님 — 실 형식 검증은 §5 스모크/사용자 액션으로 연기.** 정규화 함수는 누락 필드에 방어적으로 동작하도록 작성.

### 카카오모빌리티 다중경유지 (자동차, 한국)
- **요청:** `POST https://apis-navi.kakaomobility.com/v1/waypoints/directions`, 헤더 `Authorization: KakaoAK {REST_KEY}`, body `{ origin:{x,y}, destination:{x,y}, waypoints:[{x,y,name?}], priority, car_fuel?, ... }` (x=경도, y=위도).
- **응답:** `{ routes:[{ result_code, summary:{ distance(m), duration(s) }, sections:[{ distance, duration, roads:[{ vertexes:[x,y,x,y,...] }], guides:[...] }] }] }`. **vertexes는 [lng,lat] 평면 배열** → `RouteLeg.polyline`/`coords`로 변환 시 2개씩 묶어 `{lat,lng}`. waypoint별로 section 분할 → 경유지 leg 매핑.

### TMAP 보행자 경로 (도보, 한국)
- **요청:** `POST https://apis.openapi.sk.com/tmap/routes/pedestrian?version=1`, 헤더 `appKey`, body `{ startX, startY, endX, endY, startName, endName, passList?("x,y_x,y") }` (X=경도, Y=위도, EPSG:4326). 경유지=`passList`.
- **응답:** GeoJSON `{ features:[ { geometry:{ type:'LineString'|'Point', coordinates:[[lng,lat],...] }, properties:{ totalDistance(m), totalTime(s), distance, time, description, ... } } ] }`. LineString feature들을 이어 polyline 구성, properties.totalTime/totalDistance를 leg 합산.

### TMAP 자전거 (자전거, 한국)
- TMAP 보행자와 유사한 GeoJSON 구조 (자전거 경로 엔드포인트). 미가용 구간은 도보 leg-chaining 폴백(§신규 결정). **실 형식 미검증 → open-questions 로깅.**

### ODsay 대중교통 (한국 시내·도시간)
- **요청:** `GET https://api.odsay.com/v1/api/searchPubTransPathT?apiKey={KEY}&SX,SY,EX,EY` (X=경도, Y=위도). 도시간은 `searchPubTransPathT` 결과의 시외 노선 포함.
- **응답:** `{ result:{ path:[ { pathType(1=지하철,2=버스,3=둘다), info:{ totalTime(분), payment, busTransitCount, subwayTransitCount, totalDistance(m) }, subPath:[ { trafficType(1=지하철,2=버스,3=도보), sectionTime(분), distance, lane:[{name,busNo?,subwayCode?}], startName, endName, passStopList? } ] } ] } }`. **subPath 각각이 RouteLeg**(trafficType→lineType, lane[0].name→lineName). 도보 subPath는 환승 도보. **leg-chaining: 구간별 path[0]을 독립 호출 후 subPath들을 이어붙이고 환승 버퍼 추가.**

### Google Routes v2 (글로벌 — 차/도보/자전거/대중교통)
- **요청:** `POST https://routes.googleapis.com/directions/v2:computeRoutes`, 헤더 `X-Goog-Api-Key`, `X-Goog-FieldMask: routes.legs,routes.duration,routes.distanceMeters,routes.polyline`. body `{ origin:{location:{latLng:{latitude,longitude}}}, destination:{...}, intermediates:[{location:...}], travelMode:'DRIVE'|'WALK'|'BICYCLE'|'TRANSIT', polylineEncoding:'ENCODED_POLYLINE' }`. 경유지=`intermediates`(≤25, MVP는 ≤5).
- **응답:** `{ routes:[{ distanceMeters, duration('123s'), polyline:{ encodedPolyline }, legs:[{ distanceMeters, duration, polyline:{encodedPolyline}, steps?, transitDetails? }] }] }`. **encodedPolyline은 Google encoded polyline algorithm** → F3 디코드 유틸로 `LatLng[]`. duration은 `'123s'` 문자열(파싱). transit는 `legs[].steps[].transitDetails.transitLine.name`.

### Mapbox Directions (글로벌 폴백)
- `GET https://api.mapbox.com/directions/v5/mapbox/{driving|walking|cycling}/{lng,lat;lng,lat;...}?access_token=&geometries=geojson&overview=full`. 응답 `{ routes:[{ distance(m), duration(s), geometry:{coordinates:[[lng,lat],...]}, legs:[{distance,duration}] }] }`. waypoint 세미콜론 구분 = 경유지. transit 미지원(대중교통은 Google).

---

## 7. 명시적 한계

- 실 라우팅 API 응답 형식은 fetch 불가 환경에서 지식 기반 문서화 — **byte-perfect 미보장**. 정규화 함수는 방어적 작성, 실 형식 정합은 §5 스모크/사용자 키 발급 후 검증.
- 네이티브 지도 폴리라인 디바이스 렌더는 Mac/실기기 부재로 미검증 — 웹 export가 일상 검증 채널(P1 한계 계승).
- 대중교통 환승 대기 버퍼는 고정 상수(실측 데이터 없음) — Phase 3+ 실시간 교통 연동 시 정밀화.
- 자전거 한국 공급자(TMAP 자전거) 실 형식 미검증 → `open-questions.md` 로깅.
- alternatives·"+N분" 필터는 **Phase 4 범위** — P2는 단일 Route만 반환(투기적 plumbing 금지).
- 경유지 순서변경은 버튼식(드래그 아님) — Reanimated/gesture-handler 신규 네이티브 의존이 WSL 웹 export를 위협하므로 의도적 배제(P1 C3 교훈).
