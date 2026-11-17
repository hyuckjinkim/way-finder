# 지도 + 길찾기 앱 (wayfinder) — 설계 문서

> 작성: 2026-06-07 / 상태: 사용자 승인 (Section 1·2·3)
> 앱 이름: **wayfinder** 확정 (2026-06-07)

## 1. 목표

카카오맵/구글맵 수준의 지도+길찾기 앱을 단계적으로 구축한다.
**iOS / Android / 웹을 하나의 Expo 코드베이스로 동시 제공**한다 — 웹은 개발 확인용이 아니라 정식 제품 채널.
장기 차별화 포인트는 **경로의 질**: 걷기 좋은/풍경 좋은/한적한/안전한(큰길·가로등) 경로와
"최속 경로 +N분 허용" 필터를 제공한다.

### 제약 조건

- 개발 환경: Windows + WSL2. Mac 없음, 테스트용 실기기(Android/iOS) 없음
  → **웹에서 일상 확인이 가능해야 함**, iOS 빌드는 EAS 클라우드, 네이티브 확인은 Android 에뮬레이터
- 플랫폼: **모바일(iOS/Android) + 웹 동시 제공** — 웹 배포는 Expo Web → Cloudflare Pages
  - 단, Phase 3+ 턴바이턴 네비게이션은 웹 한계(백그라운드 GPS 불가, 화면 꺼짐) 때문에
    모바일 전용 기능으로 하고, 웹은 경로 조회/표시까지 제공
- 대상 지역: 글로벌 (한국 우선)
- 1인 개발, JS/React 경험 보유

## 2. 로드맵 (전체 Phase 진행 확정)

| 단계 | 내용 | 결과물 |
|------|------|--------|
| Phase 1 | 지도 표시 + 장소 검색 + 현재 위치 + 장소 상세(리뷰·블로그·거리뷰) | 동작하는 지도 앱 |
| Phase 2 | A→B→…→Z 길찾기 조회+표시 (도보/대중교통/차/자전거, **전 모드 경유지 지원**, 시외 KTX·기차·고속버스 포함) | 경로 조회 |
| Phase 3 | 도보 턴바이턴 네비게이션 (GPS 추적, 이탈 재탐색) | 따라가는 네비 |
| Phase 4 | 자체 라우팅 엔진(Valhalla) + 커스텀 경로 + "+N분" 필터 | 차별화 기능 |
| Phase 5 | 전 모드 턴바이턴 + 음성 안내 + 실시간 교통 | 풀 네비게이션 |

각 Phase는 독립적으로 "동작하는 앱"으로 끝난다 (walking skeleton 전략).
Phase별로 별도의 구현 계획을 수립한다. 이 문서의 구현 범위 상세는 Phase 1 기준.

## 3. 확정된 주요 결정

| 결정 | 선택 | 근거 |
|------|------|------|
| 프레임워크 | Expo (React Native + TypeScript) | JS/React 경험, Mac 없이 iOS 빌드(EAS), 웹 확인(react-native-web) |
| 지도 렌더링 | **하이브리드**: 한국=Kakao SDK, 글로벌=MapLibre | 한국 지도 품질(POI·건물·라벨)이 OSM 대비 압도적 — PoC(poc/map-compare)로 비교 확인 후 결정 |
| 라우팅 API | 한국=카카오 모빌리티(자동차)+TMAP(도보)+ODsay(대중교통·시외), 글로벌=Google Routes/Mapbox | 한국 대중교통은 국내 API 필수 (구글 길찾기 자동차 미지원). 카카오모빌리티는 도보 미제공 → TMAP 보행자 API 편입 |
| 장소 정보 | 기본정보=카카오 Local, 평점·리뷰=구글 Places(5개), 블로그=네이버+카카오 검색 API, 전체 리뷰=딥링크 | 카카오·네이버 리뷰 본문은 공식 API 미제공. 크롤링은 약관 위반이라 배제 |
| 유료 가능 키 = 선택 (2026-11-18) | 구글 Places·Routes, 카카오모빌리티는 **비워도 됨** — 해당 기능만 빠지고 나머지는 실 모드 유지 | 국내 전용 운영 시 구글 비용 0원. 게이트는 기능·모드별(`config.ts` `isDemoMode`/`isRouteDemoMode`) — §11 "국내 전용 구성" |
| 백엔드 | Cloudflare Workers (Hono, TypeScript) | API 키 보호 필수(Phase 1부터), 무료 티어, 엣지 캐싱 |
| 상태관리 | Zustand + TanStack Query | 경량 + API 캐싱 |
| 커스텀 라우팅(Phase 4) | 자체 호스팅 Valhalla + OSM + 공공데이터(가로등·유동인구) | 상용 API는 비용 함수 커스터마이즈 불가. "+N분"은 alternatives 필터로 구현 |

## 4. 전체 아키텍처

```
┌─────────────────────────────────────────────┐
│  모바일 앱 (Expo / React Native + TypeScript)  │
│  ┌─ UI 레이어 (화면, 검색, 경로 패널)              │
│  ┌─ <MapView> 공통 인터페이스                    │
│  │   ├─ 한국:  Kakao SDK(네이티브) / JS API(웹)  │
│  │   └─ 글로벌: MapLibre(네이티브) / GL JS(웹)    │
│  └─ 데이터 레이어 (PlaceService·RouteService)    │
└──────────────────┬──────────────────────────┘
                   │ HTTPS (앱은 프록시만 호출)
┌──────────────────▼──────────────────────────┐
│  백엔드 프록시 (Cloudflare Workers + Hono)      │
│  - API 키 보관 (wrangler secret)              │
│  - 외부 API 중계 + 공통 스키마로 응답 정규화        │
│  - 캐싱 (Workers KV)                         │
└──────────────────┬──────────────────────────┘
   ┌───────────────┼───────────────────┐
   ▼               ▼                   ▼
 카카오/ODsay     네이버 검색          구글/Mapbox
 (한국 지도·경로)  (블로그)            (글로벌 + 리뷰)
                              [Phase 4+: 자체 Valhalla 엔진]
```

### 핵심 원칙

1. **지역 추상화(Region Provider)** — 카메라 중심 위치로 지도 렌더러·검색·라우팅 공급자를 자동 전환. UI는 공급자를 모른다.
2. **백엔드 프록시는 Phase 1부터** — 키를 클라이언트에 심지 않는다.
3. **응답 정규화** — 프록시가 공급자별 스키마를 공통 `Place`/`Route` 모델로 변환.

## 5. 지도 레이어

### `<MapView>` 공통 인터페이스

```typescript
interface MapViewProps {
  camera: { center: LatLng; zoom: number };   // 좌표는 전부 WGS84 통일
  markers?: MapMarker[];
  polylines?: MapPolyline[];                  // Phase 2 경로 표시용
  showUserLocation?: boolean;
  onPress?: (coord: LatLng) => void;
  onCameraChange?: (camera: CameraState) => void;
}
interface MapViewRef {
  flyTo(center: LatLng, zoom?: number): void;
  fitBounds(bounds: BBox, padding?: number): void;
}
```

### 구현체 4개

|  | 네이티브 (iOS/Android) | 웹 |
|--|--|--|
| 한국 | `@react-native-kakao/map` (커뮤니티, Expo config plugin 지원) | Kakao Maps JS API |
| 글로벌 | `@maplibre/maplibre-react-native` | `maplibre-gl` |

- 플랫폼 분기: Expo 파일 확장자 규칙 (`.tsx` / `.web.tsx`)
- 지역 분기: 런타임 Region Provider
- Kakao 네이티브는 Expo Go 불가 → dev client 빌드(EAS) 필요

### 지역 전환 로직

- 한국 bbox: 위도 33.0~38.7, 경도 124.5~132.0
- 히스테리시스 완충지대 ±0.5° (경계 패닝 시 렌더러 깜빡임 방지)
- 줌 < 6 (세계 지도 수준)이면 항상 MapLibre (카카오 타일은 한국 밖 빈 화면)
- 전환 시 카메라 상태 이어받기

### 거리뷰

- 한국: 카카오 로드뷰 (네이티브 SDK 내장 / 웹 JS API) — 장소 상세에서 전용 화면 진입
- 글로벌: 구글 스트리트뷰 딥링크 (무료). 임베드 필요 시 유료 API 추후 검토

### 명시된 트레이드오프

1. SDK 간 미세 동작 차이 → Phase 1은 마커·카메라·탭만 추상화 (좁은 인터페이스 유지)
2. 한국 웹 화면(Kakao JS)은 네이티브 SDK의 근사치 → Android 에뮬레이터로 보완
3. 구현체 4개 = 테스트 매트릭스 4배 → 인터페이스를 좁게 유지하는 것이 방어선

### 국내 타일 대안: VWorld (검토만, 미채택 — 2026-11-18)

**전제 정정:** 지도 렌더링에 구글맵은 쓰지 않는다(한국=Kakao, 글로벌=MapLibre+OpenFreeMap, 키 불필요).
구글의 국내 역할은 장소 상세 **구글 탭(평점·리뷰)뿐**이고, VWorld는 리뷰를 제공하지 않으므로 구글 대체재가 아니다.

VWorld(국토교통부 공간정보 오픈플랫폼)가 들어갈 자리는 **국내 배경지도 타일**이다:
`@react-native-kakao/map` 2.2.7이 RN 0.85에서 깨질 수 있는 terminal 버전이라(§12), 네이티브에서 Kakao 실패 시
현재 `MapErrorBoundary`가 MapLibre+OpenFreeMap(OSM — 국내 POI·라벨 빈약)으로 폴백한다. 이 폴백의 국내 소스를
VWorld 래스터 타일로 바꾸면 네이티브 라이브러리 의존 없이 국내 지도 품질을 일부 회복할 수 있다.

| 항목 | 상태 |
|------|------|
| 엔드포인트 `https://api.vworld.kr/req/wmts/1.0.0/{key}/…` 존재·키 검증 | ✅ 실측 (무효 키 → "등록되지 않은 인증키입니다" XML) |
| 레이어명(`Base`/`Hybrid`/`Satellite` 등), `{z}/{y}/{x}` 순서, 확장자, 줌 범위 | ⚠️ 미검증 — GetCapabilities로 확인 |
| 일일 호출 한도, 개발키↔운영키 구분 | ⚠️ 미검증 |
| 모바일 앱 호출 시 도메인 검사(`domain` 파라미터/Referer) | ⚠️ 미검증 — 키가 앱 번들에 노출됨 |
| 상업적 이용 조건 | ⚠️ 미검증 — 약관 확인 필요 |
| 커버리지 | 국내 전용 → 해외는 기존 OpenFreeMap 유지 |

채택 시 작업: MapLibre 스타일에 VWorld raster source 추가(국내 bbox) + `EXPO_PUBLIC_VWORLD_KEY`. Kakao SDK를
완전히 대체할지(구현체 4→2, 로드뷰 상실) vs 폴백 소스로만 쓸지는 디바이스 QA 결과로 결정한다.

## 6. 백엔드 프록시

### 엔드포인트

```
GET /v1/places/search?q=&lat=&lng=          # 지역 따라 카카오/구글 라우팅
GET /v1/places/:id?provider=kakao|google     # 기본정보+구글평점·리뷰+블로그 병합
GET /v1/blogs?q=&region=kr                   # 네이버+카카오 블로그 병합
POST /v1/routes  { stops: LatLng[2..N], mode }   # Phase 2 — 경유지 포함 다구간 경로
```

### 운영 규칙

- 키 관리: `wrangler secret` 전용. 앱 바이너리에 키 없음
- 캐싱: 블로그 6h, 장소 기본정보 24h (Workers KV)
- **구글 Places 약관 준수**: place_id 외 데이터 30일 이상 저장 금지 → TTL로 강제
- 장애 격리: 공급자 한 곳 실패 시 해당 섹션만 생략하고 렌더링 (에러는 로깅, silent failure 금지)
- 기본 레이트리밋 (IP 단위)

## 7. 정규화 데이터 모델

```typescript
interface Place {
  id: string;                 // "kakao:12345" | "google:ChIJ..." 출처 프리픽스
  name: string;
  coord: LatLng;
  category: string;
  address: string;
}

interface PlaceDetail extends Place {
  phone?: string;
  rating?: { score: number; count: number; source: 'google' };
  reviews: Review[];          // 구글 최대 5개 (구글 탭)
  blogs: { naver: BlogPost[]; kakao: BlogPost[] };  // 탭별 분리 표시
  links: { kakaoMap?: string; naverPlace?: string; googleMaps?: string };
  roadview?: { lat: number; lng: number };
}
```

## 8. 길찾기 설계 (Phase 2 범위 확정)

### 요구사항

- 이동 수단: 도보 / 대중교통 / 자동차 / 자전거
- 대중교통은 시내(버스·지하철) + **시외(KTX·기차·고속버스·항공)** 포함
- **전 모드에서 경유지 지원**: A→B→…→Z (네이버맵식 경유지 추가·순서 변경 UI)
- MVP 경유지 한도: **최대 5개** (공급자 공통 지원 범위. 네이버맵과 동일)

### 모드별 공급자·경유지 구현 방식

| 모드 | 한국 | 글로벌 | 경유지 방식 |
|------|------|--------|------------|
| 자동차 | 카카오모빌리티 다중경유지 API (`/v1/waypoints/directions`) | Google Routes (≤25) / Mapbox | **네이티브 지원** |
| 도보 | TMAP 보행자 경로 API | Google Routes / Mapbox | 네이티브 지원, 미지원 구간은 leg-chaining |
| 자전거 | 자체 Valhalla `bicycle` (2026-11-18: TMAP 자전거 API 부재 실측 — 기존 TMAP 배선 제거) | Google Routes / Mapbox | 동상 |
| 대중교통 | ODsay | Google Routes (transit) | **leg-chaining** (아래) |

### 대중교통 경유지 = leg-chaining

어떤 공급자도 대중교통 경유지를 API로 지원하지 않는다 (카카오맵·네이버맵 앱도 미지원).
→ 프록시가 A→B, B→C, … 구간을 **독립 탐색 후 병합**: 총 소요시간 = Σ구간 + 환승 대기 버퍼.
이는 기존 공급자 앱이 못 하는 기능이므로 차별화 포인트로 명시한다.

### 시외 대중교통 스티칭

ODsay 도시간 검색은 도시간 구간(예: 서울역→부산역)만 반환한다.
→ 프록시가 3단 합성: `출발지→출발역/터미널 (시내 검색)` + `도시간 (KTX 등)` + `도착역→목적지 (시내 검색)`.
글로벌은 Google transit이 단일 응답으로 처리.

### 정규화 모델 영향

`Route { legs: RouteLeg[] }` 구조가 이미 다구간 전제라 스키마 변경 없음.
요청만 `{ stops: LatLng[], mode }`로 확장 (2개=단순 A→B, 3개 이상=경유지).

## 9. Phase 1 화면 범위

| 화면 | 내용 | 완료 기준 |
|------|------|----------|
| 지도 홈 | 하이브리드 지도 + 현재 위치 + 검색바 | 서울↔도쿄 패닝 시 렌더러 자동 전환 |
| 검색 | 자동완성 리스트 → 핀 + 카메라 이동 | 한국어/영어 검색 동작 |
| 장소 상세 | 바텀시트: 기본정보 + **플랫폼 콘텐츠 탭(구글/네이버/카카오)** + 거리뷰 | PlaceDetail 전 필드 표시, 탭 전환·더보기 딥링크 동작 |

장소 상세의 플랫폼 탭 구성 (사용자 확정, 2026-06-07):

| 탭 | 인앱 콘텐츠 | 더보기 동작 |
|----|------------|------------|
| 구글 | 평점 + 리뷰 본문 5개 | 구글맵 해당 장소로 이동 |
| 네이버 | 네이버 블로그 글 목록 | 네이버 플레이스로 이동 |
| 카카오 | 카카오(Daum) 블로그 글 목록 | 카카오맵으로 이동 |

각 탭은 해당 플랫폼이 공식 API로 제공하는 콘텐츠만 인앱 표시하고, 그 이상은 딥링크로 연결한다.
구글 탭 데이터는 탭이 열릴 때만 호출(lazy load — §11 과금 방어선과 연동).

**길찾기는 Phase 1 범위 밖** (Phase 2).

## 10. 테스트 전략

- 프록시: 정규화 함수 단위 테스트 + 엔드포인트 통합 테스트 (Vitest + Cloudflare 로컬 런타임)
- 앱: 서비스 레이어 단위 테스트, 지도는 웹 수동 확인 → Android 에뮬레이터 검증
- 외부 API 전부 모킹, 실 API 호출은 스모크 테스트로 분리

## 11. 비용 구조

> **개발 정책 (사용자 확정, 2026-06-07): 무료 티어 기준으로 개발한다.**
> - 모든 외부 API는 무료 한도 내에서만 사용. 유료 전환은 사용자 증가가 실측된 후 별도 결정
> - 구글: Cloud 콘솔에서 **API별 일일 쿼터를 무료 한도로 직접 제한** (한도 도달 시 과금 대신 호출 실패)
>   + 월 예산 알림 설정. 쿼터 초과 시 앱은 구글 탭만 graceful degradation (다른 탭은 정상)
> - Phase 4 Valhalla는 개발 단계에선 로컬 Docker로 무료 운영, 서버 비용은 Phase 4 착수 시 재검토
> - EAS 무료 플랜 빌드 한도 내에서 빌드 횟수 관리 (웹 우선 확인으로 빌드 수요 최소화)

개발~소규모 사용자 단계는 0원. 과금 노출 지점은 두 곳: 구글 API(사용자 증가 시), Phase 4 서버(고정비).

### 국내 전용 구성 — 유료 가능 키 없이 운영 (2026-11-18)

유료 가능 키는 **선택**이다. 비우면 아래 기능만 빠지고, 무료 키 기능은 실 모드로 남는다
(회귀 테스트: `services/proxy/src/optionalPaidKeys.test.ts`).

| 비운 키 | 빠지는 기능 | 영향 없음 |
|---------|-------------|-----------|
| `GOOGLE_PLACES_KEY` | 장소 상세 구글 탭(평점·리뷰) → 빈 결과, 해외 장소 검색 → 빈 결과 | 국내 검색(카카오)·블로그 탭(네이버·카카오) |
| `GOOGLE_ROUTES_KEY` | 해외 길찾기 → "미지원" 안내 | 국내 전 모드 |
| `KAKAO_MOBILITY_KEY` | 국내 자동차 길찾기 → "미지원" 안내 | 국내 도보(TMAP)·자전거(Valhalla)·대중교통(ODsay) |
| `NAVER_CLIENT_ID/SECRET` | 블로그 탭의 네이버 부분 → 빈 결과 | 나머지 전부 (2026-11-18: API HUB 이관·한시적 무료라 선택 키로 전환) |

- 카카오모빌리티는 **상업적 이용 시 무료 쿼터 내라도 사전 제휴 계약 필요**(카카오 데브톡 공식 답변) → 출시 전 결정 항목.
- 경로 키 부재 처리(사용자 결정 2026-11-18): 앱이 실 모드(카카오 REST 키 있음)인데 모드별 경로 키만 없으면 프록시가
  **501 `MODE_UNAVAILABLE`**(`config.ts` `routeGate`) → 앱 결과 화면이 "이 이동수단 미지원" 안내(재시도 없음).
  키 0개 개발 환경(앱 전체 데모)에서만 mock 경로. 가짜 경로가 실사용자에게 보이지 않는다.
- 후속(미구현): 이동수단 탭을 사전에 비활성화하려면 지원 모드 조회 엔드포인트(예: `GET /v1/capabilities`)가 필요.

| 서비스 | 무료 한도 | 초과 시 |
|--------|----------|---------|
| Kakao 지도/Local/검색, 네이버 블로그 검색 | 카카오 일 수만 건 무료. 네이버는 2026-07 NAVER API HUB 이관 후 "한시적 무료" | 네이버는 유료 도입 시 재검토 (선택 키) |
| ODsay (대중교통) | 일 1,000건 | 유료 플랜 협의 |
| MapLibre + OpenFreeMap | 무제한 무료 | — |
| Cloudflare Workers/Pages | 일 10만 요청 | $5/월~ |
| **구글 Places/Routes** | SKU별 월 한도 (Essentials 1만/Pro 5천/Enterprise 1천 건) | $2~40/1,000건 |
| EAS Build | 월 무료 빌드 제한적 | $19/월~ |
| 스토어 등록 (출시 시) | — | Apple $99/년, Google $25 1회 |
| Valhalla 서버 (Phase 4) | — | VPS 월 $20~50 |

### 구글 과금 방어선 (설계 반영됨)

1. 프록시 캐싱 — 동일 장소 24h 캐시 (구글 약관상 30일 한도 내)
2. Lazy load — 장소 상세의 리뷰 섹션이 열릴 때만 구글 호출 (검색 단계 호출 금지)
3. Google Cloud 월 예산 상한 + 알림 설정을 Phase 1 셋업 체크리스트에 포함

## 12. 리스크

| 리스크 | 대응 |
|--------|------|
| `@react-native-kakao/map` 유지보수 중단 (**현실화** — 2.2.7 terminal, RN 0.85 빌드 위험) | 인터페이스 뒤에 격리. `MapErrorBoundary`로 MapLibre 폴백 적용됨. 국내 품질 회복안 = VWorld 타일(§5, 검토 중) |
| 구글 Places 과금 증가 | 프록시 캐싱 + 일일 쿼터 하드캡, 리뷰 섹션 lazy load. 국내 전용이면 키를 비워 원천 차단(§11) |
| 실기기 없는 네이티브 검증 한계 | Android 에뮬레이터 + EAS 빌드, 출시 전 실기기 확보 필요 (명시적 한계) |
| 한국 bbox 단순 판정의 오차 (독도·이어도 등) | Phase 1은 단순 bbox로 충분, 문제 보고 시 폴리곤 판정으로 교체 |
