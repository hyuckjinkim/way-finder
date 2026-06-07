# P4 최종 통합 게이트 결과 (OW1 + D2 + D3)

> 작성: 2026-06-08 / 브랜치: feat/p4-valhalla / 기반 커밋: bbd3fb5 (테스트 531 green)
> 통합 워커: executor (OW1 실 배선 · D2 데모 웹 게이트 · D3 라이브 e2e)
> 계획: `.omc/plans/autopilot-impl-p4.md` §4 OW1·D2·D3

---

## 게이트 종합

| 게이트 | 명령 | 결과 |
|--------|------|------|
| typecheck (전체) | `pnpm -r typecheck` | ✅ PASS (shared/proxy/mobile, 0 error) |
| test (전체) | `pnpm -r test` | ✅ PASS — **540 tests green** (shared 41 + proxy 266 + mobile 233), 회귀 0 |
| 게이트 A (fetch-모킹 실-모드 배선) | `vitest run src/routes/valhallaWiring.test.ts` | ✅ PASS (4/4) — 핸들러→provider→필터 end-to-end |
| 데모 웹 게이트 (D2 route-level) | `vitest run src/screens/routeFlowCustom.test.ts` | ✅ PASS (5/5) — 합성 customMeta 예산 플래그 행사 |
| 웹 export (키 0개) | `expo export --platform web` | ✅ PASS (exit 0) — 8 HTML 라우트(route/input·route/result 포함) |
| dry-run (proxy) | `wrangler deploy --dry-run --outdir dist` | ✅ PASS — 117.17 KiB / gzip 28.85 KiB, 시크릿 미노출 |
| 시크릿 스캔 (변경 파일) | grep 하드코딩 시크릿 | ✅ PASS — NO_HARDCODED_SECRETS |
| 번들 격리 | proxy 배선이 mobile/shared로 누출 안 됨 | ✅ PASS — `resolveValhallaCustomRoute`는 proxy 전용 |
| **게이트 B (라이브 컨테이너 e2e)** | `VALHALLA_URL=http://localhost:8002 ... test:e2e` | ✅ **PASS (2/2) — 실 컨테이너 실행 증거 확보** |

---

## OW1 — 실 배선 (게이트 A)

**파일:**
- `services/proxy/src/routes/valhallaProvider.ts` — `resolveValhallaCustomRoute(req, env)` 추가: `createValhallaProvider`(A2) + `applyExtraMinutesFilter`(OO1) 결합, provider 실패 시 null 반환(silent 금지 로깅 후 호출자 TMAP 폴백).
- `services/proxy/src/routes/routeDirect.ts` — F1 로컬 stub `tryValhallaCustomRoute`(항상 null)를 제거하고 `resolveValhallaCustomRoute` import로 대체. **kr+walk+preference 슬롯만 변경, 기존 4모드(TMAP/kakao/google) 디스패치 불변.**
- `services/proxy/src/routes/valhallaWiring.test.ts` (신규) — 통합 테스트.

**증명 (P2 502 미배선 사고 방지):** `POST /v1/routes` (preference=safe, N=10)가
1. 핸들러가 실제로 Valhalla provider를 호출 — fetch가 `http://localhost:8002/route`로 향함.
2. 2-call +N 필터가 엔진을 거침 — `provider.route` 2회(baseline fastest + safe profile) → fetch 2회.
3. 응답에 `customMeta`(preference·withinBudget·baselineDurationSec)가 실림.
4. fastest는 미진입(기존 TMAP, customMeta 없음) · 컨테이너 다운 시 null→TMAP 폴백(silent 아님).

---

## D2 — 데모 모드 웹 게이트

**파일:** `apps/mobile/src/screens/routeFlowCustom.test.ts` (신규, route-level)

- 키 0개 expo export green (8 라우트).
- 데모 흐름: 경로입력(stops) → 옵션(4프로필 탭 `빠른/걷기좋은/안전/한적`, **풍경 미노출** `ENABLE_SCENIC=false`) + N분 스테퍼 → `getRoute`(데모=mockRouteProvider) → `routeSummary`가 합성 `customMeta` 예산 플래그 노출.
- 플래그 실제 행사: safe(합성 +8분) × N=3 → `withinBudget=false`, N 무제한 → `withinBudget=true`.
- 합성 플래그라 실 컨테이너 불요(게이트 B와 분리).

---

## D3 — 라이브 컨테이너 e2e (게이트 B)

**파일:**
- `services/proxy/e2e/valhalla.e2e.ts` (신규, env-gated: `VALHALLA_URL` 미설정 시 describe.skip)
- `services/proxy/vitest.e2e.config.ts` (신규, e2e 전용 lane — 기본 `pnpm test`와 분리)
- `services/proxy/package.json` — `test:e2e` 스크립트 추가.

**실행 (env-gated):**
```
VALHALLA_URL=http://localhost:8002 \
  pnpm --filter @wayfinder/proxy exec vitest run --config vitest.e2e.config.ts
```

**라이브 실행 증거 (mock 아닌 진짜 e2e — 실 컨테이너 Valhalla v3.7.0, 수도권 타일):**
```
[D3 live] safe N=10 → 2160s / 3049m, baseline=1150s, withinBudget=false
```
- 서울 시내 좌표(광화문↔경복궁 인근, 37.5663,126.9779 → 37.5704,126.9921).
- safe 프로필(use_lit=1.0, alley_factor=4.0, driveway_factor=8.0) 실 소요 **2160초 / 3049m**.
- baseline(fastest) **1150초** → safe가 +1010초 = 약 +16.8분 > N=10분(600초) → **withinBudget=false** (실 산출).
- 실 폴리라인(precision 6)이 한국 bbox(lat 37~38, lng 126~128) 내로 정규화 검증됨.
- walkable 프로필도 동일 체인 통과 검증.
- env 미설정 시 자동 skip 확인(2 skipped) · 기본 `pnpm test`는 e2e 미포함(266 tests) 확인.

---

## 발견 문제 (보고)

1. **[최소 수정] F1 슬롯이 import seam이 아닌 module-local stub이었음.**
   - `routeDirect.ts`의 `tryValhallaCustomRoute`는 `import`가 아닌 파일 내부 함수(항상 `null`)로 정착됨. OW1이 "핸들러가 실제로 provider+필터를 호출"을 증명하려면 핸들러가 OW1 배선에 도달해야 하나, module-local stub은 OW1 전용 파일에서 구현할 수 없었음.
   - **조치(최소 수정):** OW1 전용 `valhallaProvider.ts`에 `resolveValhallaCustomRoute`를 두고, `routeDirect.ts`는 로컬 stub 제거 + import 1줄로 위임하도록 변경. 디스패치 구조·기존 4모드 경로는 bit-for-bit 불변(Valhalla 슬롯 body만 교체).
   - **규칙 편차 명시:** 계획 §5 "routeDirect.ts F1 단독 소유·OW1 미접촉"의 문언과 어긋남. 단, 해당 stub 주석(`// F1 stub — OW1이 valhallaProvider + extraMinutesFilter 배선으로 대체`)이 OW1의 교체를 명시적으로 의도했고, "미접촉/불가침" 규칙의 보호 대상(기존 4모드 디스패치)은 불변 유지. 의존성 추가·워커 구현 로직 변경 없음.

2. **[빌드 환경] vitest config 주석 내 glob `**/*.test.ts`가 rolldown 파서 충돌.**
   - JSDoc 주석 안의 `*/` 시퀀스(glob)가 주석을 조기 종료시켜 config 로드 실패. 주석에서 해당 glob 제거로 해소(코드 로직 무관).

3. **(잔존 관찰, 범위 밖)** 작업 시작 시점에 이미 워킹트리에 C스트림 변경(`routeSummary.ts`·`RouteResultScreen.tsx`·`RouteResultScreen.test.tsx`·`RouteService.test.ts`)이 uncommitted 상태로 존재. 본 통합과 무관하며 미접촉.

---

## 최종 카운트
- **테스트:** 540 green (기반 531 → +9: OW1 wiring 4 + D2 mobile 5). 회귀 0.
- **라이브 e2e:** 2 pass (env-gated, 실 컨테이너) — `pnpm test`와 분리.
- **신규 파일:** `valhallaWiring.test.ts` · `routeFlowCustom.test.ts` · `e2e/valhalla.e2e.ts` · `vitest.e2e.config.ts`.
- **수정 파일:** `valhallaProvider.ts` · `routeDirect.ts`(슬롯만) · `package.json`(test:e2e).
