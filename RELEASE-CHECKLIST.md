# wayfinder — 출시 전 검증 체크리스트 (key + device QA)

> **먼저 읽으세요.** Phase 1·2·3·4·5가 전부 구현·커밋됐고 자동화 테스트(약 714개)·타입체크·웹 export가
> 전부 green입니다. **그러나 이것이 "앱이 동작한다"는 뜻은 아닙니다.**
>
> 지금까지의 모든 검증은 **mock 경계 안쪽**입니다:
> - 사람이 앱을 실행한 적 없음. 실제 지도가 렌더된 적 없음.
> - 실제 경로를 받아온 적 없음 — **예외: 로컬 Valhalla 컨테이너(P4)는 실제 경로를 서빙**(라이브 e2e 검증됨).
> - P3(도보 네비)·P5(전모드 네비·음성·실시간 교통)의 **사용자 대면 가치는 전부 미실행** — 사용자 인지 하에 환경(키·디바이스) 없이 진행.
>
> "검증됨"의 의미 = typecheck + 합성/mock 단위 테스트 + 웹 export. **실기기 GPS·음성 오디오·실시간 데이터·네이티브 지도는 아래 QA를 거쳐야 실체화됩니다.**

---

## 0. 지금 키·디바이스 없이 직접 볼 수 있는 것 (first look)

```bash
# 1) 웹 번들 빌드 + 로컬 서빙 — 데모 모드(목 데이터)로 화면 흐름 확인
cd apps/mobile && npx expo export --platform web && npx serve dist

# 2) 로컬 Valhalla 컨테이너 — 실제 경로 응답(수도권 타일)
cd services/valhalla && VALHALLA_DATA=~/valhalla-tiles docker compose up -d
curl -X POST localhost:8002/route -H 'content-type: application/json' \
  -d '{"locations":[{"lat":37.5663,"lon":126.9779},{"lat":37.5704,"lon":126.9921}],"costing":"pedestrian"}'
```

웹 데모는 MapLibre(글로벌)만 실제 렌더되고 한국 카카오 지도는 키가 있어야 보입니다(데모 모드는 placeholder).

---

## 1. API 키 발급 (실 데이터 동작 — 약 30분)

주입: 키 값은 `/mnt/d/Workspace/key-lib/keys.env`(발급 절차 포함 템플릿: `keys.env.example`), 프로젝트 설정은 루트 `.env` → `scripts/env-sync.sh` (로컬) / `scripts/env-sync.sh --deploy` (Workers 시크릿 업로드).

**무료 — 한도 초과 시 차단만, 자동 과금 없음**

| 서비스 | 용도 | 무료 한도 |
|--------|------|-----------|
| Kakao Developers | 지도(JS/네이티브)·Local 검색·블로그 | 일 수만 건 |
| NAVER API HUB (네이버 클라우드, 개발자센터 신규 종료) | 블로그 검색 — 선택 키 | 한시적 무료 (유료 도입 시 공지) |
| TMAP (SK) | 도보 경로(P2) — 자전거 API 없음, 자전거는 자체 Valhalla | 1,000/일 (유료 요금제는 직접 가입 시에만) |
| ODsay | 대중교통·시외(P2) | 일 1,000건 |
| Cloudflare | Workers/Pages·KV | 요청 일 10만 (KV 쓰기는 일 1,000) |

**유료 가능 — 선택, 비워도 됨** (빠지는 기능: 설계 §11 "국내 전용 구성")

| 서비스 | 용도 | 과금 위험 |
|--------|------|-----------|
| Google Cloud | 구글 탭(평점·리뷰)·해외 검색·해외 길찾기 | **초과 시 카드 자동 과금** — 쓰려면 콘솔 일일 쿼터 하드캡 필수 |
| Kakao Mobility | 국내 자동차 다중경유지(P2) | 상업적 이용은 쿼터 내라도 제휴 계약 필요 |

## 2. 디바이스 / 에뮬레이터 QA (코드로 검증 불가 — 실행 필요)

### P3 도보 턴바이턴
- [ ] 실 GPS update cadence·accuracy로 네비 동작
- [ ] 백그라운드 추적 지속(앱 백그라운드 중 위치 갱신)
- [ ] 실제 이동 시 경로 이탈 → 재탐색 런타임
- [ ] 안내 중 화면 wake(꺼짐 방지)
- [ ] 이탈 임계(30m)·도착 반경(20m)·재탐색 디바운스(5s) 상수를 실 GPS 노이즈로 튜닝

### P4 커스텀 경로
- [ ] 대중교통 환승 버퍼(300s 고정) 실측 — 실 ODsay 1경로 총소요 대조(LOW: 도보 leg 경계 과산정 가능)
- [ ] 한국 OSM `lit=*` 태그 커버리지로 안전 프로필 실효성 확인
- [ ] 풍경 프로필 = 그래프 보강(서울 열린데이터 공원·녹지) 후 `ENABLE_SCENIC` 활성화

### P5 전모드·음성·교통
- [ ] 실 음성 오디오 출력(expo-speech 발화 — 언어·속도·중복 억제)
- [ ] 자동차/자전거 실 GPS 네비 런타임(턴 안내·이탈·재탐색·음성 동기)
- [ ] **voice × reroute seam (advisor — 어느 단일 테스트도 안 덮음)**: 재탐색이 step 인덱스를 리셋할 때 새 경로의 첫 턴이 정상 안내되는가, 아니면 "동일 step"으로 잘못 억제되는가 — 합성 테스트 가능하나 미작성, 우선 디바이스 확인
- [ ] 카카오 car `guides[]` 실 형식(x/y 좌표계·type 코드표)·Google `navigationInstruction` 필드마스크/maneuver enum — car/bike step 추출 정합(픽스처는 지식 기반·실 형식 미보장)
- [x] ~~TMAP 자전거 maneuver~~ — TMAP에 자전거 API 없음(2026-11-18 실측) → 국내 자전거는 Valhalla `bicycle`(maneuvers 포함). 배포용 Valhalla 호스팅 필요
- [ ] 실시간 교통 무료 티어 viability(Google traffic-aware 상위 SKU·카카오 무료 범위) — 라이브 교통 진행 여부 결정

### 전반
- [ ] 네이티브 지도(Kakao SDK / MapLibre RN) 디바이스 렌더 — 웹 확인은 네이티브 동작의 근사치
- [ ] iOS EAS 클라우드 빌드(Mac 없이) + Android 에뮬레이터 dev client
- [ ] `@react-native-kakao/map`(커뮤니티, 마지막 배포 ~1년 전) Expo SDK 호환 재확인

## 3. 기술 부채 / watch-item
- [ ] **flaky 테스트 감시**: P5 통합 시 mobile 테스트 1건이 1회 실패 후 재실행 2회 green(WSL2 /mnt/d IO 경합, import 228s 추정). 비동기 voice/timer 테스트 race 가능성 — 재발 시 환경 귀속 판단 재검토
- [ ] 워커 간 중복 유틸은 P3 F2에서 통합 완료(parseDurationSec/decodePolyline 등 `_shared/`)
- [ ] WSL2 /mnt/d는 IO가 느림 — CI/개발은 WSL 네이티브 경로 권장(특히 Valhalla 타일·Docker 볼륨)

---

## 부록: 구현 현황

| Phase | 내용 | 검증 수준 |
|-------|------|-----------|
| P1 | 지도·검색·장소 상세(플랫폼 탭) | 웹 데모 실동작 + mock |
| P2 | 경유지 길찾기(전모드·leg-chaining·시외) | 웹 + fetch-mock 실모드 |
| P4 | Valhalla 커스텀 경로(안전/한적/+N분) | **라이브 컨테이너 e2e + 프로필 분기 단언** |
| P3 | 도보 턴바이턴 | 합성 GPS + 기하 경계 단언(29/31m) |
| P5 | 전모드 네비·음성·실시간 교통 | 합성 + mock(음성·교통은 디바이스/키 대기) |

스택: Expo(RN+TS) 모노레포 · Cloudflare Workers 프록시 · 하이브리드 지도(Kakao/MapLibre) · 자체 Valhalla.
설계: `docs/superpowers/specs/2026-06-07-map-navigation-app-design.md`.
