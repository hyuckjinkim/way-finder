# wayfinder Phase 5 — 전 모드 턴바이턴 + 음성 안내 + 실시간 교통 (autopilot direct 모드 · **마지막 Phase**)

> 단일 진실 소스: `docs/superpowers/specs/2026-06-07-map-navigation-app-design.md` (§2 P5 행 — "전 모드 턴바이턴 + 음성 안내 + 실시간 교통 → 풀 네비게이션")
> 구조 참고: `.omc/plans/autopilot-impl-p3.md` (§8 검증 분류표 · 실-모드 게이트 · graceful degrade) · `.omc/plans/autopilot-impl-p4.md` (provider seam · 게이트 A fetch-모킹 실-모드 테스트 · 하위호환 optional 필드)
> 작성: 2026-06-08 / 모드: direct (인터뷰 생략, 스펙 승인 완료) / 기반: P1+P2+P3+P4 완료 (커밋 dcee447, 테스트 649개)
> 사용자 인지 전제(autopilot-state `p3p5Caveat` — 두 번 승인): **Mac·실기기·에뮬레이터·API 키 없음.** P5는 **전 Phase 중 검증 가능성이 가장 얇다** — 음성=디바이스 오디오, 실시간 교통=라이브 키 게이트. 이 한계를 알고 "그래도 진행" 선택.

---

## 0. 검증 가능성 표 — 이 계획의 헤드라인 (P3 §8 형식 · 실행 워커 필독)

> **P5 "완료"가 "scaffold + typecheck + 얇은 mock 테스트" 이상으로 읽히지 않게 하는 것이 이 표의 목적.** P5의 검증 무게는 **P3 nav 코어 재사용분**(자동차/자전거 턴바이턴)에만 실린다. 음성·실시간 교통은 **인터페이스 + 배선 + mock까지만**. 아래 4-티어로 정직하게 가른다.

### 검증 티어 (P4 대비 *얇아진 지점*을 명시)

> **P4와의 결정적 차이:** P4는 **로컬 Valhalla 컨테이너로 실-캡처 골든 픽스처**(키 0개·실 데이터)를 가졌다. P5의 신규 데이터원(카카오 car guides·Google maneuver·실시간 교통)은 **로컬 엔진도 키도 없다** → 픽스처가 **지식 기반(P1·P2 충실도, byte-perfect 미보장)**. 이것이 P5 신규 검증이 P4보다 얇은 *구체적* 이유다.

| 티어 | 의미 | P5 해당 작업 |
|------|------|--------------|
| **T0 실-데이터 백킹 (가장 두꺼움)** | P3에서 실증된 순수 로직 재사용 — 신규 데이터 불요 | **네비 상태 머신**(`navReduce`)·지오 수학·진행률 — **이미 mode-agnostic**(§1). 자동차/자전거 경로도 `leg.coords`+`leg.steps?`만으로 무수정 동작 |
| **T1 로직 검증 가능 · 픽스처 충실도는 post-key** | 순수 변환 로직은 단위 테스트로 완전 검증. 단 입력 픽스처가 지식 기반(실 형식 미보장) | **car/bike maneuvers→RouteStep 정규화**(F2)·**안내 문장 생성 함수**(S1)·**실시간 교통 정규화**(T1) |
| **T2 인터페이스+배선+mock만** | 디바이스/네트워크 부수효과는 인터페이스 뒤로 격리·mock으로 호출 단언. 실 부수효과 미실행 | **실 음성 발화**(`expo-speech.speak` — vi.mock 게이트)·**실 교통 fetch**(fetch-mock 게이트, 경로 존재 시) |
| **T3 디바이스/키 필요 (비-게이트)** | P5 "완료" 범위 밖 — 키+에뮬레이터/실기기 확보 후 별도 QA | **실 오디오 출력**·**실시간 교통 실 데이터**·**자동차/자전거 실 GPS 네비 런타임** |

### 작업별 분류표

| 작업 | 티어 | 검증 방법 |
|------|------|-----------|
| 네비 상태 머신·지오 수학·진행률 (자동차/자전거 경로에 적용) | **T0** | **P3 합성 GPS 시퀀스(`gpsSequences.ts`) 재사용 — 머신 무수정.** car/bike 경로 픽스처를 입력으로 동일 reducer 전이 단언 |
| 자동차 maneuvers → RouteStep 정규화 (kakao guides·Google navigationInstruction) | **T1** | 지식 기반 car 픽스처 단위 테스트. step location이 leg coords 범위·한국/글로벌 bbox 내. **type 코드스페이스 정규화 단언**(§1.2) |
| 자전거 maneuvers → RouteStep (best-effort) | **T1** | tmapBike stub·글로벌 픽스처 — 추출 가능 시 단위 테스트, 미추출 시 폴리라인 추종 graceful (P3 TMAP 도보 패턴) |
| 모드별 안내 문장 생성 (RouteStep → **음성 텍스트**) | **T1** | **순수 함수** — `(RouteStep, mode) → string` 단위 테스트(자동차=차선/회전, 도보=보행 어휘 차이). 디바이스 무관. **소비자=VoiceGuide(S2)만** — 턴 카드는 기존 `RouteStep.instruction` 유지(U1 불변, critic Major a: 카드 텍스트는 P5 범위 밖·소유자 없음 방지). 모드별 카드 텍스트는 별도 후속 |
| 실시간 교통 정규화 (traffic→leg 메타) | **T1** | 지식 기반 traffic 픽스처 단위 테스트. 정규화·혼잡도 매핑 |
| VoiceGuide 합성 impl (mock spy) | **T1** | spy 호출·발화 큐 순서 단위 테스트 |
| **실 음성 — `expo-speech.speak` 배선** | **T2** | **`vi.mock('expo-speech')` 실-모드 테스트(carry-forward 게이트)** — `speak()`가 생성 문장으로 호출됨 단언. 합성 spy는 이 분기 불인정(P3 `locationProvider.expo` 게이트 형) |
| **실 교통 fetch 배선** (실 경로 존재 시) | **T2** | **fetch-모킹 실-모드 테스트(P4 게이트 A)** — 핸들러가 실제로 정규화기 호출 단언 |
| 음성 토글·교통 표시 UI (NavScreen 확장) | **T1** | prop 주입 렌더 테스트 + 웹 export |
| **실 오디오 출력 (디바이스 스피커 발화)** | **T3** | ❌ 디바이스 필요 — post-key/에뮬레이터 별도 QA |
| **실시간 교통 실 데이터 (라이브 키)** | **T3** | ❌ 키 필요 — 무료 티어 viability 미확정(§1.3, open-question) |
| **자동차/자전거 실 GPS 네비 런타임 (이탈·재탐색 실 이동)** | **T3** | ❌ 디바이스 필요 — P3 §8 ❌ 항목 계승 |

> **명시적 비-게이트(디바이스/키 필요 — T3):** 실 오디오 발화, 실시간 교통 실 데이터, 자동차/자전거 실 이동 네비. 이들은 키+에뮬레이터/실기기 확보 후 별도 QA(§누적 백로그). **P5 "완료"는 T0·T1·T2 게이트까지.**

---

## 1. 헤드라인 아키텍처 결정 (작업이 넘긴 프레이밍의 정정 3건 — advisor·1차 출처 검증)

### 1.1 "전 모드 턴바이턴"은 **상태 머신 확장이 아니라 정규화기 작업이다** (프레이밍 정정 #1)

> 작업 지시는 "P3 navMachine을 자동차/자전거로 확장"이라 했으나, **코드 검증 결과 navMachine은 이미 mode-agnostic이다.** `navReduce(prev, sample, route)`는 `leg.coords`(폴리라인 투영·이탈·진행)와 `leg.steps?`(다음 턴)만 소비한다 — mode 분기 0(`navMachine.ts:83~143` 확인). `RouteStep`·`RouteLeg.steps?`도 **P3 F1에서 이미 정의·동결**(`route.ts:67~126`).

**따라서 "전 모드 턴바이턴" = 자동차/자전거 정규화기에 `steps[]`를 채우는 것 + 모드별 안내 어휘 함수.** 상태 머신·와이어 타입 신규 0.
- **검증 정직성 함의:** 네비 머신의 검증된 코어는 **P3에서 상속**(T0). P5는 거기에 실-데이터 무게를 거의 더하지 않는다 — P5의 신규 무게는 **정규화기 step 추출(T1)**에만 있고, 그 픽스처는 지식 기반(실 형식 미보장).
- **현 상태(grep 검증):** `normalize/kakaoMobility.ts`는 maneuvers 미파싱(car leg에 steps 없음). `normalize/googleRoutes.ts`는 `navigationInstruction` 미추출(steps 없음). **car/bike 라우팅 픽스처는 0개** (`fixtures/`에 kakaoLocal·googleTransit·odsayTransit만, car directions 픽스처 부재). → P5가 **car 픽스처 신규 + step 추출 신규**.

### 1.2 `RouteStep.type` 코드스페이스 충돌 — **F1에서 provider-agnostic maneuver enum 도입** (프레이밍 정정 #2 · load-bearing)

> **현재 `RouteStep.type: number`는 Valhalla 전용 numeric maneuver 코드로 문서화**(`route.ts:74~80`: "2=출발, 4=도착, 8=직진, 10=우회전, 15=좌회전"). **자동차 공급자는 이 코드스페이스를 공유하지 않는다**(1차 출처):
> - **Google Routes** `computeRoutes`: `legs[].steps[].navigationInstruction.maneuver`는 **문자열 enum**(`TURN_LEFT`·`TURN_RIGHT`·`STRAIGHT`·`DEPART`·`MERGE`·`ROUNDABOUT_*` 등) + `.instructions`(텍스트). 필드마스크 `routes.legs.steps.navigationInstruction` 필요.
> - **카카오 모빌리티** car directions: `sections[].guides[]`가 **자체 numeric `type` 코드** + `guidance`(텍스트) + `x`/`y`(턴 좌표) + `distance`.

**`RouteStep.type: number`를 그대로 car에 재사용하면 wire 드리프트**(서로 다른 코드스페이스가 같은 필드에 충돌 — 안내 어휘·아이콘 함수가 `type`을 키로 분기하므로 load-bearing). **결정(F1 확정):**
- **`RouteStep`에 provider-agnostic 정규화 enum `maneuver?: ManeuverKind` 추가**(optional — 하위호환; `'depart'|'turn-left'|'turn-right'|'straight'|'slight-left'|'slight-right'|'uturn'|'roundabout'|'merge'|'fork'|'arrive'|'unknown'`). 안내 어휘·아이콘 함수는 **이 정규화 enum만** 키로 쓰되 미존재 시 instruction 폴백(공급자 무관).
- **`type: number`는 raw 보존 필드로 격하**(Valhalla numeric / kakao numeric 원값 — 디버그·후속용). **선택화**(`type?: number`) — 비-Valhalla 공급자는 numeric 코드가 의미 다르므로 raw만 보존. Google은 numeric 코드 자체가 없어 `type` 부재 가능.
- **하위호환:** P3 Valhalla 추출기(`valhalla.ts extractSteps`)는 `maneuver` 매핑 추가(numeric→enum 테이블) + 기존 `type` 보존. **기존 649 테스트 무회귀** — `maneuver`는 가산 필드. RouteStep 소비자(`navMachine`·`NavScreen`)는 `type` 미사용이라 영향 0(`navMachine`은 location·instruction만 씀).

### 1.3 실시간 교통 — **무료 티어 viability 미확정 → 인터페이스+픽스처로 한정** (프레이밍 정정 #3 · 1차 출처)

> 스펙 §11 = **무료 티어 기준 개발 확정.** **Google traffic-aware 라우팅(`routingPreference: TRAFFIC_AWARE`/`TRAFFIC_AWARE_OPTIMAL`)은 상위 SKU**(Routes Advanced/Preferred)로 **무료 Essentials가 아니다.** 카카오 모빌리티 실시간 교통도 무료 한도·제공 범위 미확정.

**결정:** P5 실시간 교통은 **데이터 인터페이스 + 정규화(픽스처 테스트, T1) + 표시 배선까지**만. **실 데이터·라이브 fetch는 무료 티어 viability 확정 후**(open-question — **deferred 가능**). 계획은 라이브 교통을 약속하지 않는다 — `RouteLeg`에 선택 `traffic?` 메타를 더하고(steps·customMeta 하위호환 패턴), 정규화·표시를 픽스처로 행사. 실 fetch 경로가 생기면 §T2 fetch-모킹 게이트 적용.

### 1.4 "전 모드"의 경계 — 대중교통은 leg-기반(턴바이턴 아님) (스코프 명시)

> 작업이 안 짚은 경계: **자동차·자전거 = 진짜 턴바이턴**(maneuver steps). **대중교통은 turn-by-turn이 아니라 leg-기반**(탑승/하차/환승 안내). 음성 안내는 transit에선 "다음 정류장 N개·하차" 수준이고 회전 안내가 아니다. **P5 "전 모드 턴바이턴"은 자동차+자전거+도보(P3)** — transit은 별도 leg-안내(범위 내이나 회전 카드 아님). 이 경계를 명시해 transit 회전 안내 과약속을 막는다.

---

## 2. 모노레포 레이아웃 (P5 추가/확장)

```
wayfinder/
├─ packages/shared/
│  └─ src/types/route.ts   # F1: RouteStep.maneuver(ManeuverKind enum) + type? 격하 · RouteLeg.traffic? 메타 (하위호환 optional)
│  └─ src/constants/nav.ts # F1: 모드별 안내 어휘 상수(선택) · 음성 발화 디바운스 상수
├─ services/proxy/
│  └─ src/normalize/kakaoMobility.ts  # F2: car guides → RouteStep[] 추출 (정규화만, 라우팅 불변)
│  └─ src/normalize/googleRoutes.ts   # F2: navigationInstruction → RouteStep[] (글로벌 car/bike)
│  └─ src/normalize/valhalla.ts       # F1: maneuver enum 매핑 추가 (numeric→ManeuverKind, type 보존)
│  └─ src/normalize/tmapBike.ts       # B: bike best-effort step (stub 확장 — 미추출 시 폴리라인)
│  └─ src/normalize/traffic.ts        # T: 실시간 교통 정규화 (신규, 픽스처 테스트)
│  └─ test/fixtures/                   # F3: car/bike maneuvers 지식 기반 픽스처(신규) + traffic 픽스처 (정규화기 픽스처 관례)
├─ apps/mobile/
│  └─ src/nav/voiceGuide.ts           # S: VoiceGuide 인터페이스 + 합성(mock) impl
│  └─ src/nav/voiceGuide.expo.ts      # S: 실 impl (expo-speech) — vi.mock 게이트
│  └─ src/nav/navInstructionText.ts   # S: (RouteStep, mode) → 안내 문장 순수 함수
│  └─ src/screens/NavScreen.tsx       # U: 음성 토글 · 교통 표시 (NavState/Route prop 확장)
└─ (navMachine·navProgress·gpsSequences·locationProvider — P3 무수정 재사용)
```

> **불가침(P3·P4 경계 계승):** `navMachine.ts`·`navProgress.ts`·`gpsSequences.ts`·`locationProvider.*` 미접촉(mode-agnostic — 무수정 동작). `modeHandlers.ts`·`routeDirect.ts`·`index.ts`·`config.ts` 디스패치 배선 미접촉(F1 외). `MapView.*` 미접촉.

---

## 3. Foundation (순차 — 모든 스트림 blocking · 와이어 계약 + maneuver enum + car/traffic 픽스처)

> **Foundation 경계 = 타입 계약 + 지식 기반 픽스처만**(P3 패턴). 안내 어휘 *구현*은 Foundation 아님(소비자 S 스트림과 밀결합). Foundation은 **계약 + enum 매핑 + 픽스처**.

### F1. 와이어 계약 — ManeuverKind enum + RouteStep.maneuver + RouteLeg.traffic? + Valhalla 매핑
- **파일 (F1 단독 소유):**
  - `packages/shared/src/types/route.ts` (확장 — `ManeuverKind` 신규, `RouteStep.maneuver?` **선택** 추가·`type?` 격하, `RouteLeg.traffic?` 메타 추가)
  - `packages/shared/src/index.ts` (export 추가)
  - `services/proxy/src/normalize/valhalla.ts` (`extractSteps`에 numeric→ManeuverKind 매핑 추가, 기존 `type` 보존)
  - `services/proxy/src/normalize/valhalla.test.ts` (확장 — `maneuver` 매핑 단언 + 기존 무회귀)
- **내용 (확정 결정 — §1.2):**
  1. **`ManeuverKind` 정의:** `'depart'|'turn-left'|'turn-right'|'slight-left'|'slight-right'|'straight'|'uturn'|'roundabout'|'merge'|'fork'|'arrive'|'unknown'`. **공급자 무관 정규화 enum** — 안내 어휘·아이콘 함수의 단일 키.
  2. **`RouteStep` 변경:** `maneuver?: ManeuverKind`(신규 **선택** — critic Critical: 필수면 기존 인라인 `RouteStep` 리터럴(`gpsSequences.ts`·`navMachine.test.ts`·`navFlow.test.tsx`)이 strict typecheck에서 깨져 "649 무회귀"와 모순. P4 `customMeta`·P3 `steps?` 하위호환 패턴 그대로 optional). `type?: number`(raw 보존, 선택). 기존 정규화기(Valhalla)는 `maneuver`를 항상 채우지만 타입은 optional이라 기존 리터럴 무수정. S1 안내 문장은 `maneuver` 미존재 시 `instruction` 원문 폴백(이미 §S1 계약). `location`·`instruction`·`distanceM`·`streetNames?`·`shapeIndex?` 불변(P3). JSDoc에 "`maneuver`=정규화 enum(소비자 키, optional), `type`=공급자 raw numeric(디버그)".
  3. **`RouteLeg.traffic?` 메타:** `{ congestion?: 'free'|'slow'|'jam'; delaySec?: number }` 선택 — steps·customMeta 하위호환 패턴. 미존재=교통 정보 없음(기존 동작). 실시간 교통 정규화(T)·NavScreen 표시(U)의 단일 표면.
  4. **Valhalla numeric→ManeuverKind 매핑** (`valhalla.ts`): 2→depart, 4→arrive, 8→straight, 10→turn-right, 15→turn-left 등(JSDoc 표). 미매핑 코드→`unknown`. **기존 `type` 보존**(가산). **기존 649 테스트 무회귀** — `maneuver`는 추가 **optional** 필드, 기존 인라인 `RouteStep` 리터럴(maneuver 미기재) 무수정 통과, 소비자(`navMachine`·`NavScreen`)는 `type`·`maneuver` 미의존이라 영향 0.
- **blockedBy:** 없음
- **완료 기준:** `pnpm --filter @wayfinder/shared typecheck` + `pnpm --filter proxy test` green. **기존 649 테스트 회귀 0.** Valhalla 픽스처가 `maneuver` enum으로 매핑됨 단언(예: 좌회전 maneuver→`'turn-left'`). `type` 원값 보존 단언.
- **난이도:** opus

### F2. 자동차/자전거 maneuvers → RouteStep 정규화 (정규화만 — 라우팅 불변)
- **파일:** `services/proxy/src/normalize/kakaoMobility.ts`·`googleRoutes.ts`·`tmapBike.ts` (확장) + 각 테스트
- **내용:**
  1. **카카오 car** (`kakaoMobility.ts`): `sections[].guides[]` 파싱 — `guides[].x`/`y`(턴 좌표·WGS84? 확인 필요·open-question)→`location`, `guidance`→instruction, `type`(kakao numeric)→`maneuver`(매핑 테이블)+`type` raw 보존, `distance`→distanceM. **하위호환:** guides 부재 응답은 steps 미부착(기존 폴리라인 동작 — `kakaoMobility.ts:52~64` 불변 경로 유지).
  2. **Google car/bike** (`googleRoutes.ts`): `legs[].steps[].navigationInstruction.maneuver`(문자열 enum)→`maneuver`(enum 직접 매핑), `.instructions`→instruction, `startLocation`(또는 `polyline` 첫 점)→`location`, `distanceMeters`→distanceM. **필드마스크 확장 필요**(`routes.legs.steps.navigationInstruction`·`routes.legs.steps.startLocation`) — 실 호출 시 적용(픽스처는 지식 기반). steps 부재 시 미부착.
  3. **bike best-effort** (`tmapBike.ts` — 현재 stub): TMAP 자전거 maneuver 추출 가능 시 step 부착, 불가 시 폴리라인 추종(P3 TMAP 도보 graceful 패턴). bike는 이중 불확실(스펙 KR bike 공급자 TBD + tmapBike stub) — **best-effort, 미추출=폴리라인 네비**.
  4. **type 코드스페이스 정규화 단언**(§1.2 load-bearing): kakao numeric·Google 문자열이 **동일 `maneuver` enum으로 수렴**함을 픽스처 테스트로 단언. step location이 leg coords 범위·한국/글로벌 bbox 내(off-by-one 0).
  5. **라우팅·핸들러 불변** — `routeCar.ts`·`routeBike.ts`·`routeDirect.ts`·`modeHandlers.ts` 미접촉. 정규화 출력만 풍부(steps 추가).
- **blockedBy:** F1 (ManeuverKind·RouteStep.maneuver 동결), F3 (car/bike 픽스처)
- **완료 기준:** `pnpm --filter proxy test` green — car/bike step 추출 단위 테스트 + **기존 정규화기 무회귀**(steps 가산적). guides/navigationInstruction 부재 픽스처는 steps 미부착(하위호환). 다른 정규화기 무수정.
- **난이도:** sonnet

### F3. car/bike maneuvers + traffic 지식 기반 픽스처 (T1 충실도 한계 명시)
- **파일:** `services/proxy/test/fixtures/{kakaoCarGuides,googleCarSteps,tmapBikeGuides,traffic*}.ts` + 픽스처 테스트 (critic Major b: 정규화기 raw 픽스처는 `test/fixtures/` 관례 — P2의 kakaoMobility/google/tmap 픽스처와 동일 위치. `src/fixtures/`는 Valhalla 골든 전용이었음)
- **내용:** **지식 기반 픽스처**(P1·P2 충실도 — **byte-perfect 미보장**, 키 없어 실 캡처 불가. P4 Valhalla 실-캡처와의 핵심 차이 §0):
  1. **카카오 car guides 픽스처** — `sections[].guides[]`(type numeric·guidance·x·y·distance) 구조. 서울 좌표 결정론적.
  2. **Google car/bike steps 픽스처** — `legs[].steps[].navigationInstruction`(maneuver 문자열·instructions) + startLocation. 글로벌 좌표.
  3. **bike 픽스처** — TMAP 자전거 best-effort(maneuver 있는/없는 양형).
  4. **traffic 픽스처** — 혼잡도·지연 응답 형태(공급자 형식 추정 — open-question으로 실 형식 미검증 플래그).
  5. **결정론·고정 좌표** + 각 픽스처에 기대 RouteStep 추출 결과 주석(테스트 oracle). **"지식 기반·실 형식 키 발급 후 검증" 헤더 주석 필수**(P2 한계 계승).
- **blockedBy:** F1 (RouteStep 형태 동결)
- **완료 기준:** car/bike maneuver 픽스처·traffic 픽스처 각 ≥1개. 타입 정합·결정론. **충실도 한계 헤더 주석 존재**(byte-perfect 미보장 명시).
- **난이도:** sonnet

> **Foundation 완료 = F1·F2·F3 전부 green + 기존 649 테스트 회귀 0.** 이후 S·T·U 동시 시작.

---

## 4. 병렬 스트림 (Foundation 완료 후 — 워커 수는 seam에 맞춤, 기계적 복제 금지)

> **seam:** F1이 `ManeuverKind`·`RouteStep.maneuver`·`RouteLeg.traffic?`를 동결하므로 음성(S)·교통(T)·UI(U)가 *인터페이스에 대해* 병렬. **3스트림이 seam에 정합** — car/bike 정규화는 Foundation(F2)이 흡수(P3에서 "전 모드 턴바이턴"이 정규화 작업임이 §1.1로 확정 → 별도 헤비 lane 불요).

### 스트림 S — 음성 안내 lane (안내 문장 순수 함수 + VoiceGuide 인터페이스 + 실 impl 게이트)
**워커 1 · blockedBy: F1**

| # | 작업 | 파일 | blockedBy | 완료 기준 | 난이도 |
|---|------|------|-----------|-----------|--------|
| S1 | 안내 문장 생성 (순수 함수 — T1 검증 핵심) | `apps/mobile/src/nav/navInstructionText.ts` + 테스트 | F1 | **`(RouteStep, mode: TravelMode) → string`** 순수 함수. `maneuver?` enum + distanceM으로 문장 합성(예: "200m 앞에서 좌회전"). **모드별 어휘 차이**: 자동차=차선/회전 어휘, 도보=보행 어휘. `mode`는 호출자가 `route.legs[activeLegIndex].mode`로 전달(critic minor: `NavState`에 `mode` 필드 없음 — leg에서 도출). **합성 입력 단위 테스트**(디바이스 무관). instruction 원문 우선·`maneuver` 없거나 instruction 없으면 enum 기반 폴백 | sonnet |
| S2 | VoiceGuide 인터페이스 + 합성 impl | `apps/mobile/src/nav/voiceGuide.ts` + 테스트 | S1 | `VoiceGuide { speak(text: string): void; stop(): void }`. **합성 impl**=mock spy(발화 큐·중복 억제). 발화 디바운스(동일 step 재발화 금지). 단위 테스트(spy 호출·순서·중복 억제) | sonnet |
| S3 | **실 impl — expo-speech (carry-forward 게이트)** | `apps/mobile/src/nav/voiceGuide.expo.ts` + 테스트 | S2 | `expo-speech.speak(text, {language:'ko'})` 배선. **`vi.mock('expo-speech')` 실-모드 테스트 필수**(P3 `locationProvider.expo` 게이트 형) — `speak()`가 S1 생성 문장으로 호출됨·`stop()` 매핑 단언. **합성 spy impl은 이 분기 커버리지 불인정**(P1~P4 실-모드 미배선 패턴 방지). **`expo-speech` 신규 의존 추가** — lockfile 동결 + 키 0개 빌드·웹 export 무영향 확인(§6). **실 오디오 출력은 T3 디바이스**. **웹 격리:** `expo-speech`는 `.expo.ts`에만 top-level import(NavScreen이 expo-location 격리한 패턴 — 웹 번들이 끌어오지 않게) | opus |

### 스트림 T — 실시간 교통 lane (정규화 + 표시 메타 · 라이브는 인터페이스까지)
**워커 2 · blockedBy: F1, F3**

| # | 작업 | 파일 | blockedBy | 완료 기준 | 난이도 |
|---|------|------|-----------|-----------|--------|
| T1 | 교통 정규화 (T1 검증) | `services/proxy/src/normalize/traffic.ts` + 테스트 | F1,F3 | traffic 응답 → `RouteLeg.traffic` 메타(congestion·delaySec) 정규화. **지식 기반 픽스처 단위 테스트**. 혼잡도 매핑·지연 산출. 입력 부재 시 메타 미부착(하위호환) | sonnet |
| T2 | 교통 배선 (라이브는 인터페이스+mock까지) | `services/proxy/src/routes/` (car 경로에 traffic 합성 — 기존 핸들러 미파괴, 신규 보조 모듈) | T1 | **무료 티어 viability 미확정(§1.3)** — 라이브 fetch는 **인터페이스+배선까지**. 실 fetch 경로 존재 시 **fetch-모킹 실-모드 테스트(P4 게이트 A)**로 핸들러→정규화기 호출 단언. **viability 미확정 시 deferred**(open-question) — 픽스처 정규화·표시 메타는 완료, 라이브 데이터는 키 후. `routeDirect.ts`·`config.ts` 미접촉 | sonnet |

### 스트림 U — UI lane (음성 토글 + 교통 표시 + 웹 게이트)
**워커 3 · blockedBy: F1 (NavState/Route 목 데이터 동작 — S/T 대기 안 함)**

| # | 작업 | 파일 | blockedBy | 완료 기준 | 난이도 |
|---|------|------|-----------|-----------|--------|
| U1 | 음성 토글 + 교통 표시 | `apps/mobile/src/screens/NavScreen.tsx` (확장) | F1 | NavScreen에 **음성 on/off 토글**(상태만 — 발화 주입은 통합 레이어, NavScreen은 expo-speech 미import·웹 안전 유지) + **교통 표시**(`Route`/`RouteLeg.traffic` 소비 — 혼잡 구간 색/배지). prop 주입 렌더 테스트(상태 의존 없이). **plain RN·신규 네이티브 의존 0**(P2 교훈). 기존 NavScreen 턴 카드·진행 패널 불변 | sonnet |
| U2 | 통합 배선 + 웹 게이트 | `apps/mobile/src/nav/navSession.ts`(또는 navStore 확장) + `navFlow.test.tsx`(확장) | U1,S*,T* | 토글 on이면 VoiceGuide(S)를 navMachine step 전이에 연결(다음 턴 변경 시 발화) — **통합 레이어 소유**(navMachine 순수 유지·P3 경계). 빈 stub 우선, S/T 도착 시 연결. **키 0개 `expo export --platform web` green** + **웹 데모 흐름**: 자동차 경로 결과→안내 시작→웹 비활성 안내(P3 §1 모바일 전용 계승)/모바일은 합성 시퀀스로 NavScreen 턴 카드·교통·음성 토글 동작(목). **`expo-speech` 웹 번들 미포함 확인** | opus |

> **스트림 형태 정당화(P2 "기계적 복제 금지"):** P5는 3스트림(S·T·U). car/bike 턴바이턴은 §1.1로 정규화 작업임이 확정돼 Foundation(F2)이 흡수 — 별도 4번째 lane 불요. P4의 provider+orchestration 이중 헤비 lane도 P5엔 없다.

---

## 5. 의존 그래프 요약

```
F1 (ManeuverKind enum · RouteStep.maneuver+type? · RouteLeg.traffic? · Valhalla 매핑 · 649 무회귀)
 ├─> F2 (car/bike maneuvers→RouteStep 정규화 — kakao guides·Google navInstruction·tmapBike best-effort) ──┐
 ├─> F3 (car/bike + traffic 지식 기반 픽스처) ──────────────────────────────────────────────────────────┤
 │                                                                                                        │
 ├──> S (안내 문장 순수함수 → VoiceGuide 인터페이스 → 실 expo-speech 게이트) [워커1]                        │
 ├──> T (교통 정규화 → 배선·라이브 인터페이스까지) [워커2] ←─────────────────────────────────────────────┘
 └──> U (음성 토글·교통 표시 NavScreen → 통합 배선·웹 게이트) [워커3·S/T join]
```

- **Foundation 임계 경로:** F1 → (F2 ∥ F3). F2=정규화(픽스처 후), F3=픽스처(타입 후) — F1 완료 즉시 병렬.
- **병렬 진입점:** Foundation(F1·F2·F3) 완료 즉시 S·T·U 동시(3스트림). 유일 join=U2(통합 배선이 S·T 산출 결합).
- **재사용(무수정):** `navMachine`·`navProgress`·`gpsSequences`·`projectToPath`·`haversineDistanceM` — **mode-agnostic이라 자동차/자전거 경로에 무수정 적용**(§1.1 · T0 검증 무게중심).
- **불가침 파일:** F2는 `routeCar.ts`·`routeBike.ts`·`routeDirect.ts`·`modeHandlers.ts`·`config.ts` 미접촉(정규화 출력만 확장). S는 `expo-speech`를 `.expo.ts`에만 격리(웹 안전). T는 `config.ts`·`routeDirect.ts` 미접촉. U는 `MapView.*`·`navMachine` 미접촉.
- **carry-forward 게이트(3개 실 분기 — advisor):** ① 음성 `vi.mock('expo-speech')` ② 교통 fetch-mock(실 경로 존재 시) ③ car/bike는 정규화라 fetch-mock 핸들러 게이트는 기존 P4 car 핸들러 경로 계승. **합성/데모 테스트는 실 분기 불인정.**

---

## 6. 의존성 추가 (플래그)

- **`expo-speech`**: **현재 미설치** — S3 실 음성 배선 시 신규 의존 추가 필요. 추가 시 lockfile 동결 + **키 0개 `expo export --platform web` 무영향 확인**(P3 expo-keep-awake 패턴). **`.expo.ts`에만 top-level import**(웹 번들 격리 — NavScreen의 expo-location 격리 패턴 계승). **실 오디오는 T3 디바이스.**
- **`expo-location`**: 이미 존재(P3) — 추가 없음. 자동차/자전거 네비도 동일 LocationProvider 재사용(mode-agnostic).
- **실시간 교통 SDK/키**: **무료 티어 viability 미확정(§1.3)** — 신규 의존·키 도입은 viability 확정 후. P5는 인터페이스+픽스처까지(의존 추가 없이 가능).

---

## 7. P5 완료 기준 (전체 게이트)

- [ ] `pnpm install` 성공(WSL2 폴링) + lockfile 동결 (expo-speech 추가 시)
- [ ] `pnpm -r typecheck` 무오류 (shared / proxy / mobile)
- [ ] `pnpm -r test` 전부 green — **기존 649 테스트 회귀 0** + 신규: car/bike step 추출(kakao guides·Google navInstruction·bike best-effort)·ManeuverKind 매핑·안내 문장 생성(모드별)·VoiceGuide 합성·교통 정규화·NavScreen 음성토글/교통표시 렌더
- [ ] **(carry-forward 게이트 ①) 실 음성 실-모드 테스트**: `vi.mock('expo-speech')`로 `speak()`가 S1 생성 문장으로 호출·`stop()` 매핑 단언 — **합성 spy 테스트 불인정**
- [ ] **(carry-forward 게이트 ②) 교통 fetch-모킹 실-모드 테스트**(실 경로 존재 시): 핸들러가 traffic 정규화기를 실제 호출 단언 — 데모 불인정. *viability 미확정으로 라이브 deferred 시 픽스처 정규화 게이트로 한정(open-question 명시)*
- [ ] **maneuver 코드스페이스 정규화 실증(§1.2)**: kakao numeric·Google 문자열·Valhalla numeric이 **동일 `ManeuverKind` enum 수렴** 단언. car step location이 leg coords 범위·bbox 내(off-by-one 0)
- [ ] **하위호환 실증**: `RouteStep.maneuver` 추가·`RouteLeg.traffic?`가 **기존 649 무회귀**. guides/navInstruction/traffic 부재 경로는 steps/traffic 미부착(기존 동작). Valhalla `type` 원값 보존
- [ ] `wrangler deploy --dry-run` (proxy) 키 없이 성공 — 정규화 출력 확장(car steps·traffic)이 응답 계약 유지
- [ ] `expo export --platform web` (mobile) 성공 — **`expo-speech` 웹 번들 미포함 확인**
- [ ] **웹 데모 흐름**: 자동차 경로 결과→안내 시작→**웹 비활성 안내**(P3 §1)/모바일은 합성 시퀀스로 NavScreen **턴 카드(자동차 어휘)·교통 표시·음성 토글** 동작(목 데이터)
- [ ] 키·시크릿 미포함 — CI 시크릿 스캔 green

> **명시적 비-게이트(디바이스/키 필요 — T3):** 실 오디오 발화, 실시간 교통 실 데이터(무료 viability 미확정), 자동차/자전거 실 이동 네비 런타임. 키+에뮬레이터/실기기 확보 후 별도 QA — P5 "완료"는 위 게이트까지.

---

## 8. 명시적 한계

- **검증 무게중심은 P3에서 상속(T0)** — 네비 상태 머신·지오 수학·진행률은 **mode-agnostic이라 자동차/자전거에 무수정 적용**(§1.1). P5의 신규 실-데이터 무게는 거의 없다. P5 신규(car step 추출·음성·교통)는 **T1(지식 기반 픽스처)·T2(mock 배선)** 까지 — **P4의 실-캡처 골든 픽스처보다 얇다**(키·로컬 엔진 부재).
- **car/bike 픽스처는 지식 기반(byte-perfect 미보장)** — 카카오 guides·Google navigationInstruction·TMAP bike 실 형식은 키 발급 후 검증(P1·P2 한계 계승). 미정합 시 정규화기 조정 필요.
- **음성 안내 = 인터페이스+배선+mock까지** — 실 `expo-speech.speak` 오디오 출력은 디바이스 필요(T3). "검증됨"=문장 생성 순수 함수 + VoiceGuide 합성 + `vi.mock('expo-speech')` 실-분기 + 웹 export까지.
- **실시간 교통 = 인터페이스+픽스처까지 · 라이브 deferred 가능** — Google traffic-aware는 상위 SKU(무료 Essentials 아님), 카카오 무료 범위 미확정(§1.3). 스펙 §11 무료 티어 정책상 **라이브 교통은 viability 확정 후**. P5는 정규화·표시 메타까지 행사.
- **bike는 이중 불확실** — 스펙 KR bike 공급자 TBD + tmapBike stub. best-effort 추출, 미추출 시 폴리라인 추종(P3 TMAP 도보 graceful).
- **"전 모드"≠transit 회전 안내** — 자동차·자전거·도보=턴바이턴, 대중교통=leg-기반(탑승/하차/환승). transit 회전 안내는 과약속 아님(§1.4).
- **자동차/자전거 실 GPS 네비 런타임 미검증** — Mac·실기기·에뮬레이터 부재. 실 이동 이탈·재탐색·도착은 키+에뮬레이터/실기기 QA(P3 §8 ❌ 계승).
- **마지막 Phase 한계 통합** — P5 완료 후에도 **전 Phase 공통 디바이스/키 QA 백로그(§9)**가 잔존. "wayfinder P1~P5 코드 완료"≠"실기기 검증 완료". 출시 전 키+디바이스 QA 1회 필수.

---

## 9. 누적 key + device QA 백로그 (P3·P4·P5 통합 — autopilot-state `keyDeviceQaBacklog` 확장)

> **마지막 Phase 산출:** 전 Phase에 걸쳐 "코드 green이나 디바이스/키 없어 미검증"인 항목을 **단일 백로그로 통합.** 출시 전 키+에뮬레이터/실기기 확보 시 이 목록을 일괄 QA. (autopilot-state.json `keyDeviceQaBacklog`에 P5 항목 추가·통합.)

### A. API 키 발급 후 (실 데이터 동작)
1. **(P2)** 대중교통 환승 버퍼 실측 — 실 ODsay 1경로 총 소요 대조(`legs-1` 버퍼 과산정 LOW 검토).
2. **(P2)** TMAP 자전거 경로 실 응답 형식 — 키 후 스모크, 미가용 시 도보 leg-chaining 폴백.
3. **(P2)** Google Routes 키 ↔ P1 Places 키 재사용·쿼터 정책 확인.
4. **(P2)** ODsay 시외 도시간 구간 판정 임계·실 형식 검증.
5. **(P4)** 한국 OSM `lit=*` 태그 커버리지 — 안전 프로필 실효성(라이브 e2e 후 평가).
6. **(P4)** 풍경·한적 그래프 보강 데이터원(서울 열린데이터 공원·녹지·유동인구) — 후속 Phase.
7. **(P5)** 카카오 car `guides[]` 실 형식(x/y 좌표계 WGS84 여부·type 코드표) — step 추출 정합 검증.
8. **(P5)** Google Routes `navigationInstruction` 필드마스크·maneuver enum 실 값 — 글로벌 car/bike step 추출.
9. **(P5)** TMAP 자전거 maneuver 추출 가능 여부 — bike 턴 카드 활성화 vs 폴리라인 폴백 결정.
10. **(P5)** **실시간 교통 무료 티어 viability** — Google traffic-aware SKU 과금/카카오 무료 범위 확인. 라이브 교통 진행 여부 결정(미viable 시 deferred 유지).

### B. 에뮬레이터/실기기 확보 후 (디바이스 런타임 동작)
11. **(P3)** 실 GPS cadence/accuracy·백그라운드 추적 지속·실 이동 이탈→재탐색·안내 중 화면 wake.
12. **(P3)** 이탈 임계·도착 반경·재탐색 디바운스 상수 튜닝(실 GPS 노이즈).
13. **(P5)** **실 음성 오디오 출력** — `expo-speech` 디바이스 발화(언어·속도·중복 억제 체감).
14. **(P5)** 자동차/자전거 실 GPS 네비 런타임 — 실 이동 턴 안내·이탈·재탐색·음성 동기.
15. **(전반)** 네이티브 지도(Kakao/MapLibre RN) 디바이스 렌더, iOS EAS 빌드, 거리뷰·로드뷰 네이티브.

---

## 10. 사용자 액션 필요 / Open Questions (`.omc/plans/open-questions.md`에 기록)

1. **(검증 환경)** P5 실 음성·자동차/자전거 실 네비·실시간 교통 실 데이터 — 키+에뮬레이터/실기기 확보 후 §9 QA. 본 Phase 범위 밖.
2. **(교통 viability)** 실시간 교통 무료 티어 가능 여부 — Google traffic-aware 상위 SKU·카카오 무료 범위. **미viable 시 실시간 교통 라이브는 deferred**(인터페이스+픽스처는 완료).
3. **(car 형식)** 카카오 car `guides[]` 좌표계·type 코드표 + Google `navigationInstruction` 필드마스크 — 키 후 검증, step 추출 정합.
4. **(bike)** TMAP 자전거 maneuver 추출 가능 여부 — 키 후 결정(턴 카드 vs 폴리라인 폴백).
5. **(의존)** `expo-speech` 도입 확정 — S3에서 추가 시 lockfile·키 0개 빌드/웹 export 무영향 확인.
