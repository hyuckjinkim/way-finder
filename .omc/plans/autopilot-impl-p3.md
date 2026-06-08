# wayfinder Phase 3 — 도보 턴바이턴 네비게이션 (GPS 추적 + 이탈 재탐색) (autopilot direct 모드)

> 단일 진실 소스: `docs/superpowers/specs/2026-06-07-map-navigation-app-design.md` (§2 P3 행, §1 제약 — P3+ 모바일 전용·웹은 경로 표시까지)
> 구조 참고: `.omc/plans/autopilot-impl-p4.md` (Foundation 와이어 계약 + 인터페이스 seam 병렬 + 실-모드 테스트 게이트 패턴)
> 작성: 2026-06-08 / 모드: direct (인터뷰 생략, 스펙 승인 완료) / 기반: P1+P2+P4 완료 (커밋 33e1836, 테스트 540개)

---

## 0. 핵심 전제 — 환경 절벽과 검증 무게중심 (실행 워커 필독)

> 사용자 인지 결정(autopilot-state `p3p5Caveat`): **Mac·실기기·에뮬레이터 없음.** P3의 가치는 본질적으로 **실기기 GPS 런타임 동작**인데 그것을 여기서 실행 검증할 수 없다. 사용자는 한계를 알고 "그래도 진행"을 선택했다.

**따라서 이 계획의 무게중심은 "GPS 좌표 시퀀스를 합성 입력으로 받는 순수 로직"이다.** 경로 이탈 감지·다음 턴 계산·재탐색 트리거 판정·거리/베어링 수학·진행률은 **합성 GPS 시퀀스(mock location stream)로 단위 테스트 가능** — 여기에 검증을 싣는다. 실제 expo-location 백그라운드 추적·센서·화면 wake는 **typecheck + 코드 배선 + mock-expo-location 실-모드 분기 테스트**까지만, 디바이스 런타임 동작은 명시적 한계(§8 검증 분류표).

### P1·P2·P4에서 계승한 결정적 교훈 (이번 계획에 강제 반영)

| 교훈 | P3 강제 반영 |
|------|--------------|
| **실-모드 미배선 사고** (P2 B: 핸들러 502, 엔진 green이나 라이브 미연결) | **carry-forward 게이트를 GPS에 적용:** 실 `LocationProvider`(expo-location `watchPositionAsync`) 분기는 **`vi.mock('expo-location')` 실-모드 테스트**(구독 시작 + 업데이트 콜백 매핑 단언)가 완료 기준. **합성 시퀀스 impl은 실 분기 커버리지로 불인정** (LocationService.test.ts의 getCurrentPositionAsync 모킹 패턴 계승·확장). 이것을 안 하면 P2-B "엔진 green, 핸들러 미배선"을 GPS 형태로 재발한다 — **§7 완료 게이트에 명시**. |
| **중복 유틸 산재** | 지오 수학(haversine·bearing·projection·progress)은 **신규 단일 소유**(`packages/shared/src/geo/`). 기존 P4 정규화기의 좌표 헬퍼(`_shared/coords.ts`)와 역할 분리(정규화=좌표 변환, geo=거리/방위 계산). 중복 정의 0. |
| **wire 계약 드리프트** (P1 REJECT) | `RouteLeg.steps?`(턴 데이터) 확장은 **F1 단일 진실 소스 + 하위호환**(P4 `customMeta` 패턴 그대로 — optional, 미존재 시 기존 5개 정규화기·540 테스트 무회귀). 앱·프록시 양측 리터럴 0. |
| **턴 데이터는 정규화 산물이지 디바이스 산물이 아니다** (advisor 지적 — load-bearing) | Valhalla raw 응답의 `maneuvers[]`(`type`·`instruction`·`begin/end_shape_index`·`street_names`)는 **프록시 정규화로 `RouteStep`에 추출** — P4 골든 픽스처(`quietProfile.ts` 등 이미 maneuvers 보유)로 **완전 fixture 테스트 가능**. 이 작업이 "디바이스 필요"로 드리프트하지 않도록 §8 검증표에서 **완전 검증 가능** 칸에 고정. |

---

## 1. 헤드라인 아키텍처 결정 — `RouteStep`은 턴 **위치**를 담는다 (advisor 핵심 지적)

> 작업의 순수 로직 목록에 "**다음 턴까지 거리**"가 있다. 상태 머신은 각 step이 *어디서* 턴하는지 알아야 이 거리를 계산할 수 있다. step에 좌표가 없으면 헤드라인 순수 로직이 계산 불가가 되고 검증 핵심 전체가 붕괴한다.

### 현재 상태 (검증됨)
- 앱-대면 `RouteLeg`는 `coords`(디코드된 폴리라인)만 담고 **턴/maneuver 데이터가 없다.** Valhalla 정규화기(`normalize/valhalla.ts`)는 `trip.legs[].maneuvers[]`를 **버린다** (P4는 폴리라인·소요·거리만 추출).
- Valhalla 골든 픽스처는 maneuvers를 **완전히 보유**: `type`(예: 3=직진, 15=좌회전), `instruction`("Turn left onto 세종대로20길."), `begin_shape_index`/`end_shape_index`(leg `coords` 인덱스), `street_names`.

### 결정: `RouteStep { location, instruction, type, distanceM, streetNames? }` — `RouteLeg.steps?` 선택 필드
- **`location: LatLng` 필수** — Valhalla `begin_shape_index` → 해당 leg `coords[index]`로 도출. 이것이 "다음 턴까지 거리"의 입력. (정확 투영 원하면 `shapeIndex?: number`도 같이.)
- **하위호환 강제:** `RouteLeg.steps`는 **선택**(P4 `customMeta` 패턴 그대로). 미존재 시 기존 5개 정규화기(google/kakao/mapbox/odsay/tmap)·540 테스트 무회귀·무수정. steps 있는 경로(Valhalla 도보)만 네비 가능, 없는 경로는 "네비 미지원" graceful.
- **maneuver-sourced가 1차 접근** (권장). 기하 도출(`coords` 베어링 변화 감지)은 maneuver 추출이 불가능으로 판명될 때만의 폴백 — 이번 Phase는 maneuver-sourced.

### 턴 데이터 출처별 범위 (grep 검증)
| 도보 경로 출처 | maneuver 보유 | P3 범위 |
|----------------|---------------|---------|
| **Valhalla** (한국·커스텀 도보, P4) | ✅ 풍부(`maneuvers[]` 골든 픽스처 보유) | **1차 — steps 추출·정규화** |
| **TMAP** (한국·표준 도보, P2) | Point feature `properties`에 turnType·description 존재(공식), 단 현 정규화기가 버림 + 픽스처 byte-perfect 미보장(P2 한계) | **best-effort 2차** — 픽스처 turnType 있으면 추출, 없으면 §8 post-key. 미추출 시 TMAP 도보는 폴리라인 추종 네비(턴 카드 없이 거리·도착만) |

> **네비는 경로 출처를 가리지 않는다:** 표준 도보=TMAP, 커스텀 도보=Valhalla. 상태 머신은 `steps` 유무에 따라 "턴 안내 풀 네비"(Valhalla) vs "폴리라인 추종 네비"(steps 없는 경로)로 graceful degrade.

---

## 2. 모노레포 레이아웃 (P3 추가)

```
wayfinder/
├─ packages/shared/   # F1: RouteStep 타입 + RouteLeg.steps? 확장 · 네비 상태 타입 · LocationSample 타입
│  └─ src/geo/        # 신규 — haversine·bearing·projection·progress 순수 함수 (단일 소유, 중복 0)
├─ apps/mobile/
│  ├─ src/nav/        # 신규 — 네비 상태 머신(순수) + LocationProvider(실+합성) + 합성 GPS 시퀀스 픽스처
│  ├─ src/screens/    # P3: NavScreen(턴바이턴 UI · 웹은 비활성 안내)
│  ├─ src/services/   # LocationService 확장(watch) · RouteService 재탐색 재호출(기존 getRoute 재사용)
│  ├─ src/state/      # navStore (네비 세션 상태)
│  └─ app/route/      # nav.tsx 라우트 (expo-router 등록)
└─ services/proxy/    # F2: normalize/valhalla.ts에 maneuvers→steps 추출 (정규화만, 라우팅 불변)
```

---

## 3. Foundation (순차 — 모든 스트림 blocking · 와이어 계약 + 인터페이스 + 합성 픽스처)

> **Foundation 경계는 작업이 넘긴 것만 — 확장 금지** (advisor). geo-math *구현*은 Foundation이 아니라 nav-core 스트림(유일 소비자인 상태 머신과 밀결합·공동 테스트). Foundation은 **타입 계약 + 인터페이스 + 합성 픽스처**만.

### F1. 와이어 계약 — RouteStep 타입 + RouteLeg.steps 확장 + 네비 상태 타입 + LocationSample
- **파일 (F1 단독 소유):**
  - `packages/shared/src/types/route.ts` (확장 — `RouteStep` 신규, `RouteLeg`에 `steps?: RouteStep[]` 추가. P4 `customMeta` 하위호환 패턴 그대로)
  - `packages/shared/src/types/nav.ts` (신규 — `LocationSample`, `NavState`/`NavStatus` 타입, `NavProgress`)
  - `packages/shared/src/constants/nav.ts` (신규 — 이탈 임계 거리·도착 반경·재탐색 디바운스 상수)
  - `packages/shared/src/index.ts` (export 추가)
  - `services/proxy/src/normalize/valhalla.test.ts` (확장 — `RouteLeg.steps` 하위호환 스키마 검증: steps 있는/없는 정규화 응답 양쪽 타입 정합. **contract.test.ts가 아님** — 그건 경로 등록 전용이라 스키마 미검증, critic MINOR)
- **내용 (확정 결정):**
  1. **`RouteStep` 정의:** `{ location: LatLng; instruction: string; type: number; distanceM: number; streetNames?: string[]; shapeIndex?: number }`. `location`=턴 시작 좌표(필수, "다음 턴까지 거리"의 입력). `type`=Valhalla maneuver type 코드(JSDoc에 주요 코드 표). `distanceM`=이 step 구간 거리.
  2. **`RouteLeg.steps?: RouteStep[]`** 추가 — **선택**. 미존재=기존 동작(기존 5개 정규화기·P4 Valhalla 폴리라인 경로 불변). steps 있는 경로만 턴 안내 네비.
  3. **`LocationSample` 정의:** `{ coord: LatLng; headingDeg?: number; speedMps?: number; accuracyM?: number; timestampMs: number }`. 실 GPS·합성 시퀀스 공통 표면. expo-location `LocationObject`와 합성 픽스처가 동일 타입으로 수렴.
  4. **`NavState`/`NavStatus`:** `NavStatus = 'idle' | 'navigating' | 'off_route' | 'rerouting' | 'arrived'`. `NavState = { status, activeLegIndex, activeStepIndex, distanceToNextTurnM, distanceRemainingM, durationRemainingSec, nextStep?: RouteStep }`. 상태 머신 출력의 단일 표면 — UI·스토어의 단일 입력.
  5. **네비 상수** (`constants/nav.ts`): `OFF_ROUTE_THRESHOLD_M`(예: 30 — 경로 최근접점에서 이 거리 초과 시 이탈), `ARRIVAL_RADIUS_M`(예: 20 — 도착 판정), `REROUTE_DEBOUNCE_MS`(예: 5000 — 이탈 확정 후 재탐색 호출 억제). shared 단일 진실 소스(UI·상태 머신·스토어 공유).
  6. **하위호환 스키마 테스트(정규화 레이어):** `RouteLeg.steps` 확장이 앱·프록시·shared 타입 양립함을 단언 — **valhalla.test.ts / 정규화기 테스트에서** steps 누락(기존 경로)·존재(Valhalla) 양쪽 타입 정합 단언(P4 customMeta 패턴). *contract.test.ts는 경로 등록만 테스트하므로 스키마 증명에 쓰지 않는다(critic MINOR).*
- **blockedBy:** 없음
- **완료 기준:** `pnpm --filter @wayfinder/shared typecheck` + `pnpm --filter proxy test` green. **기존 540 테스트 회귀 0.** steps 미존재가 contract.test 통과(하위호환), steps 존재도 통과 — 양쪽 실증.
- **난이도:** opus

### F2. Valhalla maneuvers → RouteStep 추출 (정규화만 — 라우팅 불변)
- **파일:** `services/proxy/src/normalize/valhalla.ts` (확장 — maneuvers 파싱 추가) + `valhalla.test.ts` (확장)
- **내용:**
  1. `ValhallaLeg`에 `maneuvers?: readonly ValhallaManeuver[]` 추가. `ValhallaManeuver = { type, instruction, begin_shape_index, end_shape_index, street_names?, length?(km) }`.
  2. **`maneuvers[] → RouteStep[]` 변환:** `begin_shape_index` → 디코드된 leg `coords[begin_shape_index]`가 step `location`. `instruction`→instruction, `type`→type, `length`(km)×1000→distanceM, `street_names`→streetNames. 마지막 도착 maneuver(`type` 도착 코드)는 도착 step.
  3. **하위호환:** maneuvers 부재 응답은 `steps` 미부착(기존 P4 동작 그대로 — 폴리라인만). RouteLeg에 `steps`가 있을 때만 부착.
  4. **골든 픽스처로 검증** — P4 `fixtures/valhalla/quietProfile.ts` 등 maneuvers 보유. step location이 leg coords 위에 있음·instruction·street_names·distanceM 추출을 단위 테스트. **`begin_shape_index`가 coords 길이 범위 내**임을 단언(off-by-one 방지).
  5. **라우팅·핸들러 불변** — `routeDirect.ts`·`valhallaProvider.ts`·`extraMinutesFilter.ts` 미접촉. 정규화 출력만 풍부해진다(steps 추가).
- **blockedBy:** F1 (RouteStep 타입 동결)
- **완료 기준:** `pnpm --filter proxy test` green — Valhalla 정규화 step 추출 단위 테스트 + **기존 Valhalla 폴리라인 테스트 무회귀**(steps는 가산적). step location이 모두 leg coords 범위·한국 bbox 내 실증. 다른 5개 정규화기 무수정·무회귀.
- **난이도:** sonnet

### F3. 합성 GPS 시퀀스 픽스처 (검증 무게중심의 입력)
- **파일:** `apps/mobile/src/nav/fixtures/gpsSequences.ts` + `gpsSequences.test.ts`
- **내용:** 알려진 경로(Valhalla 골든 픽스처의 coords 기반)를 따라가는 **결정론적 `LocationSample[]` 시퀀스** 다종 제작:
  1. **on-route 추종** — 경로 폴리라인을 따라 진행(다음 턴 거리·진행률·도착 판정 검증 입력).
  2. **off-route 이탈** — 경로에서 `OFF_ROUTE_THRESHOLD_M` 초과로 벗어나는 시퀀스(이탈 감지·재탐색 트리거 검증 입력).
  3. **경계 케이스** — 임계 거리 직전(이탈 아님)/직후(이탈), GPS 정확도 나쁜 샘플, 도착 반경 진입.
  4. **결정론·고정 좌표** — 한국 bbox 내. 각 시퀀스에 기대 NavState 전이를 주석으로 명시(테스트 oracle).
- **blockedBy:** F1 (LocationSample 타입 동결)
- **완료 기준:** 시퀀스 픽스처가 타입 정합(LocationSample[]) + 결정론적 + on-route·off-route·도착·경계 케이스 각 ≥1개. 좌표가 P4 Valhalla 골든 픽스처 coords와 정합(같은 경로 추종).
- **난이도:** sonnet

> **Foundation 완료 = F1·F2·F3 전부 green + 기존 540 테스트 회귀 0.** 이후 A·B·C·D 동시 시작.

---

## 4. 병렬 스트림 (Foundation 완료 후 4스트림 동시 — 워커 수는 seam에 맞춤, 기계적 5 복제 금지)

> **인터페이스 seam 병렬화 (P4 계승):** F1이 `NavState`·`LocationProvider`·`RouteStep`을 동결하므로 nav-core(A, 상태 머신)와 LocationProvider(C)·UI(D)가 *인터페이스에 대해* 병렬. geo-math는 A 내부(상태 머신과 밀결합).

### 스트림 A — nav-core lane (지오 수학 + 네비 상태 머신 — 검증의 심장)
**워커 1 · blockedBy: F1, F3 · 난이도 전반 opus**

| # | 작업 | 파일 | blockedBy | 완료 기준 |
|---|------|------|-----------|-----------|
| A1 | 지오 수학 순수 함수 | `packages/shared/src/geo/{distance,bearing,projection}.ts` + 테스트 | F1 | haversine 거리·initial bearing·**경로상 최근접점 투영**(점→폴리라인 세그먼트 수직 투영, 누적 진행률)·진행률. 알려진 좌표쌍으로 정확성 단위 테스트(서울 기준 거리 ±오차 허용). 중복 정의 0(`_shared/coords.ts`와 역할 분리) |
| A2 | 네비 상태 머신 (순수 — 검증 핵심) | `apps/mobile/src/nav/navMachine.ts` + 테스트 | A1,F3 | **`(NavState, LocationSample, Route) → NavState`** 순수 reducer. 활성 leg/step 판정, **다음 턴까지 거리**(현재 위치→nextStep.location, A1 투영), 도착 판정(`ARRIVAL_RADIUS_M`), **경로 이탈 감지**(최근접점 거리 > `OFF_ROUTE_THRESHOLD_M`), **재탐색 트리거 판정**(이탈 확정→`rerouting`). **F3 합성 시퀀스로 전 상태 전이 단위 테스트**(on-route 진행·off-route 이탈·도착·경계). steps 없는 경로는 폴리라인 추종(턴 없이 거리·도착만) graceful |
| A3 | 진행률·남은 거리/시간 | `apps/mobile/src/nav/navProgress.ts` + 테스트 | A2 | 현재 위치 기준 남은 거리(경로 잔여 coords 합)·남은 시간(비례 추정)·진행률 %. 순수 함수·합성 시퀀스 단위 테스트 |

### 스트림 C — LocationProvider lane (실+합성 + 재탐색 재호출)
**워커 2 · blockedBy: F1 (인터페이스 대상 — A 대기 안 함)**

| # | 작업 | 파일 | blockedBy | 완료 기준 | 난이도 |
|---|------|------|-----------|-----------|--------|
| C1 | LocationProvider 인터페이스 + 합성 impl | `apps/mobile/src/nav/locationProvider.ts` + 테스트 | F1 | `LocationProvider { watch(cb: (s: LocationSample)=>void): () => void }`(구독→해지 함수). **합성 impl**: F3 시퀀스를 cb로 방출(setInterval/즉시). 단위 테스트(시퀀스 방출·해지) | sonnet |
| C2 | **실 impl — expo-location watch (carry-forward 게이트)** | `apps/mobile/src/nav/locationProvider.expo.ts` + 테스트 | C1 | `watchPositionAsync` 구독→`LocationSample` 매핑→cb, 해지 시 `subscription.remove()`. **`vi.mock('expo-location')` 실-모드 테스트 필수**(LocationService.test.ts 패턴 확장): 구독 시작·콜백 매핑·해지를 mock으로 단언. **합성 impl은 이 분기 커버리지로 불인정**(P2-B GPS형 재발 방지). 디바이스 cadence/accuracy는 §8 post-key. 백그라운드 추적(`startLocationUpdatesAsync`)·`app.config.ts` background-mode·화면 wake는 **배선+typecheck까지**(디바이스 동작 §8) | opus |
| C3 | 재탐색 사이클 (RouteService 재사용) | `apps/mobile/src/nav/reroute.ts` + 테스트 | C1 | **재탐색 사이클 계약(critic MAJOR — 무한 루프 방지):** (1) **엣지 트리거** — `on_route→off_route` *전이 순간* 1회만 재탐색 시작(레벨 트리거 금지: off_route 매 샘플 발사 방지). (2) **상태 소유** — `reroute()`는 새 `Route` 반환만, 라우트 교체(스토어 active route swap + navMachine 재초기화)는 **스토어/통합 레이어 소유**(reduce 순수 유지). (3) **in-flight 가드** — `rerouting` 중 추가 재탐색 미발사(동시 1개), 완료 후 다음 이탈 평가. (4) **실패 경로** — `getRoute` reject/타임아웃 시 silent 금지: `reroute_failed` + 기존 경로 유지 + 재시도 가능(에러 로깅). (5) `REROUTE_DEBOUNCE_MS` 디바운스. **테스트(`vi.useFakeTimers()` 필수): off_route 연속 N샘플에도 getRoute 1회만(no-storm 실증), 인자=현재위치·목적지·동일 mode/preference, 실패 시 reroute_failed 전이.** 인자 단언만으론 no-storm 미증명 | sonnet |

### 스트림 D — 턴바이턴 UI + 웹 비활성 안내 + 웹 게이트
**워커 3 · blockedBy: F1 (NavState 목 데이터 동작 — A/C 대기 안 함)**

| # | 작업 | 파일 | blockedBy | 완료 기준 | 난이도 |
|---|------|------|-----------|-----------|--------|
| D1 | 턴 안내 카드 + 진행 패널 | `apps/mobile/src/screens/NavScreen.tsx` | F1 | NavState 소비 → **다음 턴 안내 카드**(instruction·다음 턴까지 거리)·**남은 거리/시간**·이탈 시 **재탐색 표시**(`off_route`/`rerouting`). P4 RouteResultScreen MapView·polyline 패턴 재사용(MapView 불변). NavState prop 직접 주입(상태 의존 없이 렌더 테스트). plain RN(신규 네이티브 의존 0 — P2 교훈) | sonnet |
| D2 | 웹 비활성 안내 (`.web.tsx`) | `apps/mobile/src/screens/NavScreen.web.tsx` | D1 | **웹은 턴바이턴 비활성** — 스펙 §1 "P3+ 모바일 전용, 웹은 경로 표시까지". 웹은 "네비게이션은 모바일 앱에서 이용하세요" 안내 + 경로 표시 폴백(P4 RouteResultScreen 재사용). Expo `.web.tsx` 분기. 웹 export 렌더 통과 | sonnet |
| D3 | 라우트 배선 + 웹 게이트 | `apps/mobile/app/route/nav.tsx` + `_layout.tsx`(확장), `apps/mobile/src/screens/navFlow.test.tsx` | D1,D2,A*,C* | expo-router에 nav 라우트 등록(결과 화면→"안내 시작"→NavScreen). 빈 stub 우선, A/C 도착 시 연결. **키 0개 `expo export --platform web` green** + **웹 데모 흐름**: 경로 결과→안내 시작→웹은 비활성 안내(모바일은 합성 시퀀스로 NavScreen 동작). `wake-lock` 신규 의존(`expo-keep-awake`) 도입 시 §6 의존 추가로 플래그 | opus |

### 스트림 B는 없음 — Foundation F2가 정규화 흡수
> P3 턴 데이터는 **프록시 정규화 1회 작업**(F2)이라 별도 병렬 스트림 불요. P4의 provider+orchestration 분리 같은 헤비 이중 lane이 P3엔 없다 — 기계적 5 복제 금지(P2 교훈). **4스트림(A·C·D + Foundation)이 seam에 정합.**

---

## 5. 의존 그래프 요약

```
F1 (RouteStep + RouteLeg.steps? · NavState · LocationSample · 네비 상수 · 하위호환 계약)
 ├─> F2 (Valhalla maneuvers→steps 정규화) ──┐
 ├─> F3 (합성 GPS 시퀀스 픽스처) ───────────┤
 │                                          ├─> A (geo-math + 네비 상태 머신 + 진행률) [워커1·검증 심장]
 ├──────────────────────────────────────────> C (LocationProvider 실+합성 + 재탐색 재호출) [워커2]
 └──────────────────────────────────────────> D (턴바이턴 UI + 웹 비활성 + 웹 게이트) [워커3]
```

- **Foundation 임계 경로:** F1 → (F2 ∥ F3). F2는 RouteStep 타입 후, F3는 LocationSample 타입 후 — F1 완료 즉시 병렬.
- **병렬 진입점:** Foundation(F1·F2·F3) 완료 즉시 A·C·D 동시(3스트림). 스트림 간 직접 `blockedBy`는 D 통합 게이트(D3가 A·C 산출 join) 1곳뿐. 나머지는 전부 Foundation으로만 향한다.
- **불가침 파일:** F2는 `routeDirect.ts`·`valhallaProvider.ts`·`extraMinutesFilter.ts`·`config.ts` 미접촉(정규화 출력만 확장). C는 기존 `RouteService.ts`·`LocationService.ts` 미파괴(재탐색은 getRoute **재사용**, 새 파일에서 호출). D는 `MapView.*` 미접촉(P1·P2·P4 경계 계승).
- **carry-forward 게이트(GPS형):** C2 실 LocationProvider는 `vi.mock('expo-location')` 실-모드 테스트가 완료 기준 — 합성 impl 불인정.

---

## 6. 의존성 추가 (플래그)

- **`expo-location`**: **이미 존재**(`~56.0.16`) — 추가 없음. `watchPositionAsync`·`startLocationUpdatesAsync` 사용.
- **`expo-keep-awake`** (화면 wake): **현재 미설치** — D3 화면 wake 배선 시 신규 의존 추가 필요. 추가 시 lockfile 동결 + 키 0개 빌드·웹 export 무영향 확인. **디바이스 wake 동작은 §8 post-key/에뮬레이터.**
- **백그라운드 추적**: `expo-location` 백그라운드 모드는 `app.config.ts`에 iOS `UIBackgroundModes: ['location']` + Android FOREGROUND_SERVICE 권한 배선 필요 — **배선+typecheck까지**(디바이스 동작 §8).

---

## 7. P3 완료 기준 (전체 게이트)

- [ ] `pnpm install` 성공(WSL2 폴링) + lockfile 동결 (expo-keep-awake 추가 시)
- [ ] `pnpm -r typecheck` 무오류 (shared / proxy / mobile)
- [ ] `pnpm -r test` 전부 green — **기존 540 테스트 회귀 0** + 신규: geo-math(거리/베어링/투영)·네비 상태 머신(합성 시퀀스 전 상태 전이)·진행률·Valhalla steps 정규화·LocationProvider 합성·재탐색 재호출
- [ ] **(carry-forward 게이트) 실 LocationProvider 실-모드 테스트**: `vi.mock('expo-location')`로 `watchPositionAsync` 구독·콜백 매핑·해지 단언 — **합성 시퀀스 테스트 불인정**(P2-B GPS형 미배선 방지)
- [ ] **하위호환 실증**: `RouteLeg.steps` 미존재(기존 5개 정규화기·P4 경로)가 **정규화 테스트(valhalla.test.ts + 기존 정규화기 테스트)** 통과 + 540 무회귀. steps 존재(Valhalla)도 통과 — *스키마 하위호환은 정규화/타입 테스트로 증명*(contract.test는 경로 등록 전용, 스키마 미검증 — critic MINOR)
- [ ] **턴 데이터 정규화 실증**: Valhalla step `location`이 leg coords 범위·한국 bbox 내(off-by-one 0). 중복 geo 정의 0(grep: haversine/bearing 각 1개)
- [ ] `wrangler deploy --dry-run` (proxy) 키 없이 성공 — 정규화 출력 변경(steps)이 응답 계약 유지
- [ ] `expo export --platform web` (mobile) 성공
- [ ] **웹 데모 흐름**: 경로 결과→안내 시작→**웹은 비활성 안내**(스펙 §1) / 모바일은 합성 시퀀스로 NavScreen 턴 카드·진행·이탈 표시 동작(목 데이터)
- [ ] 키·시크릿 미포함 — CI 시크릿 스캔 green

> **명시적 비-게이트(디바이스 필요 — §8):** 실 GPS update cadence/accuracy, 백그라운드 추적 지속, 실 이동 시 이탈 재탐색, 안내 중 화면 wake. 이들은 키+에뮬레이터/실기기 확보 후 별도 QA — P3 "완료"는 위 게이트까지.

---

## 8. 검증 가능 / 디바이스 필요 분류표 (이 계획의 헤드라인 산출 — 작업별)

> 사용자 인지 전제(환경 절벽)의 실행 표현. **검증 무게를 어디에 싣고 무엇을 한계로 분리하는지** 작업별로 가른다.

| 작업 | 분류 | 검증 방법 |
|------|------|-----------|
| 지오 수학 (haversine·bearing·최근접점 투영·진행률) | ✅ **완전 검증 가능** | 알려진 좌표 단위 테스트 |
| 네비 상태 머신 (활성 step·다음 턴 거리·도착·이탈 감지·재탐색 트리거 판정) | ✅ **완전 검증 가능 (검증 심장)** | **합성 GPS 시퀀스(F3)** 전 상태 전이 단위 테스트 |
| 진행률·남은 거리/시간 | ✅ **완전 검증 가능** | 합성 시퀀스 단위 테스트 |
| Valhalla maneuvers → RouteStep 정규화 | ✅ **완전 검증 가능** | P4 골든 픽스처 단위 테스트(디바이스 무관 — 정규화 산물) |
| LocationProvider 합성 impl | ✅ **완전 검증 가능** | 시퀀스 방출·해지 단위 테스트 |
| **LocationProvider 실 impl (watchPositionAsync 구독/매핑/해지)** | ✅ **검증 가능 (mock)** | **`vi.mock('expo-location')` 실-모드 테스트(carry-forward 게이트)** |
| 재탐색 사이클 (엣지 트리거·in-flight 가드·디바운스·실패 경로) | ✅ **검증 가능 (mock + fake timers)** | `vi.useFakeTimers()` no-storm 실증(연속 off_route N샘플→getRoute 1회) + 실패 시 reroute_failed 전이. *단, 실 이동 중 재탐색 런타임은 ❌(아래)* |
| 턴바이턴 UI 렌더·웹 비활성 안내 | ✅ **검증 가능** | NavState prop 주입 렌더 테스트 + 웹 export |
| 백그라운드 추적 배선 (`startLocationUpdatesAsync`·`app.config.ts` background mode) | ⚠️ **배선+typecheck만** | 코드·설정 배선·타입 통과까지 |
| 화면 wake 배선 (`expo-keep-awake`) | ⚠️ **배선+typecheck만** | 의존 추가·배선까지 |
| **실 GPS update cadence/accuracy** | ❌ **디바이스 필요 (post-key/에뮬레이터)** | 별도 QA |
| **백그라운드 추적 지속 (앱 백그라운드 중 위치 갱신)** | ❌ **디바이스 필요** | 별도 QA |
| **실 이동 시 이탈→재탐색 런타임 동작** | ❌ **디바이스 필요** | 별도 QA |
| **안내 중 화면 wake 동작** | ❌ **디바이스 필요** | 별도 QA |

---

## 9. 명시적 한계

- **턴바이턴 = 한국·도보 전용 + Valhalla 경로 우선.** 턴 카드(instruction)는 Valhalla maneuvers 보유 경로(커스텀 도보)에서 풀 동작. TMAP 표준 도보는 maneuver 추출 best-effort — 미추출 시 폴리라인 추종 네비(턴 카드 없이 거리·도착). 글로벌·도보 외 모드 턴바이턴은 P5(전 모드 턴바이턴).
- **웹은 턴바이턴 비활성** — 스펙 §1(웹 백그라운드 GPS 불가·화면 꺼짐). 웹은 경로 표시 + "모바일 앱에서 이용" 안내까지.
- **GPS 런타임 동작 전반 미검증** — Mac·실기기·에뮬레이터 부재. "검증됨"=typecheck+합성 시퀀스 단위 테스트+mock-expo-location 실-분기 테스트+웹 export까지. 실 GPS cadence·백그라운드 지속·실 이동 이탈 재탐색·화면 wake는 **키+에뮬레이터/실기기 확보 후 별도 QA**(§8 ❌ 항목).
- **이탈 임계·도착 반경·재탐색 디바운스 상수는 합성 검증값** — 실 GPS 노이즈 특성 미반영. 실 데이터 튜닝은 디바이스 QA 후(open-question 로깅).
- **TMAP 턴 데이터 픽스처 byte-perfect 미보장** (P2 한계 계승) — TMAP maneuver 추출은 키 발급 후 실 응답으로 검증.

---

## 10. 사용자 액션 필요 / Open Questions (`.omc/plans/open-questions.md`에 기록)

1. **(검증 환경)** P3 실기기 GPS 동작 전반 — 키+에뮬레이터/실기기 확보 후 §8 ❌ 항목 QA. 본 Phase 범위 밖.
2. **(상수 튜닝)** 이탈 임계(`OFF_ROUTE_THRESHOLD_M`)·도착 반경·재탐색 디바운스 — 실 GPS 노이즈로 튜닝 필요.
3. **(TMAP 턴)** TMAP 보행자 Point feature turnType/description 실 형식 — 키 발급 후 검증, 표준 도보 턴 카드 활성화 여부 결정.
4. **(의존)** `expo-keep-awake` 화면 wake 도입 확정 — D3에서 추가 시 lockfile·빌드 무영향 확인.
