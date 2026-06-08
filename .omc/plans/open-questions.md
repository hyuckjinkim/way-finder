# Open Questions

## Phase 2 (경유지 길찾기) - 2026-06-07
- [ ] TMAP 자전거 경로 API 실 응답 형식 미검증 — 자전거 한국 공급자 결정(TMAP)을 했으나 fetch 불가로 byte-perfect 미확인. 키 발급 후 스모크 테스트로 검증 필요. 미가용 시 도보 leg-chaining 폴백 동작 확인. (정규화 함수 작성·실 모드 동작에 영향)
- [ ] 대중교통 환승 대기 버퍼 상수값 — 실측 데이터 없이 고정 상수로 시작. ODsay subPath 환승 도보 시간과 별개의 "환승 대기" 버퍼를 몇 분으로 둘지 결정 필요. (leg-chaining 총 소요시간 정확도에 영향)
- [ ] Google Routes 키와 P1 Google Places 키 재사용 가능 여부 — 동일 Google Cloud 프로젝트에서 Routes API 활성화 시 별도 키/쿼터 정책 확인 필요. (사용자 키 발급·쿼터 하드캡 설정에 영향)
- [ ] 시외 도시간 구간 판정 임계 — ODsay searchPubTransPathT가 시내/도시간을 자동 분기하는지, 아니면 거리·노선타입 기준으로 프록시가 3단 스티칭 트리거를 판정해야 하는지 실 형식 검증 후 확정. (B3 시외 스티칭 분기 로직에 영향)

### 스트림 B (프록시 대중교통) — 2026-06-08
- [ ] **B 실 모드 미배선(블로커):** `routes/routeTransit.ts` 실 경로가 502를 반환하고 `chainTransitLegs`/`stitchIntercity`/`normalizeOdsayTransit`를 호출하지 않는다. 엔진·정규화는 순수 함수로 단위 테스트 완료(green)이나 라이브 핸들러에 연결 안 됨. 원인: `config.ts Env`에 `ODSAY_API_KEY` 부재 + config.ts는 B 경계 밖(F1/A 소유). **F1/A 소유자가 `config.ts Env`에 `ODSAY_API_KEY` 추가 + `isRouteDemoMode`에 transit 데모 분기 추가**해야 실 모드 transit 배선 가능.
- [ ] **B3 시외 판정 휴리스틱 미검증:** 출발·도착 위도 차 > 1.5°로 도시간을 근사(`INTERCITY_LAT_THRESHOLD`, mockRouteProvider와 동기). 실 거리/행정구역 데이터 부재 — §5 스모크에서 ODsay 도시간 응답 형식 확인 후 정밀화.
- [ ] **ODsay/Google transit 실 형식 미검증:** §6 부록 지식 기반 raw 픽스처(`fixtures/{odsayTransit,googleTransit}.ts`) — byte-perfect 미보장. 실 형식 검증은 §5 스모크/키 발급 후로 연기.
- [ ] **`legs-1` 버퍼 규약 — 3-leg 픽스처에서만 검증:** `transferCount = legs.length - 1`이 F2 TRANSIT_CHAIN(1920)/INTERCITY_STITCH(11400) 양쪽을 재현. 단, 실 다구간 체인에서 한 구간이 이미 내부 환승 도보 leg를 포함하면 버퍼를 과대 계산할 수 있음(실 모드 미배선이라 현재는 무영향 — 배선 시 재검토).

## Phase 4 (Valhalla 커스텀 경로) - 2026-06-08
- [ ] **풍경·한적 그래프 보강 데이터원 미확정** — 풍경(서울 열린데이터 공원·녹지)·한적(유동인구 공공데이터)의 실 데이터셋·스키마·갱신주기 미조사. P4는 costing 근사만, 직접 지원은 후속 Phase. — 차별화 4프로필 중 2개의 완전 지원에 영향
- [ ] **alternates 메뉴(A→B 전용) 구현 여부** — Valhalla alternates는 multipoint 미지원이라 +N은 2-call 백본으로 우회. A→B 단순 경로에서 "예산 내 N개 메뉴" enhancement는 선택적 미구현. 사용자 가치 확인 후 결정. — 커스텀 경로 UX 풍부도에 영향
- [ ] **한국 OSM `lit=*` 태그 커버리지** — `use_lit` 효과는 OSM 가로등 태그 밀도에 의존. 희소하면 안전 프로필 효과 제한. 라이브 e2e 후 실측 평가. — 안전 프로필 실효성에 영향
- [ ] **+N 초과 시 폴백 규약 (F1 확정 필요)** — `duration(P) > T+N`일 때: T(최속) 서빙 vs P를 "예산 초과" 플래그로 서빙 — 둘 중 무엇이 UX상 옳은지 F1에서 확정. — +N 필터 결과 표시·사용자 기대에 영향
- [ ] **geofabrik south-korea pbf 다운로드 안정성** — 302 reachable·스트림 검증됨이나 ~900MB 대용량 throttle 가능. 자동 다운로드 실패 시 사용자 수동 배치 폴백 동작 확인 필요. — F3 타일 빌드 자동화에 영향
- [ ] **`type: blind` 모드 안전 프로필 편입 여부** — Valhalla pedestrian `type:blind`(시각장애 추가 안내) 옵션을 안전 프로필 보조로 쓸지 미결. 이번 Phase 선택 사항. — 안전 프로필 costing 구성에 영향

## Phase 3 (도보 턴바이턴 네비게이션) - 2026-06-08
- [ ] **P3 실기기 GPS 동작 전반 미검증 (환경 절벽)** — Mac·실기기·에뮬레이터 부재. 실 GPS update cadence/accuracy·백그라운드 추적 지속·실 이동 시 이탈→재탐색·안내 중 화면 wake는 키+에뮬레이터/실기기 확보 후 별도 QA. P3 "완료"는 typecheck+합성 시퀀스+mock-expo-location 실-분기+웹 export까지. — P3 가치(GPS 런타임) 실증에 영향
- [ ] **이탈 임계·도착 반경·재탐색 디바운스 상수 튜닝** — `OFF_ROUTE_THRESHOLD_M`·`ARRIVAL_RADIUS_M`·`REROUTE_DEBOUNCE_MS`를 합성 검증값으로 시작. 실 GPS 노이즈 특성 미반영 — 디바이스 QA 후 튜닝 필요. — 이탈 감지·도착 판정 정확도에 영향
- [ ] **TMAP 보행자 턴 데이터 실 형식 미검증** — TMAP Point feature properties의 turnType/description를 RouteStep으로 추출할지 best-effort. 픽스처 byte-perfect 미보장(P2 한계). 키 발급 후 실 응답으로 표준 도보 턴 카드 활성화 여부 결정. 미추출 시 TMAP 도보는 폴리라인 추종 네비(턴 카드 없이 거리·도착). — 표준 도보(TMAP) 턴바이턴 풍부도에 영향
- [ ] **`expo-keep-awake` 화면 wake 의존 도입 확정** — 현재 미설치. D3 화면 wake 배선 시 신규 의존 추가 필요. 추가 시 lockfile 동결·키 0개 빌드/웹 export 무영향 확인. 디바이스 wake 동작은 post-key/에뮬레이터. — 안내 중 화면 유지 기능에 영향

## Phase 5 (전 모드 턴바이턴 + 음성 안내 + 실시간 교통 · 마지막 Phase) - 2026-06-08
- [ ] **실시간 교통 무료 티어 viability 미확정 (deferred 가능)** — Google traffic-aware 라우팅(`routingPreference: TRAFFIC_AWARE`)은 상위 SKU(Routes Advanced/Preferred)로 무료 Essentials 아님. 카카오 모빌리티 실시간 교통 무료 범위 미확정. 스펙 §11 무료 티어 정책상 라이브 교통은 viability 확정 후 — 미viable 시 라이브 deferred(P5는 정규화·표시 메타 픽스처까지). — 실시간 교통 기능 라이브 동작 여부에 영향
- [ ] **카카오 car `guides[]` 실 형식 미검증** — `sections[].guides[]`의 x/y 좌표계(WGS84 여부)·type numeric 코드표가 키 없어 미확인. RouteStep 추출(location·maneuver 매핑) 정합은 키 발급 후 검증. 픽스처는 지식 기반(byte-perfect 미보장). — 자동차(한국) 턴바이턴 step 추출 정확도에 영향
- [ ] **Google Routes `navigationInstruction` 필드마스크·maneuver enum 실 값 미검증** — `routes.legs.steps.navigationInstruction.maneuver`(문자열 enum)·`.instructions`·`startLocation` 필드마스크가 실 호출 시 적용 필요. enum→ManeuverKind 매핑 정합은 키 후 검증. — 글로벌 자동차/자전거 턴바이턴 step 추출에 영향
- [ ] **TMAP 자전거 maneuver 추출 가능 여부** — tmapBike stub + 스펙 KR bike 공급자 TBD(이중 불확실). best-effort 추출, 미추출 시 폴리라인 추종 폴백(P3 TMAP 도보 graceful). 키 후 자전거 턴 카드 활성화 여부 결정. — 자전거 턴바이턴 풍부도에 영향
- [ ] **`expo-speech` 음성 의존 도입 확정** — 현재 미설치. S3 실 음성 배선 시 신규 의존 추가. 추가 시 lockfile 동결·키 0개 빌드/웹 export 무영향 + `.expo.ts` top-level import 격리(웹 번들 미포함) 확인. 실 오디오 출력은 디바이스 QA. — 음성 안내 실 발화 기능에 영향
- [ ] **RouteStep.type 코드스페이스 — F1 ManeuverKind enum 정규화 결정 검증** — Valhalla numeric·kakao numeric·Google 문자열이 서로 다른 코드스페이스라 provider-agnostic `maneuver: ManeuverKind`로 수렴. 안내 어휘·아이콘 함수는 이 enum만 키. `type?`는 raw 보존(선택)으로 격하. 매핑 테이블 완전성은 실 응답 후 보강 가능. — 모드별 안내 문장·턴 아이콘 정확도에 영향
