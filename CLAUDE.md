# wayfinder

지도·길찾기 앱 pnpm 모노레포 — `apps/mobile`(Expo·React Native) · `packages/shared` · `services/proxy`(Cloudflare Worker) · `services/valhalla`(Docker).

## 규칙

@../.styleguide/README.md
@../.styleguide/app/README.md
@../.styleguide/wayfinder/README.md

규칙 본문은 위 세 파일에 있다(우선순위: 저장소 > 그룹 > 개인판 §0 > 공통). 이 파일에는 이 저장소에서 일할 때 조심할 것만 둔다.

## 검사

- `pnpm typecheck && pnpm lint && pnpm test` — CI(`.github/workflows/ci.yml`)와 같은 검사다. 린트는 경고도 0 으로 둔다. 비밀 검사는 `scripts/secret-scan.sh`.
- 프록시의 실 API 테스트는 `services/proxy` 의 `vitest.e2e.config.ts`·`vitest.smoke.config.ts` 로만 돈다(키 필요).

## 비밀

- 키 원본은 `../key-lib`(git 밖, `keys.env` + `wayfinder.env`). `scripts/env-sync.sh` 가 `apps/mobile/.env`·`services/proxy/.dev.vars` 를 만든다. 생성 파일에 키를 손으로 쓰지 않는다.
- `scripts/env-sync.sh --deploy` 는 Worker secret 을 올린다 — 사용자 요청 때만.

## 릴리스

- `pnpm release`(commit-and-tag-version) — 사용자 요청 때만. 절차는 `RELEASE-CHECKLIST.md`.
