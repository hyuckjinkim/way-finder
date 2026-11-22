# Changelog

`pnpm release`(commit-and-tag-version)가 커밋 이력(Conventional Commits)으로 갱신한다.
0.7.0 이하는 정식 릴리즈 없이 진행된 커밋 이력을 단계(Phase)·작업일 경계로 나눠 버전을 사후 부여한 기록이다.

## 0.7.0 (2026-11-21)

QA·리서치 기반 웨이브 A~C — 대중교통 카카오 백업(하루 950회 하드 상한), 소요시간 오류 수정, 패널 옆 지도 조작, 저장한 장소·공유·지도 앱 길안내·경로 정렬/필터·카테고리 칩·길게 눌러 출발/도착·지도 레이어

### 기능

* **proxy:** ODsay 한도 초과 시 카카오 대중교통 백업(일일 상한 Durable Object), 검색 별칭(구디·고터 등) (a61d765)
* **map:** 카테고리 칩, 길게 눌러 출발/도착 지정, 지도 레이어 (2bea260)
* **place:** 저장한 장소, 장소 공유 (75d6635)
* **route:** 경로 공유, 카카오맵·네이버지도 앱으로 길안내, 정렬·필터 (badadf6)

### 수정

* **transit:** 소요시간 과다 계산, 경유지 구간별 쿼터 중복 차감 수정 (a97c6ae)
* **web:** 패널이 열린 동안에도 지도가 입력을 받도록 (56c4cb1)
* **proxy,map:** KV 쓰기 예산 보호, 구간 병렬 조회, 웹 지도 폴백 (6aa6f1a)
* **route:** 결과를 공용 패널에 표시, 옵션·경유지 유지 (3bdeb0f)
* **web:** 키보드 조작, 뒤로가기, 셸 다듬기 (f9963fe)

### 문서

* QA·리서치 기반 수정 플랜 (88ad357)
* 웨이브 A~C 결과와 남은 일 기록 (4ead33c)

## 0.6.0 (2026-11-18)

무료 키만으로 실서비스 배포 — Cloudflare 배포, 지도 위 패널 UI, 브라우저 ODsay 대중교통, 공식 노선색·요금·대안 경로, 하단 시트·카메라 포커스

### 기능

* **proxy:** 무료 키만으로 동작, 수단별 실패를 명시적으로 반환 (b92cb46)
* **app:** 무한 로딩 대신 미지원 수단·경로 오류 표시 (515731f)
* **app:** 검색·경로 입력을 지도 위 패널로 (95b2195)
* **app:** 웹에서 브라우저가 ODsay 대중교통 직접 조회 (7f8a246)
* **shared:** 경로 색상·마커·fit 여백·장소 힌트 계약 추가 (0e55b9f)
* **shared:** capabilities 엔드포인트 계약 (7edef13)
* **map:** 경로 폴리라인, 종류별 마커, SDK 준비 후 여백 반영 fit (cdcca3a)
* **transit:** 공식 노선색, 요금, 대안 경로, loadLane 선형 (da78a89)
* 경로 URL 상태 헬퍼, walkPreferences capability (0cdcab7)
* **shared:** 대중교통 승·하차 정류장 이름 전달 (e29a487)
* **mobile:** 하단 시트, 장소 액션, 카메라 포커스, 대중교통 경로 UI (063555b)

### 수정

* **app:** 웹에 EXPO_PUBLIC 환경변수를 인라인해 배포 앱이 데모 모드를 벗어나게 (6be806e)
* **app:** 목 기본값 대신 실제 PlaceService로 검색 (9accbc4)
* **app:** 장소 검색 디바운스, 최신 응답만 반영 (2a730a2)
* **proxy:** 이름+좌표 힌트로 장소 상세, KV 없는 레이트리밋, 검색 품질 (4037381)
* **proxy:** 장소 상세는 정확한 id 일치만 허용(캐시 오염 방지) (18264fd)
* **mobile:** 하단 시트를 마운트 후에만 렌더 (fac444b)

### 성능

* **web:** Kakao SDK 프리로드, 불변 에셋 캐싱, PWA 매니페스트 (8255a0c)

### 구조

* ODsay 대중교통 파이프라인을 @wayfinder/shared/transit으로 이동 (aeb7982)

### 문서

* 무료 전용 설정·key-lib·배포·공급자 변경 문서화 (a39a767)
* README에 라이브 데모 링크·스크린샷 (bd4f1e4)
* 브라우저 측 ODsay 예외(프록시 전용 키 원칙) 기록 (95aef81)

## 0.5.1 (2026-06-29)

### 기능

* **map:** Kakao 네이티브 지도 실패 시 MapLibre로 폴백 (8dde158)

### 수정

* **app:** 프록시 주소를 EXPO_PUBLIC_PROXY_BASE_URL에서 읽기 (43cb11c)

### 문서

* 무료 티어 오픈 로드맵, 키 설정 가이드 (6e6568b)

## 0.5.0 (2026-06-08)

Phase 5 — 전 수단 턴바이턴, 음성 안내, 실시간 교통 (41c3987)

### 기능

* 전 수단 턴바이턴 계약, 자동차·자전거 정규화 (5fe8930)
* 교통 정규화 — 혼잡도 구간·지연 초 (9b397a8)
* **mobile:** NavScreen 음성 토글, 교통 배지 (5cd44ff)
* **nav:** 음성 안내 문구 생성, VoiceGuide (1721f8d)
* **nav:** 단계 전환에 음성 안내 연결 (4dc2140)

### 문서

* P5 구현 계획 (bd0e889)
* 키·실기 QA 백로그를 모은 RELEASE-CHECKLIST (c68f5cc)

## 0.4.0 (2026-06-08)

Phase 3 — 도보 턴바이턴 내비게이션(모바일) (dcee447)

### 기능

* 와이어 계약 — RouteStep, 내비 타입·상수 (0ef3a69)
* Valhalla maneuver → RouteStep 정규화 (e650e59)
* 합성 GPS 시퀀스 픽스처 (4656784)
* LocationProvider — 합성·expo-location 구현 (0656e76)
* 재탐색 주기 컨트롤러 — 엣지 트리거, 폭주 방지 (5d8b3ae)
* 지오 수학 — 하버사인 거리, 방위각, 폴리라인 투영 (6dd0a23)
* 내비 상태 머신 — 경로 이탈·도착·회전 (b96e4c2)
* 내비 진행률 — 남은 거리·시간 (efa7cb6)
* NavScreen 턴바이턴 UI, 웹 비활성 안내 (1b6b24c)
* 내비 세션 통합 — navStore가 경로 교체 담당 (1a8dc1b)

### 수정

* F3 시퀀스가 WALK_SIMPLE 골든 경로를 따르도록 (1f3c8b6)
* 재탐색 실패 후 이탈 상태면 재시도 (51e9426)

### 문서

* P3 구현 계획 (6918376)

## 0.3.0 (2026-06-08)

Phase 4 — Valhalla 맞춤 경로(걷기 좋은·안전한·조용한 길, N분 이내 필터) (33e1836)

### 기능

* RoutePreference 와이어 계약, RouteRequest 확장 (ae390c0)
* 중복 정규화 유틸 통합, 정밀 디코더, 데모 예산 플래그 (6db3b2d)
* Valhalla Docker 인프라(수도권 타일), 골든 픽스처 (3be5aa2, faa9d4f)
* **proxy:** Valhalla 공급자 레인 (c73ed94)
* **mobile:** 경로 옵션 UI — 선호 탭, 추가 분 스테퍼 (139cc29)
* **proxy:** +N분 필터 엔진, 경로 선호 검증 (8738349)
* Valhalla 맞춤 경로 종단 연결 (f4bd3ef)

### 수정

* **valhalla:** 이미지 엔트리포인트 우회, 빌드한 설정으로 직접 서빙 (ab08fa0)
* walkable/quiet 비용 방향 수정, 이미지 고정 (e183ccb)
* Valhalla를 릴리즈 태그가 아닌 검증된 digest로 고정 (ede85a8)

### 문서

* P4 구현 계획 (f19ebab)

## 0.2.0 (2026-06-08)

Phase 2 — 경유지 길찾기(전 수단, 구간 연결, 시외 이음) (11a173d)

### 기능

* 와이어 계약 — 경로 스키마, routesPath, 수단 분기 (ad126ee)
* 경로 픽스처, mockRouteProvider (0d57be4)
* 라우트 어댑터·내비 배선, 라우팅 API 스모크 분리 (0b8ab17)
* **proxy:** 직접 모드 경로 정규화·핸들러·검증·데모 전환 (d3eeac7, 075c159)
* **proxy:** 도시 대중교통 정규화 — ODsay/Google subPath → RouteLeg (ca942aa)
* **mobile:** RouteService, 상태, 경로 결과 표시 (80c97f6)
* **proxy:** 대중교통 구간 연결 엔진·핸들러 (de7ae41)
* **mobile:** 경로 입력 UI — 경유지 순수 함수, 모드 탭 (948e161)
* **proxy:** 시외 3단 이음 (4be8b0c)
* **proxy:** 대중교통 경로 KV 캐싱 — ODsay 쿼터 방어 (50d6b9b)
* 경로 입력·결과 화면 연결, P2 통합 게이트 통과 (06b2b80)

### 수정

* **proxy:** dispatchRoutes 수단 가드를 프로토타입 키로부터 보호 (e9b8b03)
* 검증 게이트 블로커 — MAX_STOPS 경계 오류, 대중교통 실모드 배선 (065619a)

### 문서

* P2 구현 계획 (087de3d)

## 0.1.0 (2026-06-07)

Phase 1 — 지도 홈, 장소 검색·자동완성, 장소 상세 시트·플랫폼 탭, 로드뷰, Kakao·MapLibre 지도, 프록시(검색·상세·블로그, KV 캐시, 레이트리밋)

### 기능

* pnpm 모노레포 스캐폴드, 툴체인 고정 (3562185)
* **shared:** 정규화 도메인 타입, MapView 계약, 목 픽스처, PlaceProvider 계약 (7d79f6d, d105e34)
* **mobile:** MapView 스텁, Expo 앱 진입점, expo-router 내비 셸 (cd37ce9, 2e2332a, fa1b240)
* 툴체인, CI 게이트, 프록시·인프라 스캐폴드 (2e85c46)
* **mobile:** API 클라이언트, PlaceService, LocationService, Zustand·TanStack Query 상태 (1af8e63, 7d2c3c3, b93e226, 76b7edf)
* **proxy:** 정규화 함수, 엔드포인트(places/search, places/:id, blogs), KV 캐싱·장애 격리·IP 레이트리밋 (c6926d3, 1a54d99, e5e3e20)
* **mobile:** 지도 홈, 자동완성 검색, 장소 상세 시트·플랫폼 탭, 로드뷰 화면 (fc319ad, 5c4b2a2, f6b190d, a593ad5)
* **map:** Kakao·MapLibre MapView 구현, 디스패처, Kakao config 플러그인 (429cdd6, 0823ec6)
* **mobile:** 라우트·화면 연결, 테스트 인프라 정비 (17e1c73)

### 수정

* **mobile:** export가 index.html을 만들도록 web.output=single (b03fc26)
* **ci:** 시크릿 스캔이 변수 참조가 아닌 따옴표 리터럴만 매칭 (73b13ec)
* **proxy:** 전용 /google 라우트로 구글 지연 로드 계약 복구 (6e7fdad)

### 문서

* 아키텍처 설계, 이름 확정·비용 구조, Phase 2 경유지·시외 확장, 리뷰 탭·무료 개발 정책 (e73a70f, 62be1ab, dad0a67, a7b43de)
* P1 구현 계획 (d40baa8)
