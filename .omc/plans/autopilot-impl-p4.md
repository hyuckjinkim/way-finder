# wayfinder Phase 4 — 자체 라우팅 엔진(Valhalla) + 커스텀 경로 + "+N분" 필터 (autopilot direct 모드)

> 단일 진실 소스: `docs/superpowers/specs/2026-06-07-map-navigation-app-design.md` (§2 P4 행, §1 차별화 목표, §3 P4 결정)
> 구조 참고: `.omc/plans/autopilot-impl-p2.md` (Foundation+5스트림 패턴)
> 작성: 2026-06-08 / 모드: direct (인터뷰 생략, 스펙 승인 완료) / 기반: P1+P2 완료 (커밋 11a173d, 테스트 401개)
> 선행 결정(2026-06-08): **P4를 P3보다 선행** — P3(GPS 네비)는 실기기 검증 불가 절벽이나, P4 Valhalla는 **로컬 Docker로 실검증 가능**하여 먼저 수행.
> 실행: **5개 병렬 스트림** (autopilot-state `teamSize:5`·P2도 5스트림). P2 "기계적 복제 금지" 교훈은 *스트림 형태*를 P1에서 복사하지 말라는 뜻 — 개수가 아님. P4는 Valhalla provider lane과 orchestration(+N 필터) lane을 **provider 인터페이스 seam에서 분리**해 opus 헤비 작업을 직렬이 아닌 병렬로 수행.

---

## 0. 핵심 설계 원칙 (실행 워커 필독 — P1·P2 계승 + P4 신규)

1. **계약 우선 병렬화.** 스트림 간 직접 의존은 최소화한다. 직접 의존이 존재하는 경우는 §5에 명시 (provider A → orchestration O join at OW1, D 통합 게이트). 그 외 모든 의존은 Foundation(F1~F4)으로만 향한다.
2. **두 개의 테스트 게이트는 서로 대체 불가 (P4 핵심 — carry-forward 게이트 ①).**
   - (게이트 A) **fetch-모킹 실-모드 단위 테스트**: Valhalla 핸들러/정규화기의 *실 모드 분기*를 fetch 모킹으로 커버. **데모 모드 테스트는 핸들러 커버리지로 불인정** (P1·P2 공통 결함 — P2 B스트림이 실제로 502 미배선 사고).
   - (게이트 B) **라이브 컨테이너 e2e**: 실행 중인 Valhalla 컨테이너에 실제 `/route` 호출. **P4를 P3보다 선행한 이유가 바로 이 게이트** — mock이 아닌 진짜 e2e.
   - 둘 중 하나가 다른 하나를 대체하지 못한다. 둘 다 green이어야 P4 완료.
3. **키 없이 전체 빌드·테스트 통과.** Valhalla는 로컬 self-hosted(키 불필요). 기존 4모드 외부 API는 데모 모드로 키 0개 동작 유지. `typecheck`·`test`·`web export`가 전부 green.
4. **웹이 P4 표시 검증 게이트.** 커스텀 경로 옵션 UI·결과 표시는 웹 export로 검증. 네이티브 디바이스 동작은 §"명시적 한계".
5. **장애 격리는 테스트 대상.** Valhalla 컨테이너 다운/타일 부재 시 silent failure 금지 — 명시적 에러 또는 기본 TMAP 도보로 폴백(설계 선택은 F1).
6. **공유 파일 단일 소유권 (P2 C2 패턴 계승 + P4 강화).** `modeHandlers.ts`·`index.ts`·`routeDirect.ts`·`config.ts`·`RouteService.ts` 디스패치 배선은 **F1 단독 소유**, fan-out 후 불가침. 스트림은 **자기 전용 파일만** 작성·덮어쓴다 — F1이 각 공유 파일에 프로필 파라미터 패스스루 + stub import 슬롯을 선행 정착시키고, 워커는 해당 stub 파일(전용 소유)만 구현한다.

### P1·P2에서 계승한 결정적 교훈 (이번 계획에 강제 반영)

| 교훈 | P4 강제 반영 |
|------|--------------|
| **실-모드 미배선 사고** (P2 B스트림: 핸들러가 502 반환, 엔진 함수는 green이나 라이브 미연결) | Valhalla 핸들러는 **fetch-모킹 실-모드 테스트(게이트 A) + `routeDirect.ts` 실 배선**이 둘 다 완료 기준. 순수 함수 단위 테스트만으로 "완료" 불인정. |
| **중복 유틸 산재** (`parseDurationSec`×2, `decodePolyline`×2, `[lng,lat]` 매퍼×3) | **F2에서 통합** (`@wayfinder/shared` 또는 `proxy/src/normalize/_shared`). 신규 Valhalla 정규화기는 통합 유틸만 사용. |
| **폴리라인 정밀도 함정** | Valhalla encoded polyline = **precision 6**, Google `@googlemaps/polyline-codec` 기본 = **precision 5**. 통합 디코더는 **precision 인자 필수** — 미파라미터화 시 좌표 10× 오차. (advisor 지적 — load-bearing) |
| **지식 기반 픽스처 byte-perfect 미보장** (P1·P2 한계) | **P4 업그레이드**: 실행 중인 Valhalla 컨테이너에서 **실 `/route` 응답을 골든 픽스처로 캡처** (F4). 응답 형식·폴리라인 정밀도가 구성에 의해 해결됨. |
| **wire 계약 드리프트** (P1 REJECT) | `RouteRequest` 확장(`preference`/`maxExtraMinutes`)은 F1 단일 진실 소스 + introspection 테스트 범위 자동 포함. 앱·프록시 양측 리터럴 0. |

---

## 1. Valhalla Costing 지원 범위 — 1차 출처 검증 완료 (이 계획의 헤드라인)

> 출처: Valhalla 공식 API 레퍼런스 (`valhalla.github.io/valhalla/api/turn-by-turn/api-reference/`, 2026-06-08 fetch 검증). **스펙의 `use_lit` 힌트는 부분 정정** — `use_lit`는 실재하나 안전=큰길+가로등 중 **가로등 절반만** 커버.

### 차별화 프로필 4종 — costing 지원 vs 그래프 보강 분리 (확정)

| 프로필 | 스펙 정의 | Valhalla costing (in-phase) | 지원 판정 | 후속 단계 |
|--------|----------|------------------------------|-----------|-----------|
| **걷기좋은** (walkable) | 보행자 친화 도로 선호 | `walkway_factor`(footway 가중)·`sidewalk_factor`(보도 가중) | ✅ **완전 지원 (P4)** | — |
| **안전** (safe) | 큰길 + 가로등 | **가로등**: `use_lit`(0=무관, 1=비점등도로 회피, OSM `lit=*` 태그 읽음) ✅ / **큰길**: prefer-major-road 옵션 **부재** — `alley_factor`·`driveway_factor`로 소로 *회피*만 가능(근사) | ⚠️ **부분 지원** — 가로등 ✅ / 큰길 ≈근사 | 큰길 직접 선호는 후속(도로 위계 가중 그래프 보강) |
| **한적** (quiet) | 유동인구 적은 경로 | 유동인구 모델 **부재**. `walkway_factor`+`use_living_streets`로 근사 | ⚠️ **근사만** | **그래프 보강** (유동인구 공공데이터) |
| **풍경** (scenic) | 공원·녹지 선호 | 공원/녹지/경관 옵션 **부재** | ❌ **미지원** | **그래프 보강** (서울 열린데이터 공원·녹지) |

### 검증된 핵심 사실 (워커 필독)
- **사용 가능 pedestrian costing 옵션 전체:** `walking_speed`(기본5.1km/h)·`walkway_factor`(1.0)·`sidewalk_factor`(1.0)·`alley_factor`(2.0)·`driveway_factor`(5.0)·`step_penalty`·`elevator_penalty`·`use_ferry`(0.5)·`use_living_streets`(0.6)·`use_tracks`(0.5)·`use_hills`(0.5)·`use_lit`(0)·`service_penalty`(0)·`service_factor`(1)·`destination_only_penalty`·`max_hiking_difficulty`(1)·`shortest`(false)·`max_distance`(100km)·`type`(blind|wheelchair)·`mode_factor`(1.5).
- **`use_lit` 정확 의미:** "0 = 점등 도로 무관, 1 = 비점등 도로 회피". OSM `lit=*` 태그 기반. → **가로등 enrichment(스펙이 계획한 공공데이터 보강)는 불필요** (OSM 태그+use_lit이 이미 처리). **이번 Phase의 비용 절감 win.**
- **`type: blind`** 모드: 시각장애인용 추가 안내 — 안전 프로필 보조로 검토 가능(이번 Phase 선택).
- **alternates 제약 (확정):** "Alternates are not yet supported on multipoint routes (>2 locations)." → **경유지 있는 경로는 alternates 불가.** 이 때문에 +N 필터의 1차 메커니즘으로 alternates를 쓰지 않는다(§아래).

### "+N분" 필터 — 2-call 백본 (alternates 비의존, 전 stop 수 동작)

스펙 §3: "+N분은 alternatives 필터로 구현". 그러나 alternates가 multipoint 미지원이므로 **alternates를 1차 메커니즘에서 demote**한다. 대신:

1. **기본 도보 costing 호출** → 최속 소요시간 `T` (preference 없는 표준 pedestrian).
2. **프로필 costing 호출** → 커스텀 경로 `P` (walkable/safe 등).
3. `duration(P) ≤ T + N` 이면 **P 서빙**, 아니면 **T 서빙(또는 P를 "예산 초과" 플래그로 표시 — F1 확정)**.

→ Valhalla 호출 2회/요청 (로컬·무료·무관). **경유지 유무 무관 동작.** alternates는 A→B 단순 경로에서 "예산 내 N개 메뉴 제공"의 **선택적 enhancement로만** demote(미구현 가능, open-question 로깅).

---

## 2. 모노레포 레이아웃 (P4 추가)

```
wayfinder/
├─ packages/shared/   # @wayfinder/shared — RouteRequest 확장(preference, maxExtraMinutes) + 프로필 상수
├─ apps/mobile/       # P4: 경로 옵션 UI (빠른/안전/한적 + N분 슬라이더; 풍경은 feature flag off) + RouteService 확장
├─ services/proxy/    # P4: valhalla provider + 2-call +N 필터 + 정규화 + 중복 유틸 통합
└─ services/valhalla/ # 신규 — Docker 인프라(타일 빌드 스크립트, compose, costing 프로필 설정, 골든 픽스처 캡처)
```

---

## 3. Foundation (순차 — 모든 스트림 blocking · 와이어 계약 + 인프라 + 유틸 통합)

> F1 → F2 병렬 → (F3 인프라는 F1 독립 병렬 시작 가능) → F4(골든 픽스처)는 F3 완료 후. **Foundation이 P4의 무게중심**(인프라+계약+유틸 통합). fan-out 전 전부 green.

### F1. 와이어 계약 — RouteRequest 확장 + 프로필 상수 + 디스패치 슬롯 + introspection
- **파일 (F1 단독 소유 — 모든 공유 파일 포함):**
  - `packages/shared/src/types/route.ts` (확장 — `RoutePreference` 신규, `RouteRequest`에 `preference?`·`maxExtraMinutes?` 추가)
  - `packages/shared/src/constants/routing.ts` (확장 — 프로필 enum·기본 N·costing 파라미터 상수)
  - `packages/shared/src/index.ts` (export 추가)
  - `services/proxy/src/config.ts` (**F1 단독 소유** — `VALHALLA_URL` env, `isValhallaCustomRoute` 판정. OW2는 이 파일 미접촉)
  - `services/proxy/src/routes/routeDirect.ts` (**F1 단독 소유** — kr+walk+preference 분기 슬롯; 기존 4모드 경로 불변. OW1은 이 파일 미접촉)
  - `apps/mobile/src/services/RouteService.ts` (**F1 단독 소유** — preference·N 전달 패스스루; apiPost body 확장. C1은 이 파일 미접촉)
  - `services/proxy/src/contract.test.ts` (확장 — RouteRequest 확장 필드 introspection)
- **내용 (확정 결정):**
  1. **`RoutePreference` 정의:** `'fastest' | 'walkable' | 'safe' | 'quiet' | 'scenic'`. `RouteRequest`에 `preference?: RoutePreference`(미지정=`'fastest'`=기존 동작)·`maxExtraMinutes?: number`(미지정=무제한) 추가. **기존 P2 호출자는 미지정으로 동작 불변** (하위호환). **`Route`에 선택 응답 메타 `customMeta?: { preference: RoutePreference; withinBudget: boolean; baselineDurationSec?: number }`** 추가 — 2-call +N 결과의 단일 표면(데모=F2 합성, 실=OW1 산출). C3 요약·D2 게이트의 단일 입력.
  2. **프로필→costing 매핑 상수** (`routing.ts`): `walkable`→`{walkway_factor:2.0, sidewalk_factor:2.0}`, `safe`→`{use_lit:1.0, alley_factor:4.0, driveway_factor:8.0}`, `quiet`→`{walkway_factor:1.5, use_living_streets:1.0}`. `scenic`는 **costing 상수 없음(❌ 미지원)** — `RoutePreference` 타입에는 존재하나 costing 매핑 테이블에는 항목 없음. JSDoc에 "scenic은 그래프 보강 후속 단계에서 활성화, P4에서는 feature flag off" 명시. 값은 §1 검증된 옵션만.
  3. **`maxExtraMinutes` 기본·상한 상수.** UI 슬라이더 범위(예: 0~30분)와 동기. shared 단일 진실 소스.
  4. **`isValhallaCustomRoute(region, mode, preference)` 판정** (config.ts): `region==='kr' && mode==='walk' && preference && preference!=='fastest'` → Valhalla 경로. 그 외 = 기존 P2 경로. **Valhalla는 한국·도보·커스텀에만 진입** — 기존 4모드 전부 불변.
  5. **`routeDirect.ts` 분기 슬롯 + `ValhallaProvider` 인터페이스:** kr+walk 분기에 "preference set이면 Valhalla, 아니면 TMAP" 위임 슬롯을 **F1이 stub(501 or TMAP 폴백)으로 생성**. **F1이 provider 인터페이스 `ValhallaProvider { route(stops, costingOptions): Promise<Route> }`를 정의** — OO1(orchestration) 필터가 이 인터페이스 mock으로 O lane 대기 없이 병렬 작성. OW1 스트림이 슬롯의 Valhalla 측만 배선 — `routeDirect.ts`의 *기존 TMAP/카카오/Google 경로는 불가침*.
  6. **`RouteService.ts` 패스스루:** `getRoute`가 preference·maxExtraMinutes를 apiPost body에 포함. 파라미터 전달 구현은 F1이 완료. C1은 `RouteService.test.ts`(테스트 파일) 전담 — 전달 단언만 작성.
  7. **introspection/계약 테스트:** `RouteRequest` 확장이 앱·프록시·shared 양립함을 단언. POST body에 preference·N이 통과·검증됨(OW2 validate 확장 범위). **확장 필드 미등록을 테스트 실패로 만든다** (P1 드리프트 패턴).
- **blockedBy:** 없음
- **완료 기준:** `pnpm --filter @wayfinder/shared typecheck` + `pnpm --filter proxy test` green. 기존 401 테스트 회귀 없음. 확장 필드 누락이 contract.test 실패로 잡힘 1회 실증.
- **난이도:** opus

### F2. 중복 유틸 통합 + precision 파라미터 디코더 (carry-forward ②)
- **파일:** `services/proxy/src/normalize/_shared/{duration,polyline,coords}.ts` + 각 통합 테스트. 기존 `googleRoutes.ts`·`googleTransit.ts`·`kakaoMobility.ts`·`mapboxDirections.ts`·`tmapPedestrian.ts`·`odsayTransit.ts`를 통합 유틸 import로 리팩터.
- **내용:**
  1. **`parseDurationSec`** 통합 (현 googleRoutes·googleTransit 2곳 중복) → `_shared/duration.ts`. `'123s'` 문자열·숫자(초) 양형 처리.
  2. **`decodePolyline(encoded, precision)`** 통합 (현 googleRoutes·googleTransit 2곳) → `_shared/polyline.ts`. **precision 인자 필수** (Google=5, **Valhalla=6**). 기존 호출자는 precision 5 명시 전달로 동작 불변. 신규 Valhalla 정규화기는 precision 6.
  3. **`flatPairsToCoords` / `pairsToCoords`** 통합 (현 kakaoMobility `flatVertexesToCoords`·mapbox/tmap inline `.map(pair=>...)` 3곳) → `_shared/coords.ts`. `[lng,lat,...]` 평면 배열 + `[[lng,lat],...]` 쌍 배열 양형 헬퍼.
  4. **리팩터는 동작 보존** — 각 정규화기 기존 단위 테스트가 회귀 없이 green이어야 한다(behavior-preserving 통합).
  5. **(advisor — 데모 예산 플래그 owner) `mockRouteProvider` 확장:** 2-call T-vs-P 비교는 실 모드(OO1 proxy)에만 존재 — 데모 모드는 단일 Route만 반환해 "예산 내/초과" 플래그를 자연 생산하지 못한다. → `Route`에 **선택 메타 `customMeta?: { preference: RoutePreference; withinBudget: boolean; baselineDurationSec?: number }`**(F1에서 동결)를 추가하고, `mockRouteProvider`가 preference·maxExtraMinutes를 받아 **합성 플래그**를 채운다(예: scenic·작은 N → `withinBudget:false`). 이로써 데모 웹 게이트(D2)가 플래그 표시를 실제로 행사. 실 모드 OO1은 동일 `customMeta`를 실 산출값으로 채운다(데모/실 동일 표면). **이 필드는 C3 요약·D2 게이트의 단일 입력.**
- **blockedBy:** F1 (Route·customMeta 타입 동결)
- **완료 기준:** `pnpm --filter proxy test` + `pnpm --filter @wayfinder/shared test` green — 통합 유틸 단위 테스트(precision 5/6 양쪽 좌표 정확성 포함) + 6개 정규화기 기존 테스트 회귀 0 + `mockRouteProvider`가 preference·N으로 `customMeta.withinBudget`를 결정론적으로 채움. 중복 정의 0개(grep: `function parseDurationSec`·`function decodePolyline` 각 1개).
- **난이도:** sonnet

### F3. Valhalla 인프라 — Docker + 타일 빌드 + costing 프로필 설정
- **파일:** `services/valhalla/{docker-compose.yml, Dockerfile?, build-tiles.sh, README.md, .gitignore}`, `services/valhalla/conf/` (costing 프로필 JSON 템플릿)
- **내용 (환경 확인됨 — §환경):**
  1. **공식 이미지** `ghcr.io/valhalla/valhalla`(레지스트리 reachable 확인). compose로 tile-build 1회 + serve 분리.
  2. **OSM 추출 — 수도권 우선 (RAM 갭 해소):** P4 1차 빌드는 **수도권(서울+경기) bbox** 추출로 범위 제한. geofabrik `south-korea-latest.osm.pbf`(~900MB)를 `osmium extract --bbox=126.7,37.4,127.3,37.7` (또는 BBBike 수도권 추출)로 잘라 빌드 입력 크기를 ~150MB 수준으로 축소 — 가용 RAM ~4.7GB 대비 안전. 커스텀 경로 데이터(서울 열린데이터)와 bbox 정합 필수 확인. `build-tiles.sh`가 osmium extract → `valhalla_build_config` → `valhalla_build_tiles` 순서 실행.
  3. **메모리 전략:** `valhalla_build_tiles` 실행 시 `mjolnir.concurrency=1` 설정 + Docker compose `mem_limit: 4g` 상한 명시. OOM 방지 및 재현 가능 빌드 보장.
  4. **볼륨 = WSL 네이티브 경로(`~/valhalla-tiles` 등) 권장** (IO 속도 — `/mnt/d` 회피). compose 볼륨·README에 명시. 타일은 `.gitignore`(대용량, 재생성 가능).
  5. **costing 프로필 설정:** §1 검증 옵션 기반 3프로필 costing JSON 템플릿(walkable/safe/quiet). scenic은 grph 보강 후속 — P4 템플릿 없음.
  6. **헬스 체크:** 컨테이너 기동 후 `valhalla` `/status` 또는 단순 `/route` 스모크가 200을 반환함을 스크립트로 확인.
  7. **전국 타일 빌드는 사용자 액션:** south-korea 전체 pbf(~900MB) 기반 전국 빌드는 §7 "전국 타일 빌드" 섹션 참조 — RAM 8GB+ 또는 야간 빌드 필요.
- **blockedBy:** 없음 (F1 독립 — 병렬 시작)
- **완료 기준:** `services/valhalla/` 스크립트로 **수도권 타일 빌드 성공 + 컨테이너 기동 + 샘플 도보 `/route` 200 응답**. README에 1-커맨드 기동 절차. (이 게이트가 게이트 B의 전제) **타일 빌드는 장시간** — `run_in_background`.
- **난이도:** opus

### F4. 골든 픽스처 캡처 (라이브 컨테이너 → 실 응답 픽스처)
- **파일:** `services/proxy/src/fixtures/valhalla/{walkSimple,walkWaypoints,safeProfile,...}.ts` (실 캡처 응답), `services/valhalla/capture-fixtures.sh`
- **내용:** **P4 업그레이드** (P1·P2의 지식 기반 픽스처 대비). F3 기동 컨테이너에 실제 `/route` 호출(서울 좌표쌍·각 프로필·경유지 케이스) → 응답 JSON을 골든 픽스처로 저장. **응답 형식·폴리라인 정밀도(precision 6)가 구성에 의해 확정** — A스트림 정규화기가 추측 아닌 실 데이터로 작성. fetch-모킹 실-모드 테스트(게이트 A)가 이 픽스처를 입력으로 사용.
- **blockedBy:** F3 (기동 컨테이너 필요)
- **완료 기준:** 각 프로필·경유지 케이스 실 응답 픽스처 ≥1개 저장. 픽스처가 결정론적(좌표 고정). polyline precision 6 실증(좌표가 한국 bbox 내).
- **난이도:** sonnet

> **Foundation 완료 = F1·F2·F3·F4 전부 green + 기존 401 테스트 회귀 없음 + 컨테이너 기동 검증.** 이후 A·O·B·C·D 동시 시작.

---

## 4. 병렬 스트림 (Foundation 완료 후 5스트림 동시 실행)

> **A/O 분할 (advisor — provider seam):** F1이 **provider 인터페이스**(`ValhallaProvider.route(stops, costingOptions): Promise<Route>`)를 정의하므로, 정규화+HTTP(스트림 A)와 2-call +N 엔진(스트림 O)이 *인터페이스에 대해* 병렬로 작성된다. 통합 배선(OW1)만 양쪽 join. opus 헤비 작업을 한 워커에 직렬화하지 않음.

### 스트림 A — Valhalla provider lane (정규화 + HTTP)
**워커 1 · blockedBy: F1, F2, F4**

| # | 작업 | 파일 | blockedBy | 완료 기준 | 난이도 |
|---|------|------|-----------|-----------|--------|
| A1 | Valhalla 응답 정규화 | `services/proxy/src/normalize/valhalla.ts` + 테스트 | F2,F4 | F4 골든 픽스처 → `Route`/`RouteLeg` 변환. **F2 통합 디코더 precision 6** 사용(앱 디코드 0 — C1 계승). duration 파싱·coords·leg 매핑 단위 테스트 | opus |
| A2 | Valhalla provider (HTTP + costing body, **F1 인터페이스 구현**) | `services/proxy/src/routes/valhallaProvider.ts` | A1 | stops+preference → Valhalla `/route` body(§1 costing 상수). F1 `ValhallaProvider` 인터페이스 구현. **fetch-모킹 실-모드 테스트(게이트 A)** — 데모 테스트 불인정. 컨테이너 다운 시 명시적 에러(silent 금지) | opus |

### 스트림 O — Orchestration lane (2-call +N 필터 엔진 + 실 배선 + 검증)
**워커 2 · blockedBy: F1 (provider 인터페이스에 대해 작성 — A lane 구현 대기 안 함)**

| # | 작업 | 파일 | blockedBy | 완료 기준 | 난이도 |
|---|------|------|-----------|-----------|--------|
| OO1 | **2-call +N 필터 엔진** (인터페이스 대상) | `services/proxy/src/routes/extraMinutesFilter.ts` + 테스트 | F1 | §1 백본: 기본 costing→T, 프로필 costing→P, `P≤T+N` 판정. **F1 provider 인터페이스를 mock으로 주입**해 테스트(A lane 대기 0). 경유지 무관. 산술·경계(N=0, P>T+N 폴백)·플래그 단위 테스트(F1 확정 폴백 규약) | opus |
| OW1 | **`valhallaProvider.ts` 실 배선** (A+O join) | `services/proxy/src/routes/valhallaProvider.ts` (A2와 협력 — A2가 provider 구현 완료 후 OW1이 extraMinutesFilter와 결합) | A2,OO1 | `isValhallaCustomRoute` 참이면 valhallaProvider(A2)+필터(OO1) 위임. **fetch-모킹 실-모드 통합 테스트로 배선 실증**(P2 B 미배선 사고 방지 — 핸들러가 실제로 엔진 호출함을 단언). `routeDirect.ts` 미접촉 — F1 소유 불가침 | opus |
| OW2 | 데모 모드 + 장애 격리 + 입력 검증 | `services/proxy/src/routes/routeValidate.ts`(preference·N 검증 확장) | OW1 | Valhalla URL 미설정 시 데모 또는 TMAP 폴백(F1 규약, config.ts 미접촉). preference·maxExtraMinutes 범위·화이트리스트 검증. 단위 테스트 | sonnet |

### 스트림 B — 앱 경로 옵션 UI (프로필 선택 + N분 슬라이더)
**워커 3 · blockedBy: F1 (목 데이터 동작, A/O 대기 안 함)**

| # | 작업 | 파일 | blockedBy | 완료 기준 | 난이도 |
|---|------|------|-----------|-----------|--------|
| B1 | 프로필 선택 상태 + 매핑 | `apps/mobile/src/route/routePreference.ts` + 테스트 | F1 | 빠른/걷기좋은/안전/한적 4개 선택 순수 함수 → `RouteRequest.preference` 매핑. 단위 테스트(4+기본=5상태 매핑) | sonnet |
| B2 | N분 슬라이더 로직 | `apps/mobile/src/route/extraMinutes.ts` + 테스트 | F1 | 0~상한(F1 상수) 클램프·기본값 순수 함수 → `maxExtraMinutes`. plain RN(신규 네이티브 의존 0 — P2 C3 교훈). 단위 테스트 | sonnet |
| B3 | 경로 옵션 UI 컴포넌트 | `apps/mobile/src/route/RouteOptionsBar.tsx` | B1,B2 | **빠른/걷기좋은/안전/한적 segmented + N분 슬라이더**(plain RN). 풍경 버튼은 `ENABLE_SCENIC` feature flag(기본 off) 뒤에 숨김 — 그래프 보강 완료 후 활성화. 풍경 버튼 미노출(flag off) 상태가 웹 export 렌더 통과 기준. P2 ModeTabsBar 패턴 재사용. | sonnet |

### 스트림 C — RouteService 테스트 + 상태 + 결과 표시 확장
**워커 4 · blockedBy: F1 (목 데이터 동작)**

| # | 작업 | 파일 | blockedBy | 완료 기준 | 난이도 |
|---|------|------|-----------|-----------|--------|
| C1 | RouteService 와이어 테스트 | `apps/mobile/src/services/RouteService.test.ts` | F1 | F1이 구현한 `getRoute`의 preference·maxExtraMinutes 전달 단언. **와이어 테스트: routesPath 상수 + 확장 body 전달 단언**(P1 드리프트 패턴 계승). `RouteService.ts` 미접촉 — F1 소유 불가침. | sonnet |
| C2 | 상태 + 디바운스 (옵션 변경) | `apps/mobile/src/state/routeStore.ts`·`routeQueries.ts`(확장) | C1 | preference·N을 store·쿼리 키에 포함. 슬라이더 연속 변경 디바운스(§11 쿼터 — Valhalla 로컬이라 비용은 없으나 호출 억제 일관성). 캐시 키·디바운스 단위 테스트 | sonnet |
| C3 | 결과 표시 — 프로필·예산 메타 | `apps/mobile/src/route/routeSummary.ts`(확장)·`RouteResultScreen.tsx` | C2 | 요약에 **`Route.customMeta`**(F1) 소비 — 선택 프로필 + "+N분 내/초과"(`withinBudget`) 플래그 표시. P2 routeToPolylines·summary 재사용(MapPolyline 불변). `customMeta` 미존재(기존 P2 경로) 시 플래그 미표시(하위호환). 단위 테스트 | sonnet |

### 스트림 D — 인프라 통합 + 웹 게이트 + 라이브 e2e (게이트 B)
**워커 5 · blockedBy: F1, F3 (B/C 산출 후반 통합)**

| # | 작업 | 파일 | blockedBy | 완료 기준 | 난이도 |
|---|------|------|-----------|-----------|--------|
| D1 | 라우트 배선 (옵션 UI → 결과) | `apps/mobile/app/route/*`·`_layout.tsx`(확장) | F1 | P2 expo-router에 옵션 UI 연결. 빈 stub 우선, B/C 도착 시 연결. 웹 export 라우트 등록 | sonnet |
| D2 | 데모 모드 웹 게이트 | E 스모크(P2 routeFlow 패턴 확장) | D1,B*,C* (완료된 join) | 키 0개 `expo export --platform web` green + **데모 흐름**: 경로입력→옵션(빠른/걷기좋은/안전/한적+N슬라이더, 풍경 미표시)→결과(폴리라인+프로필·예산 요약)가 목 데이터 동작. **`mockRouteProvider`가 채운 `customMeta.withinBudget`(F2)로 "예산 내/초과" 플래그 표시를 실제 행사** — 합성 플래그라 실 컨테이너 불요(게이트 B와 분리) | opus |
| D3 | **라이브 컨테이너 e2e (게이트 B)** | `services/proxy/e2e/valhalla.e2e.ts` (env-gated) | OW1,F3 | **실행 중 Valhalla 컨테이너**에 프록시 실 모드 `POST /v1/routes`(preference·N) → 실 `/route` 응답 정규화·필터 검증. **mock 아닌 진짜 e2e** — P4 선행 이유. CI 기본 스킵(컨테이너 env-gated), 로컬 1-커맨드 실행 문서화 | opus |

---

## 5. 의존 그래프 요약

```
F1 (와이어계약: RouteRequest+preference+N+customMeta · ValhallaProvider 인터페이스 · routeDirect 슬롯 · RouteService 패스스루 · config.ts 판정 · 디스패치 불변)
 ├─> F2 (중복 유틸 통합 + precision 디코더 + mock 예산 플래그) ─┐
 │                                                              ├─> A  (Valhalla provider: 정규화+HTTP) [워커1]
 │                                                              │      └──┐
 ├──────────────────────────────────> O  (orchestration: 2call+N 엔진→배선+검증)─┴─ OW1 join [워커2]
 ├──────────────────────────────────> B  (경로 옵션 UI: 빠른/걷기좋은/안전/한적+슬라이더) [워커3]
 ├──────────────────────────────────> C  (RouteService 테스트·상태·결과 확장)   [워커4]
 └─> F3 (Valhalla Docker+수도권 타일+costing) ─> F4 (골든 픽스처 캡처) ──┘
              └─────────────────────────────────────────────────> D  (웹게이트+라이브 e2e)[워커5]
```

- **Foundation 임계 경로:** F1 → F2 (순차). **F3는 F1 독립 병렬 시작**(타일 빌드 장시간 — 일찍 `run_in_background`). F4는 F3 후.
- **병렬 진입점:** Foundation(F1·F2·F3·F4) 완료 즉시 A·O·B·C·D 동시(5스트림). 스트림 간 직접 `blockedBy`는 A→O join(OW1)과 D 통합 게이트 2곳에만 존재. 나머지는 전부 Foundation으로만 향한다.
- **A/O 분할 (provider seam):** A=정규화+HTTP(`valhalla.ts`·`valhallaProvider.ts`), O=필터 엔진(`extraMinutesFilter.ts`)+배선+검증. OO1 필터는 **F1 provider 인터페이스를 mock 주입**해 A 구현 대기 없이 병렬. 유일 join=OW1(`valhallaProvider.ts` 배선)이 A(provider 구현)+OO1(필터)을 묶음.
- **불가침 파일:** `routeDirect.ts`·`config.ts`·`RouteService.ts`·`modeHandlers.ts`·`index.ts` = F1 단독 소유. O스트림(OW1)은 F1이 만든 kr+walk+preference 슬롯에 연결되는 `valhallaProvider.ts`만 배선(routeDirect.ts 미접촉). C1은 `RouteService.test.ts`만 편집(RouteService.ts 미접촉). OW2는 `routeValidate.ts`만 편집(config.ts 미접촉).
- **두 게이트:** 게이트 A(fetch-모킹 실-모드, A2/OW1) + 게이트 B(라이브 컨테이너 e2e, D3) — 상호 대체 불가.

---

## 6. P4 완료 기준 (전체 게이트)

- [ ] `pnpm install` 성공(WSL2 폴링) + lockfile 동결 (신규 의존 시)
- [ ] `pnpm -r typecheck` 무오류 (shared / proxy / mobile)
- [ ] `pnpm -r test` 전부 green — **기존 401 테스트 회귀 없음** + 신규: Valhalla 정규화(precision 6)·2-call +N 필터 산술·preference 검증·중복 유틸 통합(precision 5/6)·RouteService 와이어·결과 요약
- [ ] **(게이트 A) fetch-모킹 실-모드 테스트**: valhallaProvider·routeDirect 실 배선이 fetch 모킹으로 커버 — **데모 모드 테스트 불인정**. 핸들러가 실제로 엔진을 호출함을 단언(P2 B 미배선 사고 방지)
- [ ] **중복 유틸 통합 실증**: `parseDurationSec`·`decodePolyline`·`[lng,lat] 매퍼` 정의가 각 1개(grep). precision 인자 미파라미터화 0
- [ ] `wrangler deploy --dry-run` (proxy) 키 없이 성공 — `POST /v1/routes` preference·N 등록
- [ ] `expo export --platform web` (mobile) 성공
- [ ] **데모 모드 웹 흐름**: 경로입력 → 옵션(빠른/걷기좋은/안전/한적 + N분 슬라이더, 풍경 미표시) → 결과(폴리라인 + 프로필·예산 요약)가 목 데이터 동작
- [ ] **(게이트 B) 라이브 컨테이너 e2e**: `services/valhalla/` 수도권 타일 빌드+기동 → 프록시 실 모드 → 실 `/route` 정규화·+N 필터가 실 데이터로 동작 (로컬 1-커맨드, env-gated)
- [ ] 키·시크릿 미포함 — CI 시크릿 스캔 green (Valhalla는 키 불필요)

---

## 7. 사용자 액션 필요

> Valhalla는 로컬 self-hosted(키 0개). 아래는 인프라 빌드 환경·후속에만.

1. **(가능성) geofabrik pbf 다운로드** — south-korea pbf(~900MB) 다운로드가 네트워크 throttle로 실패하면 사용자가 수동 다운로드 → `services/valhalla/data/`에 배치. P4 빌드는 이 파일에서 osmium으로 수도권 bbox를 추출해 사용. (302 reachable·스트림 검증됨이나 대용량 — 자동 실패 시 폴백)
2. **(선택) 전국 타일 빌드** — south-korea 전체 pbf 기반 전국 타일 빌드는 RAM 8GB+ 또는 야간 빌드 환경 필요. `build-tiles-full.sh` (별도 스크립트)로 제공. P4 기능 검증과 분리.
3. **(후속 Phase) 그래프 보강 데이터** — 풍경(서울 열린데이터 공원·녹지)·한적(유동인구 공공데이터). **이번 P4 범위 밖** — costing 미지원 항목의 후속 단계. 보강 완료 시 `ENABLE_SCENIC` flag 활성화.
4. **(Phase 4 운영 — 스펙 §11) Valhalla 서버 비용** — 개발은 로컬 Docker 무료. 프로덕션 호스팅(VPS 월 $20~50)은 사용자 증가 실측 후 별도 결정.

---

## 8. 명시적 한계

- **커스텀 경로 = 한국·도보 전용.** Valhalla 타일은 수도권(서울+경기) bbox — 글로벌 커스텀 라우팅·도보 외 모드 커스텀은 범위 밖(기존 4모드는 kakao/tmap/google 불변). 전국 확장은 §7-2 전국 타일 빌드 사용자 액션.
- **풍경(scenic)은 P4 UI 미노출** — Valhalla costing 미지원(❌). `ENABLE_SCENIC` feature flag(기본 off) 뒤에 숨김. 그래프 보강(서울 열린데이터 공원·녹지) 완료 후 후속 단계에서 활성화. **`RoutePreference` 타입에는 존재하나 P4 UI·costing 매핑에서는 비활성.**
- **한적(quiet)은 costing 근사만** — `walkway_factor`+`use_living_streets` 근사. 직접 지원은 그래프 보강 후속(§7-3). **이번 Phase 과욕 금지** (스펙·1차 출처 검증 반영).
- **안전=큰길+가로등 중 큰길은 근사** — `use_lit`로 가로등 ✅, 큰길(prefer-major-road)은 Valhalla 옵션 부재 → `alley_factor`·`driveway_factor` 소로 회피로 근사. 도로 위계 직접 선호는 후속.
- **alternates는 multipoint 미지원** — +N 필터는 2-call 백본으로 우회(경유지 무관 동작). alternates 메뉴는 A→B 전용 선택적 enhancement(미구현 — open-question).
- **골든 픽스처는 캡처 시점 타일 기준** — OSM 수도권 추출 버전·costing 설정에 의존. 타일 재빌드 시 픽스처 재캡처 필요(README 명시).
- **네이티브 지도 폴리라인 디바이스 렌더 미검증** — Mac/실기기 부재. 웹 export가 일상 검증 채널(P1·P2 한계 계승).
- **`use_lit` 효과는 OSM `lit=*` 태그 커버리지 의존** — 한국 OSM 가로등 태그가 희소하면 안전 프로필 효과 제한. 실 데이터 커버리지는 라이브 e2e 후 평가(open-question).
