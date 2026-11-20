#!/usr/bin/env bash
# 프록시(Workers) + 웹 앱(Pages) 배포. 키·설정 원본은 Workspace/key-lib (env-sync.sh 참고).
#   scripts/deploy-web.sh  → https://wayfinder-awh.pages.dev
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"
PROXY_URL="${PROXY_URL:-https://wayfinder-proxy.hyuckjin.workers.dev}"
OUT="$(mktemp -d)"
trap 'rm -rf "$OUT"; scripts/env-sync.sh >/dev/null' EXIT  # 끝나면 로컬 개발용 env로 복구

EXPO_PUBLIC_PROXY_BASE_URL="$PROXY_URL" scripts/env-sync.sh --deploy
(cd services/proxy && npx wrangler deploy)
(cd apps/mobile && npx expo export --platform web --clear --output-dir "$OUT")
# Pages는 404.html이 없으면 index.html(홈)로 폴백 → 클라이언트는 NotFound라 하이드레이션 #418.
[ -f "$OUT/+not-found.html" ] && cp "$OUT/+not-found.html" "$OUT/404.html" || echo "WARN: +not-found.html 없음 — 404.html 생략"
npx --prefix services/proxy wrangler pages deploy "$OUT" --project-name wayfinder --branch main --commit-dirty=true
