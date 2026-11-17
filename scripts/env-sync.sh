#!/usr/bin/env bash
# Workspace/key-lib의 keys.env(공용 키) + wayfinder.env(이 프로젝트 설정·별칭)를 합쳐 앱·프록시 env를 만든다.
# 프로젝트 루트 .env는 선택(로컬 임시 덮어쓰기용) — 원본은 key-lib.
#
#   scripts/env-sync.sh            → apps/mobile/.env + services/proxy/.dev.vars 생성 (로컬 개발)
#   scripts/env-sync.sh --deploy   → 위 + 값이 있는 프록시 키를 `wrangler secret bulk`로 업로드
#
# 병합 규칙: keys.env → wayfinder.env → (있으면) 루트 .env 순, 빈 값은 앞의 값을 덮어쓰지 않음.
# 값의 ${NAME}은 병합 결과로 치환. 실행 시 환경변수로 준 EXPO_PUBLIC_PROXY_BASE_URL이 최우선(배포 빌드용).
# key-lib 경로 변경: KEYLIB_DIR=/path scripts/env-sync.sh
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"
KEYLIB_DIR="${KEYLIB_DIR:-$ROOT/../key-lib}"
SOURCES=("$KEYLIB_DIR/keys.env" "$KEYLIB_DIR/wayfinder.env")
for f in "${SOURCES[@]}"; do
  [ -f "$f" ] || { echo "원본 없음: $f — 같은 폴더의 .example 참고" >&2; exit 1; }
done
[ -f .env ] && SOURCES+=(.env)

# 프록시 시크릿 이름 (services/proxy/src/config.ts의 Env와 일치해야 함)
PROXY_KEYS='KAKAO_REST_KEY|KAKAO_MOBILITY_KEY|GOOGLE_PLACES_KEY|GOOGLE_ROUTES_KEY|NAVER_CLIENT_ID|NAVER_CLIENT_SECRET|TMAP_APP_KEY|ODSAY_API_KEY'

umask 077  # 생성 파일 600
merged="$(mktemp)"; override="$(mktemp)"
trap 'rm -f "$merged" "$override" "${tmp:-}"' EXIT
[ -n "${EXPO_PUBLIC_PROXY_BASE_URL:-}" ] && echo "EXPO_PUBLIC_PROXY_BASE_URL=$EXPO_PUBLIC_PROXY_BASE_URL" > "$override"
awk -F= '
  /^[A-Z_]+=/ {
    k = $1; v = substr($0, length(k) + 2)
    if (!(k in val)) order[++n] = k
    if (v != "" || !(k in val)) val[k] = v
  }
  END {
    for (i = 1; i <= n; i++) {
      k = order[i]; v = val[k]
      while (match(v, /\$\{[A-Z_]+\}/)) {
        ref = substr(v, RSTART + 2, RLENGTH - 3)
        v = substr(v, 1, RSTART - 1) val[ref] substr(v, RSTART + RLENGTH)
      }
      print k "=" v
    }
  }' "${SOURCES[@]}" "$override" > "$merged"

grep -E '^EXPO_PUBLIC_[A-Z_]+=' "$merged" > apps/mobile/.env || true
grep -E "^(${PROXY_KEYS}|VALHALLA_URL)=" "$merged" > services/proxy/.dev.vars || true
echo "✓ apps/mobile/.env ($(grep -c '=.' apps/mobile/.env || true)개 값)"
echo "✓ services/proxy/.dev.vars ($(grep -c '=.' services/proxy/.dev.vars || true)개 값)"

[ "${1:-}" = "--deploy" ] || exit 0

# 빈 값은 올리지 않는다 — 이미 배포된 시크릿을 빈 문자열로 덮어쓰지 않도록.
# ponytail: VALHALLA_URL은 제외 — 배포 Worker는 localhost Valhalla에 닿지 못함, 공개 호스팅 시 추가.
tmp="$(mktemp)"
grep -E "^(${PROXY_KEYS})=.+" "$merged" > "$tmp" || { echo "업로드할 프록시 키가 없습니다" >&2; exit 1; }
echo "→ wrangler secret bulk ($(wc -l < "$tmp")개 키)"
(cd services/proxy && npx wrangler secret bulk "$tmp")
