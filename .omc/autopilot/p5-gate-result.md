# P5 최종 통합 게이트 결과 (U2)

> 실행: 2026-06-08 · 작업: P5 최종 통합 U2 (음성↔step 전이 배선 + 자동차 데모 흐름 + 웹 게이트)
> 기준 커밋(작업 전 HEAD): `1721f8d` (브랜치 feat/p5-allmode-nav, 테스트 706 green)
> 계획: `.omc/plans/autopilot-impl-p5.md` §4 U2
> 3워커 완료 산출(S·T·U1) 위에 통합 — 음성 토글 on일 때 VoiceGuide를 navMachine step
> 전이에 연결하는 배선(미통합분)을 통합 레이어(navStore)에 정착. navMachine 순수 유지(P3 경계 계승).

## 게이트 결과 (전 항목 PASS)

| # | 게이트 | 명령 | 결과 |
|---|--------|------|------|
| 1 | typecheck | `pnpm -r typecheck` | **PASS** — shared / proxy / mobile 3패키지 무오류 |
| 2 | test | `pnpm -r test` | **PASS** — shared 66 + proxy 300 + mobile 348 = **714 green** (706 → +8 신규, **회귀 0**) |
| 3 | secret scan | `bash scripts/secret-scan.sh` | **PASS** — 하드코딩 키 없음 (exit 0) |
| 4 | proxy dry-run | `cd services/proxy && set -o pipefail; npx wrangler deploy --dry-run` | **PASS** — 키 없이 성공, CACHE(KV)·DEMO_MODE("auto") 바인딩 확인 (exit 0). U2는 프록시 미변경 — 응답 계약 유지 |
| 5 | web export | `cd apps/mobile && set -o pipefail; CI=1 npx expo export --platform web` | **PASS** — `/route/nav`(23KB) 포함 9개 정적 라우트 렌더, `Exported: dist` (pipefail로 실제 exit 0 검증) |
| 6 | **expo-speech 웹 번들 미포함** | `grep -rl "expo-speech" dist/ \| wc -l` | **PASS** — **0 파일** (플랫폼 분기 팩토리로 구조적 배제. ExpoSpeech 토큰도 0) |
| 7 | 웹 데모 흐름 | navFlow.test.tsx (웹 비활성 + 모바일 합성) | **PASS** — 아래 §흐름 |

### 신규 테스트 분포 (714 = 706 + 8)
- `apps/mobile/src/state/navStore.test.ts` (+4): **U2 음성↔step 전이 배선** —
  ① 토글 on이면 step 전이(activeStepIndex 변경)마다 `VoiceGuide.speak`가 `navInstructionText` 문장으로 호출(**차량 어휘** "400m 앞에서 우회전" 단언 = mode가 leg에서 도출됨 입증, 보행 어휘 "오른쪽으로 이동" 부재 단언)
  ② 동일 step 미재발화(발화 문장 집합 = 발화 수 — S2 디바운스 백스톱)
  ③ 토글 off면 발화 0(게이트)
  ④ voiceGuide 미주입 시 무회귀(게이트 on이어도 무해, 정상 reduce)
- `apps/mobile/src/screens/navFlow.test.tsx` (+4): **U2 자동차 경로 데모 흐름** —
  ① 자동차 경로 턴 카드에 raw maneuver instruction("강남대로로 우회전하세요"·"800 m") 렌더
  ② 교통 배지(정체) + 턴 카드 동시 표시
  ③ 음성 토글 버튼 동작(기본 off 켜기 레이블)
  ④ 웹 분기 격리(자동차 경로도 비활성 안내·턴 카드/배지 미렌더)
- shared(66)·proxy(300)는 무변경·무회귀.

## 음성↔step 전이 배선 (이번 통합의 헤드라인)

`navMachine.navReduce`는 순수 유지 — 매 표본 기하만으로 `activeStepIndex`·`nextStep`을 산출한다.
**발화 소유는 navStore**(P3 "상태 소유는 스토어" 경계 계승, navMachine 미접촉):

- **클로저 idiom(반응형 상태 미도입):** 기존 `rerouting` 클로저 변수와 동일하게 `voiceEnabled`·`voice`를
  스토어 팩토리 클로저로 보유. NavScreen은 버튼 레이블용 로컬 `useState`만 유지(U1 "intent만 방출" 불변).
- **주입:** `startNav({ voiceGuide? })` — provider/getRoute와 동일 선택 주입. 미지정 시 음성 배선 없음(무회귀).
- **전이 발화:** watch 콜백에서 `navReduce` 직후 `maybeSpeak(prev, geo, route)` —
  `voiceEnabled && geo.nextStep && geo.activeStepIndex !== prev.activeStepIndex`일 때만
  `voice.speak(navInstructionText(geo.nextStep, route.legs[geo.activeLegIndex].mode))`.
  **mode는 활성 leg에서 도출**(NavState에 mode 필드 없음 — critic minor 계약).
- **중복 억제:** `navInstructionText` 출력은 step당 안정적(거리 키 = `step.distanceM`, 매 표본
  `distanceToNextTurnM` 아님). 동일 step이 여러 표본에 걸쳐 동일 문장을 만들어도 S2 합성
  디바운스(직전 동일 텍스트 억제)가 한 번만 발화. activeStepIndex 가드 + 텍스트 디바운스 이중 백스톱.
- **토글 off / 종료:** `setVoiceEnabled(false)`·`teardown()`이 `voice.stop()`으로 현재·대기 발화 즉시 중단.

### 웹 번들 격리 (게이트 6 — 가장 물기 쉬운 지점, advisor 지적)
`nav.tsx`는 단일 공유 모듈(`.web` 변형 없음)이라, 여기서 `voiceGuide.expo.ts`(→ `expo-speech`)를
정적 import하면 Metro가 웹 번들에 끌어온다. **expo-location 선례는 불성립** — expo-location은 web shim이
있지만 expo-speech는 *required absent*. NavScreen/NavScreen.web 패턴대로 플랫폼 분기 팩토리로 격리:
- `createVoiceGuide.ts`(네이티브) → `createExpoVoiceGuide()` (expo-speech import)
- `createVoiceGuide.web.ts`(웹) → `createSyntheticVoiceGuide()` (expo import 0)

nav.tsx: `isDemoMode ? createSyntheticVoiceGuide() : createVoiceGuide()`. 웹은 `.web.ts` 해석 →
expo-speech 구조적 배제. Vitest도 동일(`.web.ts` 우선 해석) — node 테스트 환경에 expo-speech 미로드.
**검증:** `grep -rl expo-speech dist/` = 0 파일.

## 웹 데모 흐름 (자동차 경로 → 안내 시작 → 웹 비활성 / 모바일 합성 NavScreen)

1. **자동차 경로** — P2/P4 car 경로(maneuvers steps + traffic 메타). navFlow.test.tsx의 `CAR_ROUTE_WITH_STEPS`
   픽스처가 car leg + `maneuver: 'turn-right'` step + `traffic.congestion: 'jam'`을 표현.
2. **안내 시작** — `/route/nav`가 navStore에 안내 경로·합성 provider·합성 voiceGuide를 주입(데모).
3. **웹**: `NavScreen.web.tsx`(.web 분기)가 **비활성 안내**("모바일 앱에서 이용하세요") + 경로 표시 폴백 렌더.
   자동차 경로도 턴 카드·교통 배지 미렌더(웹 격리). navFlow.test.tsx 웹 케이스 PASS.
4. **모바일**: NavScreen.tsx가 **자동차 턴 카드**(raw maneuver instruction — plan §0: 카드는 `RouteStep.instruction`
   유지, navInstructionText는 VoiceGuide 전용 소비자)·**교통 배지(정체)**·**음성 토글**을 합성 시퀀스로 동작.
   음성 토글 on 시 step 전이마다 차량 어휘 발화(navStore.test.ts가 합성 spy로 증명).

> **카드 텍스트 vs 발화 텍스트(plan §0 경계):** 턴 카드는 raw `RouteStep.instruction`("강남대로로 우회전하세요"),
> 음성 발화는 `navInstructionText` 산물("400m 앞에서 우회전"·차량 어휘). VoiceGuide가 navInstructionText의
> **유일 소비자** — U1 카드 불변. navFlow는 카드(raw)를, navStore는 발화(navInstructionText)를 각각 행사.

## §0 검증 가능성 표 — 디바이스/키 비-게이트 항목 (키+에뮬레이터 확보 후 별도 QA — 본 Phase 범위 밖)

> 계획 §0 검증 분류표 T3(디바이스/키 필요) + §7 "명시적 비-게이트"의 명시 복사. P5 "완료"는 위 게이트(T0·T1·T2)까지이며,
> 아래는 키+에뮬레이터/실기기 런타임 검증 대상. **U2는 합성/mock 배선까지** — 실 부수효과 미실행.

| 항목 | 티어 | 검증 방법 |
|------|------|-----------|
| 실 오디오 출력 (디바이스 스피커 발화 — 언어·속도·중복 억제 체감) | **T3** | ❌ 디바이스 필요 — `expo-speech` 디바이스 발화, post-key/에뮬레이터 별도 QA (§9 B-13) |
| 실시간 교통 실 데이터 (라이브 키) | **T3** | ❌ 키 필요 — 무료 티어 viability 미확정(§1.3 open-question §10.2) |
| 자동차/자전거 실 GPS 네비 런타임 (이탈·재탐색 실 이동·음성 동기) | **T3** | ❌ 디바이스 필요 — P3 §8 ❌ 항목 계승 (§9 B-14) |

> **명시적 비-게이트(디바이스/키 필요 — T3):** 실 오디오 발화, 실시간 교통 실 데이터, 자동차/자전거 실 이동 네비.
> 키+에뮬레이터/실기기 확보 후 별도 QA(§9 누적 백로그). **P5 "완료"는 T0·T1·T2 게이트까지** — "코드 green"≠"실기기 검증 완료".

## 워커 로직 변경 최소 (배선만 — 규칙 준수)

- **navMachine·navInstructionText·voiceGuide·voiceGuide.expo·NavScreen·gpsSequences 핵심 로직 미변경.**
  통합은 ① navStore 확장(voiceGuide 주입·setVoiceEnabled·maybeSpeak 배선) ② nav.tsx 배선(voiceGuide 주입·onToggleVoice 연결)
  ③ 신규 플랫폼 분기 팩토리(createVoiceGuide.ts/.web.ts) ④ 테스트 가산에 한정.
- **의존성 추가 0** — expo-speech는 S가 이미 추가(S3). U2는 신규 의존 무도입.

## 변경 파일

| 파일 | 변경 |
|------|------|
| `apps/mobile/src/nav/createVoiceGuide.ts` | **신규** — 네이티브 VoiceGuide 팩토리(expo impl 디스패치) |
| `apps/mobile/src/nav/createVoiceGuide.web.ts` | **신규** — 웹 VoiceGuide 팩토리(합성 impl — expo-speech 웹 번들 격리) |
| `apps/mobile/src/state/navStore.ts` | voiceGuide 주입(StartNavArgs)·setVoiceEnabled 액션·maybeSpeak(step 전이 발화)·teardown stop 배선 |
| `apps/mobile/src/state/navStore.test.ts` | **U2 음성↔step 전이 배선** 테스트 +4 (전이 발화·차량 어휘·중복 억제·off 게이트·미주입 무회귀) |
| `apps/mobile/app/route/nav.tsx` | voiceGuide 주입(데모=합성/실=createVoiceGuide)·onToggleVoice → setVoiceEnabled 연결 |
| `apps/mobile/src/screens/navFlow.test.tsx` | **U2 자동차 데모 흐름** 테스트 +4 (car 턴 카드·교통 배지·음성 토글·웹 격리) |

## 발견 문제 / 비고

1. **웹 번들 격리 — locationProvider 선례 불성립(해결됨)** — expo-location은 web shim이 있어 nav.tsx 정적 import가
   웹 export를 통과하지만(P3 비고 #3), expo-speech는 web shim이 없어 *required absent*다. nav.tsx에서 expo impl을
   직접 import했다면 `grep expo-speech dist/` 단언이 깨졌을 것. 플랫폼 분기 팩토리(createVoiceGuide.ts/.web.ts)로 격리 —
   NavScreen/NavScreen.web 패턴 계승. 게이트 6 = 0 파일로 검증.
2. **카드 텍스트 vs 발화 텍스트 경계(plan §0)** — 턴 카드는 raw `RouteStep.instruction`, 음성은 `navInstructionText` 산물.
   VoiceGuide가 navInstructionText 유일 소비자라 U1 카드 불변. 자동차 픽스처는 instruction(카드용)·maneuver(발화용)
   양립 — navFlow는 카드를, navStore는 발화를 각각 행사. 모드별 카드 텍스트는 P5 범위 밖(후속).
3. **mode 도출(critic minor 계약)** — NavState에 mode 필드 없음. maybeSpeak가 `route.legs[geo.activeLegIndex].mode`로
   도출. navStore.test.ts가 차량 어휘("우회전") vs 보행 어휘("오른쪽으로 이동") 단언으로 mode 출처를 입증(하드코딩 아님).
4. **LSP 미설치** — `typescript-language-server` 미설치로 lsp_diagnostics 불가. `pnpm -r typecheck`(tsc --noEmit 3패키지)가
   권위 타입 검증 — 무오류 통과로 대체.
5. **실 음성 실-모드 테스트(carry-forward 게이트 ①)는 S3에서 완료** — `voiceGuide.expo.test.ts`가 `vi.mock('expo-speech')`로
   `speak()`·`stop()` 매핑을 이미 단언(S 워커 산출). U2는 그 위에 **step 전이 → speak 배선**을 추가 검증(navStore.test.ts).
