# 지도 + 길찾기 앱 (코드명: wayfinder) — 설계 문서

> 작성: 2026-06-07 / 상태: 사용자 승인 (Section 1·2·3)
> 앱 이름 미정 — 후보: 마실맵, 두루맵, 원더맵, 여유맵 (사용자 검토 중)

## 1. 목표

카카오맵/구글맵 수준의 지도+길찾기 모바일 앱을 단계적으로 구축한다.
장기 차별화 포인트는 **경로의 질**: 걷기 좋은/풍경 좋은/한적한/안전한(큰길·가로등) 경로와
"최속 경로 +N분 허용" 필터를 제공한다.

### 제약 조건

- 개발 환경: Windows + WSL2. Mac 없음, 테스트용 실기기(Android/iOS) 없음
  → **웹에서 일상 확인이 가능해야 함**, iOS 빌드는 EAS 클라우드, 네이티브 확인은 Android 에뮬레이터
- 대상 지역: 글로벌 (한국 우선)
- 1인 개발, JS/React 경험 보유

## 2. 로드맵 (전체 Phase 진행 확정)

| 단계 | 내용 | 결과물 |
|------|------|--------|
| Phase 1 | 지도 표시 + 장소 검색 + 현재 위치 + 장소 상세(리뷰·블로그·거리뷰) | 동작하는 지도 앱 |
| Phase 2 | A→B 길찾기 조회+표시 (도보/대중교통/차/자전거) | 경로 조회 |
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
| 라우팅 API | 한국=카카오 모빌리티+ODsay, 글로벌=Google Routes/Mapbox | 한국 대중교통은 국내 API 필수 (구글 길찾기 자동차 미지원) |
| 장소 정보 | 기본정보=카카오 Local, 평점·리뷰=구글 Places(5개), 블로그=네이버+카카오 검색 API, 전체 리뷰=딥링크 | 카카오·네이버 리뷰 본문은 공식 API 미제공. 크롤링은 약관 위반이라 배제 |
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

## 6. 백엔드 프록시

### 엔드포인트

```
GET /v1/places/search?q=&lat=&lng=          # 지역 따라 카카오/구글 라우팅
GET /v1/places/:id?provider=kakao|google     # 기본정보+구글평점·리뷰+블로그 병합
GET /v1/blogs?q=&region=kr                   # 네이버+카카오 블로그 병합
GET /v1/routes?from=&to=&mode=               # Phase 2
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
  reviews: Review[];          // 구글 최대 5개
  blogs: BlogPost[];          // 네이버+카카오 병합, 최신순
  links: { kakaoMap?: string; naverPlace?: string; googleMaps?: string };
  roadview?: { lat: number; lng: number };
}
```

## 8. Phase 1 화면 범위

| 화면 | 내용 | 완료 기준 |
|------|------|----------|
| 지도 홈 | 하이브리드 지도 + 현재 위치 + 검색바 | 서울↔도쿄 패닝 시 렌더러 자동 전환 |
| 검색 | 자동완성 리스트 → 핀 + 카메라 이동 | 한국어/영어 검색 동작 |
| 장소 상세 | 바텀시트: 정보·평점·리뷰·블로그·거리뷰·딥링크 | PlaceDetail 전 필드 표시 |

**길찾기는 Phase 1 범위 밖** (Phase 2).

## 9. 테스트 전략

- 프록시: 정규화 함수 단위 테스트 + 엔드포인트 통합 테스트 (Vitest + Cloudflare 로컬 런타임)
- 앱: 서비스 레이어 단위 테스트, 지도는 웹 수동 확인 → Android 에뮬레이터 검증
- 외부 API 전부 모킹, 실 API 호출은 스모크 테스트로 분리

## 10. 리스크

| 리스크 | 대응 |
|--------|------|
| `@react-native-kakao/map` 유지보수 중단 | 인터페이스 뒤에 격리되어 있어 직접 네이티브 모듈로 교체 가능 |
| 구글 Places 과금 증가 | 프록시 캐싱 + 월 예산 알림 설정, 리뷰 섹션 lazy load |
| 실기기 없는 네이티브 검증 한계 | Android 에뮬레이터 + EAS 빌드, 출시 전 실기기 확보 필요 (명시적 한계) |
| 한국 bbox 단순 판정의 오차 (독도·이어도 등) | Phase 1은 단순 bbox로 충분, 문제 보고 시 폴리곤 판정으로 교체 |
