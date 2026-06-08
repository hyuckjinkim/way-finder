# P1 게이트 실행 절차 (오케스트레이터 체크리스트)

## 1. 워커 산출 검증 (각 워커 완료 통지 시)
- [ ] A: `pnpm --filter @wayfinder/proxy typecheck && pnpm --filter @wayfinder/proxy test` 직접 실행 green
- [ ] B: mobile typecheck green + MapView.tsx가 stub이 아닌 디스패처인지 확인 + app.config.ts Kakao plugin 배선
- [ ] C: 화면 5종 파일 존재 + 테스트 green + gorhom/Reanimated 미사용 grep 확인
- [ ] D: services/state 테스트 green + lazy 쿼리 분리 확인
- [ ] E: app/ 라우트 4종 + e2e/smoke 분리 + CI 비차단 확인

## 2. E3 통합 (단일 executor)
- **(발견) mobile에 vitest.config + package.json `test` 스크립트 추가** — 현재 `pnpm -r test`가 mobile 테스트(8파일 51개, 검증 시점 green)를 건너뜀. B의 src/map/vitest.config.ts 같은 산발 설정도 단일 패키지 설정으로 통합
- 라우트→실제 화면 연결, D 훅→C 화면 주입, 데모 모드 e2e 흐름
- `expo export --platform web` + 산출물에 네이티브 맵 모듈 부재 assert
- 스모크 스크립트로 데모 흐름 검증

## 3. QA 사이클 (최대 5회, 동일 오류 3회면 중단·보고)
- `pnpm install --frozen-lockfile` / `pnpm -r typecheck` / `pnpm -r test` / `bash scripts/secret-scan.sh` / web export

## 4. 검증 게이트 (전원 승인 필요, 최대 3라운드)
- architect: 기능 완전성 (스펙 §9 대비)
- code-reviewer: 품질 (CRITICAL/HIGH 해결 필수)
- security-reviewer: 키 노출·입력 검증·OWASP
- advisor: 전체 궤적 검토 (오케스트레이터가 advisor 도구 직접 호출)

## 5. 통과 시
- [ ] Task #1 completed 처리, autopilot-state.json P1=done·P2=planning
- [ ] 사용자에게 P1 요약 보고 (자동 진행 계약이므로 멈추지 않고 P2 planning 개시)
- [ ] P2 계획: planner→critic→실행 동일 루프

## 실패 누적 시
- QA 동일 오류 3회 / 검증 3라운드 거부 → 중단하고 사용자에게 근본 원인 보고
