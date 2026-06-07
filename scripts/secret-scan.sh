#!/usr/bin/env bash
# 시크릿 스캔 게이트 (Foundation F4).
#
# 하드코딩된 API 키가 소스에 들어오면 빌드를 **실패**시킨다 (수동 diff 아님, 5워커 자율 실행 전제).
# 키 패턴: 구글(AIza...), 카카오 REST/JS(32자 hex), 네이버 클라이언트 시크릿 등.
#
# 추적 대상(git) + 스테이징/언트래킹 파일만 스캔한다 — node_modules 등은 자연히 제외.
# 사용:
#   scripts/secret-scan.sh
# 종료 코드: 0 = 깨끗함, 1 = 잠재적 시크릿 발견
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

# 스캔 자신·문서·픽스처·lockfile 제외 (가짜 데이터 오탐 방지).
EXCLUDE_FILES='scripts/secret-scan.sh|pnpm-lock.yaml|versions.md'

# 키 형태 정규식:
#   - 구글 API 키: AIza + 35자
#   - 카카오 REST/JS 앱키: 32자 소문자 hex (키 컨텍스트 한정)
#   - 네이버 client secret 컨텍스트
PATTERNS=(
  'AIza[0-9A-Za-z_-]{35}'
  '(kakao|KAKAO)[_-]?(rest|REST|js|JS|app|APP)?[_-]?(key|KEY)["'"'"' :=]+[0-9a-f]{32}'
  '(naver|NAVER)[_-]?(client[_-]?)?secret["'"'"' :=]+[0-9A-Za-z]{10,}'
  'X-Naver-Client-Secret["'"'"' :=]+[0-9A-Za-z]{8,}'
)

# 추적 파일 + 언트래킹(무시 제외) 파일 목록. docs/poc도 포함하되 위 EXCLUDE로 거른다.
mapfile -t FILES < <(git ls-files --cached --others --exclude-standard \
  | grep -vE "^(docs|poc)/" \
  | grep -vE "($EXCLUDE_FILES)$" || true)

if [ "${#FILES[@]}" -eq 0 ]; then
  echo "✅ 시크릿 스캔 통과 — 스캔할 파일 없음."
  exit 0
fi

found=0
for pat in "${PATTERNS[@]}"; do
  if matches=$(grep -EnI "$pat" "${FILES[@]}" 2>/dev/null); then
    if [ -n "$matches" ]; then
      echo "❌ 잠재적 하드코딩 시크릿 발견 (패턴: $pat):"
      echo "$matches"
      found=1
    fi
  fi
done

if [ "$found" -ne 0 ]; then
  echo ""
  echo "시크릿은 'wrangler secret put' 또는 환경변수로만 주입하세요. 빌드를 중단합니다."
  exit 1
fi

echo "✅ 시크릿 스캔 통과 — 하드코딩 키 없음."
exit 0
