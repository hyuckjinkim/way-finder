# wayfinder — 무료 티어 기반 실동작 전환 플랜 (mock → real)

> 작성: 2026-06-29 / 상태: 제안 (deep-research 검증 결과 기반)
> 근거: [RELEASE-CHECKLIST.md](../../RELEASE-CHECKLIST.md), [설계 문서](../superpowers/specs/2026-06-07-map-navigation-app-design.md)
>
> **업데이트(2026-06-29 자율 코드-준비 세션, 브랜치 `prep/free-tier-go-live`):** 키 없이 가능한 코드-준비 완료.
> ① GAP1(프록시 URL env 변수명 불일치 — 키 넣어도 데모 모드에 머무는 버그) 수정 + 회귀 테스트.
> ② open question (c) 해소 → 지도 라이브러리 에러 바운더리 폴백(Kakao 실패 시 MapLibre). 내일 키 추가·검증 절차는
> [tomorrow-key-setup 가이드](./2026-06-30-tomorrow-key-setup.md) 참조. 검증: mobile typecheck + 356 tests green.
>
> **업데이트(2026-11-18):** 구글 Places·Routes, 카카오모빌리티는 **선택 키**로 전환 — 비우면 해당 기능만 빠지고 무료 키 기능은
> 실 모드 유지(이전엔 구글 키 하나 없으면 장소 전체, 카카오모빌리티 없으면 국내 도보·자전거까지 데모로 떨어짐 — 수정·회귀 테스트).
> → **국내 전용이면 STAGE 1의 Google 단계 전체 생략 가능(0원 무조건)**. 키 원본은 Workspace 공용 `key-lib/keys.env`, 프로젝트 `.env`는 설정·별칭 → `scripts/env-sync.sh`로 일원화.
> 구성표·한계: [설계 §11 국내 전용 구성](../superpowers/specs/2026-06-07-map-navigation-app-design.md), VWorld 타일 검토: 설계 §5.
>
> **목적.** Phase 1–5가 전부 구현·테스트(약 714개 green)됐으나 로컬 Valhalla를 제외하면 전부 **mock 경계 안**에서만 검증됨.
> 이 문서는 `free-tier-only · Mac 없음 · 실기기 없음 · web-first` 제약 하에서 **돈을 거의 안 쓰고** 실동작으로 넘어가는 순서를 정의한다.
>
> **검증 표기.** ✅ = 2026년 공식 문서로 3표 적대적 검증 통과. ⚠️ = 미검증(open question) — 착수 전 직접 확인 필요.

---

## 0. 비용 게이트 한눈에

| 단계 | 비용 | 게이트 |
|------|------|--------|
| STAGE 0 (지금) | **0원** | 없음 — Kakao 무료 키 + Simulator 빌드 + 로컬 Valhalla |
| STAGE 1 (키) | **0원** (하드캡 전제) | Google 일일 쿼터 하드캡 **필수** |
| STAGE 2 (실기기) | **$99/년** | Apple Developer Program — 유일한 진짜 비-무료 게이트 |

핵심: **$99/년 Apple 멤버십이 유일하게 피할 수 없는 유료 항목**이므로 맨 마지막으로 미룬다.

---

## STAGE 0 — 지금 당장 (키·기기 0원)

키도 기기도 없이 가능한 것부터. 지출 없음.

- [ ] **Kakao Developers 키 발급** (무료, 가장 관대한 쿼터 — STAGE 1로 당겨도 됨)
  - ✅ Local(주소변환·키워드/카테고리 검색·좌표변환): **각 10만건/일**(엔드포인트별 개별 풀)
  - ✅ 자동차 길찾기 **1만건/일**, Navigation SDK(실시간 안내·안전운행·위치조회) **각 10만건/일**
  - JS키 → 앱 env, REST키 → `wrangler secret` (RELEASE-CHECKLIST §1 주입 규칙)
- [ ] **iOS Simulator용 EAS 빌드 생성** — 네이티브 모듈(지도 SDK 등) 컴파일/링크 검증
  - ✅ Apple 계정 없이 클라우드 컴파일 가능 (`ios.simulator: true` 빌드 프로필)
  - ⚠️ 단, **.app 실행은 Mac+Xcode 필요** → 이 환경에선 "빌드 파이프라인·네이티브 링크 검증"까지만. 실행 검증은 STAGE 2 Android 에뮬레이터/실기기로.
- [ ] **로컬 Valhalla + 웹 export 데모** (이미 가능, RELEASE-CHECKLIST §0)
  - `cd apps/mobile && npx expo export --platform web && npx serve dist`
  - `cd services/valhalla && docker compose up -d` → 실 경로 응답 확인

**STAGE 0 완료 기준:** Kakao 실데이터로 한국 지도·검색·자동차 경로가 웹/데모에서 렌더, Simulator 빌드 green, Valhalla 실 경로 curl 성공.

---

## STAGE 1 — 키 발급 (무료 티어 + 하드캡)

> ⚠️ **착수 전 필수 안전장치:** Google은 키 연결 **전에** 쿼터 하드캡부터 건다. 순서를 어기면 과금 위험.

- [ ] **Google Maps Platform — API별 일일 쿼터 하드캡 먼저 설정**
  - ✅ Cloud Console > APIs & Services에서 API별 **"Requests per day"** 캡 → 초과 시 과금이 아니라 `RESOURCE_EXHAUSTED`/limit-exceeded **에러로 실패**(진짜 하드캡)
  - ✅ **Billing budget(예산 알림)은 지출을 막지 못함** — 이메일 알림뿐. 반드시 쿼터 캡 사용
  - ✅ enforcement에 지연 있음 → 캡에 버퍼를 둘 것 (bit-exact 아님)
  - 그다음 Places/Routes 연결. 앱은 캡 도달 시 graceful degradation.
- [ ] **Google 실시간 교통은 무료 경로에서 제외**
  - ✅ `TRAFFIC_AWARE`/`TRAFFIC_AWARE_OPTIMAL` = **Pro SKU**(고가), 기본 라우팅 = Essentials SKU(최저가)
  - ✅ 2025-03-01부터 $200 크레딧 폐지 → SKU별 월 free usage cap 체계
  - → **한국 실시간 교통은 Kakao로, Google은 기본 라우팅만.**
- [ ] **나머지 한국 API 키 발급** — ⚠️ **무료 한도·캡 메커니즘 미검증(open question), 발급 시 직접 확인**
  - ⚠️ Naver 검색(블로그), TMAP(도보 경로 — 자전거 API 없음), ODsay(대중교통·시외), Kakao Mobility(자동차 다중경유지)
  - 각 콘솔에서 일일 한도와 "초과 시 차단 vs 자동 과금" 정책을 확인하고 본 문서 표를 업데이트할 것
- [ ] **Cloudflare** — Workers/Pages·KV (`wrangler login` + KV 생성, 일 10만 무료)

**STAGE 1 완료 기준:** 모든 외부 API가 실키로 동작, Google 쿼터 하드캡 적용 확인(초과 테스트 시 과금 0원·에러 반환), 한국 API별 한도 표 갱신.

---

## STAGE 2 — 디바이스 / EAS QA (유료 게이트: $99/년)

> 여기서부터 RELEASE-CHECKLIST §2의 "코드로 검증 불가" 항목을 실행한다.

- [ ] **Apple Developer Program $99/년 결제** (실기기 빌드·TestFlight·App Store 필수)
  - ✅ EAS CLI가 로그인 후 서명 인증서·프로비저닝 프로파일 **자동 생성**(Mac 불필요)
  - ✅ **EAS Submit으로 Windows/Linux에서 TestFlight/App Store 업로드 가능**
- [ ] **Android 에뮬레이터 + dev client** (무료 — 실행 검증 우선 경로)
- [ ] **P3 도보 턴바이턴** (RELEASE-CHECKLIST §2): 실 GPS cadence·accuracy, 백그라운드 추적, 이탈→재탐색 런타임, 화면 wake, 임계 상수 튜닝(이탈 30m·도착 20m·디바운스 5s)
- [ ] **P5 전모드·음성·교통**: 실 음성 출력(expo-speech), 차/자전거 실 GPS 네비, **voice × reroute seam**(재탐색이 step 리셋 시 새 경로 첫 턴 안내 정상 여부 — 합성 테스트 미작성, 디바이스 우선 확인)
- [ ] **P4 커스텀 경로**: 대중교통 환승 버퍼 실측(ODsay 1경로 대조), OSM `lit=*` 커버리지로 안전 프로필 실효성, 풍경 프로필 그래프 보강 후 `ENABLE_SCENIC`

**STAGE 2 완료 기준:** 실기기에서 턴바이턴·음성·이탈/재탐색·실시간 교통 동작 확인, TestFlight 배포 성공.

---

## 미해결 항목 (open questions — 착수 전 별도 확인 필요)

deep-research에서 3표 검증을 통과하지 못한 항목. **검증된 사실처럼 다루지 말 것.**

- [ ] **(a) Naver / TMAP(SK) / ODsay 2026 무료 한도·캡 메커니즘** — Google식 "fail-instead-of-charge" 캡이 있는지 불명
- [x] **(c) Kakao 지도 RN 라이브러리 상태 — 해소(2026-06-29).** 추가 조사 결과 `@react-native-kakao/map` 2.2.7은 **terminal 버전**: 모노레포 v2.3.0에서 `"remove map package + fix 0.77 android build error"` 커밋으로 map 패키지가 제거됨(업그레이드 경로 없음, 유지보수 네이티브 대안 없음). 앱은 RN0.85.3 → 디바이스 깨짐 리스크. **대응: 에러 바운더리 폴백 추가**(`MapErrorBoundary.tsx`, Kakao 실패 시 MapLibre로 degrade). silent blank는 디바이스 QA로만 확인 가능 (잔여 리스크 명시)
- [ ] **(d) 턴바이턴 응답 실 형식** — Kakao car `guides[]` 좌표계/type 코드표, Google Routes `navigationInstruction` 필드마스크·maneuver enum, ~~TMAP 자전거 maneuver~~ (TMAP 자전거 API 없음 → Valhalla, 2026-11-18) (1차 소스 일부 unreliable)
- [ ] **(e) Google SKU별 월 free-event 정확 수치** — post-2025-03 모델에서 wayfinder가 호출하는 SKU별 무료 한도를 알아야 일일 쿼터 캡을 free cap 안쪽으로 사이징 가능

---

## 출처 (2026 기준, 모두 1차 공식 문서)

- Google 쿼터 하드캡: https://docs.cloud.google.com/apis/docs/capping-api-usage · https://developers.google.com/maps/billing-and-pricing/manage-costs
- Google Routes SKU/교통: https://developers.google.com/maps/documentation/routes/usage-and-billing · https://developers.google.com/maps/billing-and-pricing/overview
- Kakao 무료 쿼터: https://developers.kakaomobility.com/price/ · https://developers.kakao.com/docs/latest/ko/getting-started/quota
- EAS / Apple: https://docs.expo.dev/build/setup/ · https://docs.expo.dev/tutorial/eas/ios-development-build-for-devices/ · https://docs.expo.dev/submit/introduction/
