# E1 (Expo 부트스트랩 + 전 스트림 의존성 일괄 설치) — 학습 노트

> 작성: Executor / 2026-06-07. 5워커가 재발견하지 않도록 비자명 함정만 기록.
> 전제: 모든 스트림 의존성은 E1에서 이미 설치됨 — **워커는 `pnpm add` 불필요, 코드만 작성.**

## 의존성은 전부 설치 완료 (apps/mobile/package.json)

- Expo SDK 56 스택 + 웹 트리오(react-dom, @expo/metro-runtime, react-native-web).
- expo-router 및 그 피어 전체(expo-linking, expo-constants, react-native-screens,
  react-native-safe-area-context, react-native-gesture-handler, react-native-reanimated) — **E2가 라우터 배선**.
- expo-location(D3), maplibre-gl + @maplibre/maplibre-react-native(B3), @react-native-kakao/core + map(B2),
  zustand + @tanstack/react-query(D4).
- 새 핀은 versions.md에 기록(Expo 관리 피어=SDK56 bundledNativeModules, 비-Expo=npm latest).

## 비자명 함정 (E1에서 실제로 막힌 것)

1. **`pnpm -r <script>`가 자동 install을 트리거 → 5워커 병렬 레이스 위험.** pnpm 11은 스크립트 실행 전
   `runDepsStatusCheck`로 `pnpm install`을 spawn한다. 빌드 스크립트가 미승인(ERR_PNPM_IGNORED_BUILDS)이면
   deps-status가 dirty로 남아 매번 자동 install이 돌고, 동시 실행 시 node_modules를 두 install이 동시 변경해
   `Packages: +13 -87` 류 churn + exit 1. **해결: pnpm-workspace.yaml `allowBuilds`에 명시 결정 기록.**
   - `allowBuilds`는 **pnpm 11의 표준 키가 맞다**(true=빌드, false=건너뜀). pnpm이 `pnpm install` 중
     placeholder를 직접 써넣는 것으로 확인됨. (Foundation 노트의 "allowBuilds는 비표준" 추정은 틀림 — pnpm 11이 인식.)
   - msgpackr-extract(Expo metro msgpack 가속, JS 폴백) / return-fetch(@react-native-kakao/core, 순수 JS)는
     `false`로 건너뜀 — /mnt/d에서 node-gyp 네이티브 컴파일 회피.
   - **새 네이티브 빌드 스크립트 의존을 추가하면 동일 증상 발생** → allowBuilds에 true/false 명시할 것.
2. **install/typecheck/test를 병렬 백그라운드로 돌리지 말 것.** node_modules를 변경할 수 있는 pnpm 명령은
   순차 실행. (위 1번과 결합 시 레이스.) 워커 간에도 install류 동시 실행 금지 — 의존성은 이미 설치됐으므로 불요.
3. **app.config.ts는 Node 컨텍스트.** `process.env` 사용 → `@types/node`(22.19.20 핀) + tsconfig `types: ["react","node"]`
   필요. E1에서 추가 완료. 새 Expo config/플러그인 코드도 Node 타입 가정.

## E1 산출 구조 (워커 고정점)

- **엔트리: classic `index.js` (`registerRootComponent(App)`), `"main": "index.js"`.** expo-router는 설치만 됨.
  **E2가 라우터 도입 시** `main`을 `expo-router/entry`로 전환하고 `app/` 라우트를 만든다. 그 전엔 `app/` 만들지 말 것
  (라우트 없이 router entry 쓰면 export "no routes found" 실패).
- `App.tsx`는 F5 stub MapView를 `./src/map/MapView`(고정 경로)로 import. **B4가 이 경로를 실제 디스패처로 덮어쓰면
  App.tsx는 수정 없이 그대로 동작**(MapViewProps/Ref 계약 동일).
- `babel.config.js` = babel-preset-expo만. **reanimated 플러그인은 의도적으로 제외** — reanimated를 실제 import하는
  스트림(E2 라우터/C3 시트)이 필요 시 `react-native-reanimated/plugin`을 babel에 추가하고 **export를 재검증**해야 함
  (계획 §C3: reanimated 4는 WSL 웹 export 위협. E1 stub은 미import이라 무관. **react-navigation native-stack(reanimated 무의존)이
  문서화된 폴백** — E2/E3가 라우터 배선 후 export 깨지면 이쪽으로 전환).
- `metro.config.js`: watchFolders=[repoRoot], nodeModulesPaths=[project, repoRoot], disableHierarchicalLookup=true.
  WSL 폴링은 `WATCHPACK_POLLING=true`/`CHOKIDAR_USEPOLLING=true` env일 때만 활성(dev 서버용; export는 일회성이라 무관).

## 검증 게이트 (E1에서 실제 통과 확인)

- `pnpm install` → exit 0, 멱등("Already up to date"). `pnpm install --frozen-lockfile` → exit 0 (CI 패리티).
- `pnpm -r typecheck` → exit 0 (shared/proxy/mobile). **자동 install 라인 미발생 확인**(워커 안전).
- `pnpm -r test` → 20 passed (shared 19 + proxy 1). apps/mobile은 아직 test 스크립트 없음(정상).
- `expo export --platform web` → `Exported: dist`, exit 0, 경고 0. 328KB 번들.
  - stub MapView 텍스트 번들에 포함 확인.
  - **B4 불변식 사전 충족**: 웹 번들에 `maplibre-react-native`/`react-native-kakao` 참조 0개.
- `bash scripts/secret-scan.sh` → 통과(키 0개).

## @react-native-kakao/map 호환성 (B2 착수 전 참고)

- **설치됨** (2.2.7, core 2.2.7 동반). npm 메타데이터 호환성 확인 결과: peer가 와일드카드(`react: *`,
  `react-native: *`)이고 Expo SDK 제약 없음 → **메타데이터 수준 비호환 없음**(= 설치 보류 사유 없음).
- 마지막 게시 2025-03-19(약 1년 전)이나 그것만으로 보류하지 않음. install/typecheck/export 게이트 모두 통과.
- **단, 디바이스 동작·config plugin 실제 배선은 미검증(§12 한계).** B2가 config plugin 배선 + Expo prebuild
  호환성을 착수 시 최우선 확인. 웹은 동적 script 주입 로더(npm import 아님).
