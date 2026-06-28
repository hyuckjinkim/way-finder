# wayfinder — 내일 키 추가 & 검증 셋업 가이드 (기계적 단계)

> 작성: 2026-06-29 (자율 코드-준비 세션) / 대상: 키·계정·결제·실기기를 직접 다루는 사용자
> 선행 문서: [free-tier 로드맵](./2026-06-29-free-tier-go-live-plan.md), [RELEASE-CHECKLIST](../../RELEASE-CHECKLIST.md)
>
> **이 세션에서 코드는 "키만 꽂으면 동작"하도록 준비됨.** 아래는 키/계정/결제처럼 사람만 할 수 있는 단계의 정확한 순서다.
> 코드 변경 요약은 문서 맨 아래 [§완료된 코드-준비] 참조. 브랜치: `prep/free-tier-go-live`.

---

## 1. 프록시 시크릿 주입 (Cloudflare Workers) — 약 10분

`services/proxy`에서 실행. 시크릿 이름은 `services/proxy/src/config.ts:13-30`의 `Env`와 1:1 일치 (이미 전부 실배선됨).

```bash
cd services/proxy
wrangler login                       # 최초 1회

# 8개 시크릿 (값은 각 콘솔에서 발급)
wrangler secret put KAKAO_REST_KEY        # Kakao Developers REST 키 (Local 검색·블로그)
wrangler secret put GOOGLE_PLACES_KEY     # Google Cloud — Places API
wrangler secret put NAVER_CLIENT_ID       # Naver Developers
wrangler secret put NAVER_CLIENT_SECRET
wrangler secret put KAKAO_MOBILITY_KEY    # Kakao Mobility — 자동차 경로
wrangler secret put TMAP_APP_KEY          # TMAP(SK) — 도보·자전거
wrangler secret put GOOGLE_ROUTES_KEY     # Google Cloud — Routes API
wrangler secret put ODSAY_API_KEY         # ODsay — 대중교통/시외
# (MAPBOX_TOKEN은 현재 미사용 — GAP4. 글로벌 라우팅은 Google Routes 사용. 넣어도 효과 없음.)
```

**KV 네임스페이스**: `services/proxy/wrangler.toml:13`의 placeholder id를 실제 발급 id로 교체.

```bash
wrangler kv namespace create CACHE        # 출력된 id를 wrangler.toml의 id = "0000…" 자리에 교체
```

`DEMO_MODE`는 `wrangler.toml`에서 `"auto"` — 키가 하나라도 비면 그 경로만 데모로 graceful degradation (`config.ts:isDemoMode`). 전체 실모드를 강제하려면 `"false"`.

배포: `wrangler deploy` → 배포 URL을 2단계에서 사용.

---

## 2. 앱 env (Expo) — 약 5분  ⚠️ GAP1 수정 반영됨

루트 `.env`(.local) 또는 셸 env. **정식 변수명은 `EXPO_PUBLIC_PROXY_BASE_URL`** (이 세션에서 `apiClient.ts`가 이 이름을 읽도록 수정 — 이전엔 `EXPO_PUBLIC_API_URL`만 읽어 키를 넣어도 데모 모드에 머무는 버그가 있었음. 레거시 이름도 폴백으로 계속 동작).

```bash
# .env.example 참조
EXPO_PUBLIC_PROXY_BASE_URL=https://wayfinder-proxy.<account>.workers.dev   # 1단계 배포 URL
EXPO_PUBLIC_KAKAO_JS_KEY=<Kakao JS 키>          # 웹 카카오 지도 (미설정 시 placeholder)
EXPO_PUBLIC_KAKAO_NATIVE_APP_KEY=<Kakao 네이티브 앱키>   # 네이티브 빌드 config plugin (app.config.ts)
```

로컬 웹 확인:
```bash
cd apps/mobile && npx expo export --platform web && npx serve dist
```

---

## 3. EAS 디바이스 빌드용 env  ⚠️ GAP2 (배선 필요)

`EXPO_PUBLIC_*`는 Metro가 **빌드 시 인라인**한다. 로컬 `expo export`는 셸 env를 읽지만, **EAS 클라우드 빌드는 셸 env를 못 본다** — EAS env로 등록해야 빈 값으로 인라인되지 않는다 (`apps/mobile/eas.json`엔 현재 env 블록 없음).

```bash
cd apps/mobile
eas env:create --name EXPO_PUBLIC_PROXY_BASE_URL --value "https://…workers.dev" --environment production --visibility plaintext
eas env:create --name EXPO_PUBLIC_KAKAO_JS_KEY --value "<JS키>" --environment production --visibility plaintext
eas env:create --name EXPO_PUBLIC_KAKAO_NATIVE_APP_KEY --value "<네이티브키>" --environment production --visibility sensitive
```
(`EXPO_PUBLIC_*`는 클라이언트 번들에 인라인되므로 본질적으로 공개값 — plaintext여도 무방. preview/development 프로필에도 동일 등록.)

---

## 4. 실기기 / EAS QA — $99/년 게이트

- ✅ **Mac 불필요**: EAS Build가 클라우드(macOS 러너)에서 iOS 빌드. `eas build --platform ios`.
- ✅ **iOS Simulator 빌드**: Apple 계정 없이 컴파일 가능하나 .app 실행은 Mac 필요 → Android 에뮬레이터/실기기 우선.
- ⚠️ **실기기 빌드·TestFlight·App Store = Apple Developer Program $99/년 필수.** EAS CLI가 로그인 후 서명 인증서 자동 생성, `eas submit`으로 Windows/Linux에서 업로드.
- 이후 RELEASE-CHECKLIST §2의 P3/P5 실기기 항목 실행 (실 GPS·음성·이탈/재탐색·voice×reroute seam).

---

## 비차단 메모 (나중에)

- **GAP3 (로드뷰)**: `apps/mobile/src/screens/RoadviewScreen.tsx:68-70` — JS 키가 있어도 웹 로드뷰는 `<Text>카카오 로드뷰 (키 연동)</Text>` placeholder. 실제 Kakao JS Roadview 마운트는 미구현. 키를 넣어도 지도는 뜨지만 로드뷰는 안 뜸.
- **GAP4 (Mapbox)**: `config.ts:25` `MAPBOX_TOKEN` 선언만 됨, fetch하는 핸들러 없음. 글로벌 라우팅은 Google Routes 사용. 설정해도 효과 없음(글로벌 라우팅을 Mapbox로 바꿀 계획이 없으면 무시).
- **지도 라이브러리 (open question c — 해소)**: `@react-native-kakao/map` 2.2.7은 모노레포에서 RN0.77 빌드깨짐으로 제거된 terminal 버전(업그레이드 경로 없음). 앱은 RN0.85.3 → 디바이스에서 Kakao 네이티브 지도가 깨질 수 있음. 이 세션에서 **에러 바운더리 폴백**(Kakao 실패 시 MapLibre로 degrade)을 추가해 crash는 방지. 단 throw 없는 silent blank는 디바이스 QA로만 확인 가능.

---

## §완료된 코드-준비 (이 세션, `prep/free-tier-go-live` 브랜치)

1. **GAP1 수정** — `apps/mobile/src/services/apiClient.ts`: `EXPO_PUBLIC_PROXY_BASE_URL` 우선 + 레거시 폴백. 회귀 테스트 `apiClient.test.ts` (4건).
2. **지도 폴백** — `apps/mobile/src/map/MapErrorBoundary.tsx` 추가 + `MapView.tsx`(네이티브 디스패처)에 배선: Kakao 실패 시 MapLibre로 degrade. 단위 테스트 `MapErrorBoundary.test.tsx` (4건).
3. **문서** — `docs/plans/`에 free-tier 로드맵 + 본 셋업 가이드.

검증: mobile typecheck green, vitest 전체 green (신규 8건 포함).
미수행(키/기기 필요): 외부 API 실응답 파서 정합, 실기기 QA, 실데이터 동작 — 위 1~4단계로 사용자가 진행.
