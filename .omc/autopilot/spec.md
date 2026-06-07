# Autopilot Mission: wayfinder 전체 Phase 구현

## 스펙 소스 (사용자 승인 완료 — Expansion 단계 생략)

`docs/superpowers/specs/2026-06-07-map-navigation-app-design.md` — 본 문서가 단일 진실 소스.
모든 구현 결정은 이 설계 문서를 따른다. 충돌 시 설계 문서가 우선.

## 실행 계약 (사용자 지시, 2026-06-07)

1. wayfinder Phase 1 → 2 → 3 → 4 → 5 순서대로 모두 진행
2. 각 Phase 완료 시 리뷰 게이트: architect + code-reviewer + security-reviewer + advisor 검토
3. 전원 승인 시 다음 Phase **자동** 진행 (사용자 개입 불필요). 거부 시 수정 후 재검증 (최대 3라운드)
4. 팀 규모 5 — 독립 작업은 병렬 실행
5. 모든 Phase 완료까지 계속 (/autopilot 계약)

## 불변 제약

- **무료 티어 API만** (설계 문서 §11 정책 — 구글 쿼터 하드캡 전제)
- Mac/실기기 없음: 웹 우선 확인 → Android 에뮬레이터 → EAS 클라우드 빌드
- Expo + TypeScript, 하이브리드 지도(한국=Kakao / 글로벌=MapLibre), Cloudflare Workers 프록시
- API 키는 클라이언트에 절대 포함 금지 (프록시 전용)
- 외부 API는 전부 모킹해서 테스트, 실 API는 스모크 테스트 분리
- 커밋: conventional commits, 키/시크릿 커밋 금지

## Phase별 완료 기준 (설계 문서 §2·§9 요약)

- P1: 지도 홈(하이브리드 렌더러 전환) + 검색 + 장소 상세(플랫폼 탭) — 웹에서 동작 확인
- P2: 전 모드(도보/대중교통/차/자전거) A→B→…→Z 경유지 길찾기 + 시외 스티칭
- P3: 도보 턴바이턴 (모바일 전용, GPS 추적·이탈 재탐색)
- P4: Valhalla(로컬 Docker) + 커스텀 경로(풍경·안전·한적) + "+N분" 필터
- P5: 전 모드 턴바이턴 + 음성 안내 + 실시간 교통
