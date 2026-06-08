# Foundation (F1–F5) — 구현 학습 노트

> 작성: Executor / 2026-06-07. 스트림 A~E 워커가 재발견하지 않도록 비자명한 함정만 기록.

## 도구체인 / pnpm 11 함정

- **`pnpm.overrides`는 package.json에서 무시됨.** pnpm 11은 overrides를 `pnpm-workspace.yaml`의 최상위 `overrides:` 키에서만 읽는다. 토큰체인 핀(expo/RN/maplibre/kakao/wrangler)은 거기 있다. package.json에 넣으면 경고만 뜨고 무효.
- **루트 `vitest.config.ts`가 패키지별 `vitest run`을 가로챈다.** vitest는 cwd에서 상위로 올라가며 config를 찾으므로, 루트 config의 include 글로브(`packages/**/src/**`)가 패키지 cwd 기준으로 해석돼 "No test files found"로 실패한다. **해결: 모든 테스트 패키지는 자체 `vitest.config.ts`를 둔다**(`include: ['src/**/*.test.ts']`). shared·proxy 모두 자체 config 보유. 새 패키지 추가 시 동일하게.
- **빌드 스크립트 승인 필요.** wrangler dry-run/번들은 esbuild/sharp/workerd 빌드 스크립트가 필요. `pnpm-workspace.yaml`의 `allowBuilds:`에 `esbuild/sharp/workerd: true` 명시됨. 새 네이티브 의존 추가 시 `pnpm approve-builds` 또는 allowBuilds 갱신. **(E1 보강)** `allowBuilds`는 pnpm 11 표준 키이며 값이 `true`(빌드)/`false`(건너뜀)인 맵이다 — **결정을 명시하지 않으면 deps-status가 dirty로 남아 `pnpm -r <script>`가 매번 자동 install을 spawn**(5워커 병렬 레이스 원인). E1에서 msgpackr-extract/return-fetch를 `false`로 명시해 해결. 상세: `e1-bootstrap.md`.
- **신규 게시 버전.** pnpm이 `minimumReleaseAgeExclude`로 막을 수 있음(예: @cloudflare/workers-types). workspace yaml에 예외 핀 추가하면 통과.

## 버전 핀 (2026-06-07 npm view 기준)

expo 56.0.9 / react-native 0.85.3 / react 19.2.7 / react-native-web 0.21.2 / wrangler 4.98.0 / hono 4.12.23 / vitest 4.1.8 / typescript 6.0.3 / maplibre-gl 5.24.0 / @maplibre/maplibre-react-native 11.3.3 / @react-native-kakao/map 2.2.7 / @cloudflare/workers-types 4.20260607.1 / @cloudflare/vitest-pool-workers 0.16.13. **RN 0.85는 자체 타입 제공 — `@types/react-native`(deprecated) 쓰지 말 것.**

## 계약 / 경로 (스트림이 의존하는 고정점)

- shared exports: `'@wayfinder/shared'`(타입), `'@wayfinder/shared/mocks'`(fixtures + PlaceProvider + mockPlaceProvider), `'@wayfinder/shared/region'`(selectRenderer).
- **MapView 소유권 핸드오프(M2):** `apps/mobile/src/map/MapView.tsx` + `.web.tsx`는 현재 F5 no-op stub. 스트림 C는 import만, 절대 수정 금지. 스트림 B4가 이 동일 경로를 실제 디스패처로 덮어쓴다.
- region 함수: `selectRenderer(coord, zoom, current?)` — 히스테리시스 적용. korea 상태면 완충(±0.5°) 벗어나야 global 전환, global 상태면 코어 bbox 진입해야 korea. zoom<6 무조건 global.
- proxy: `services/proxy/src/index.ts`는 placeholder worker(키 0개 ok 응답). A2가 Hono 앱으로 교체. wrangler.toml의 KV id는 zeros placeholder.

## 검증 게이트 (Foundation에서 실제 통과 확인됨)

- `pnpm install --frozen-lockfile` 안정 / `pnpm -r typecheck` 0(shared·proxy·mobile) / `pnpm -r test` 20 green.
- `cd services/proxy && pnpm exec wrangler deploy --dry-run --outdir dist` 키 없이 성공(이후 dist 삭제).
- `bash scripts/secret-scan.sh` — git ls-files 기반(빠름). 더미 AIza 키 주입 시 exit 1 확인. node_modules 안 훑음.
- CI yml: `actionlint` 통과(rhysd v1.7.12).

## apps/mobile 주의

- F5 단계 scaffold는 react/react-native만 설치. **expo 미설치** — `app.config.ts`는 `expo/config` import 때문에 tsconfig `include`에서 제외됨(`src/**`만 포함). 스트림 E(E1)가 expo 본설치 후 app.config.ts가 typecheck 대상에 들어옴.
- CI의 web export 단계는 `export:web` 스크립트 부재 시 스킵(E1 대기). E3가 최종 게이트로 강제.
