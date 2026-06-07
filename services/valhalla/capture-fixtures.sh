#!/usr/bin/env bash
#
# P4 F4 — 라이브 Valhalla 컨테이너에서 골든 픽스처 캡처.
#
# 실행 중인 컨테이너(http://localhost:${PORT})에 실 /route 호출 → 응답 JSON을
# services/proxy/src/fixtures/valhalla/*.ts 골든 픽스처로 저장.
# **타일 재빌드 시 재캡처 필요** (응답 형식·polyline precision 6이 타일·costing에 의존).
#
# 전제: build-tiles.sh로 타일 빌드 + 컨테이너 기동(README "기동" 절차).
#   docker run -d --name wayfinder-valhalla -p 8002:8002 -v ~/valhalla-tiles:/data \
#     ghcr.io/valhalla/valhalla:latest valhalla_service /data/valhalla.json 1
#
# 사용법:
#   bash services/valhalla/capture-fixtures.sh
set -euo pipefail

PORT="${PORT:-8002}"
BASE="http://localhost:${PORT}"
REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
OUT="${REPO_ROOT}/services/proxy/src/fixtures/valhalla"
TMP="$(mktemp -d)"

# 서울 좌표 (수도권 bbox 내). 결정론적 — 고정 좌표.
A='{"lat":37.5663,"lon":126.9779}'  # 시청
B='{"lat":37.5704,"lon":126.9921}'  # 종로
C='{"lat":37.5512,"lon":126.9882}'  # 명동 (경유지)

# 컨테이너 헬스 확인.
if ! curl -fs "${BASE}/status" >/dev/null; then
  echo "[capture] ERROR: ${BASE}/status 응답 없음 — 컨테이너 기동 후 재실행." >&2
  exit 1
fi

# capture <name> <CONST> <costing_options_suffix> <locations_json>
capture() {
  local name=$1 const=$2 costing=$3 locs=$4 desc=$5
  curl -s -X POST "${BASE}/route" -H 'Content-Type: application/json' \
    -d "{\"locations\":${locs},\"costing\":\"pedestrian\"${costing}}" \
    -o "${TMP}/${name}.json"
  python3 - "$name" "$const" "$desc" "${TMP}/${name}.json" "${OUT}/${name}.ts" <<'PY'
import json, sys
name, const, desc, src, dst = sys.argv[1:6]
raw = json.load(open(src))
assert raw["trip"]["status"] == 0, f"{name}: non-zero status"
body = json.dumps(raw, ensure_ascii=False, indent=2)
body = "\n".join(("  "+l if l else l) for l in body.split("\n"))
open(dst, "w").write(f'''/**
 * P4 F4 — Valhalla 골든 픽스처 (라이브 컨테이너 실 캡처).
 *
 * {desc}
 * 캡처: ghcr.io/valhalla/valhalla:latest + 수도권(서울+경기) bbox 타일.
 * **실 응답** — shape는 encoded polyline precision 6 (A1 정규화기 입력).
 * 타일 재빌드 시 재캡처 필요 (services/valhalla/capture-fixtures.sh).
 */
export const {const} = {body.strip()} as const;
''')
print(f"[capture] {name}.ts ({const}) status=0 legs={len(raw['trip']['legs'])}")
PY
}

capture walkSimple      WALK_SIMPLE_RAW      "" "[$A,$B]" \
  "도보 단순 (시청→종로, 단일 leg). preference 미지정/fastest."
capture walkWaypoints   WALK_WAYPOINTS_RAW   "" "[$A,$C,$B]" \
  "도보 경유지 (시청→명동→종로, 2 leg)."
capture safeProfile     SAFE_PROFILE_RAW \
  ',"costing_options":{"pedestrian":{"use_lit":1.0,"alley_factor":4.0,"driveway_factor":8.0}}' \
  "[$A,$B]" "안전 프로필 (use_lit+alley/driveway 회피 — 소요 증가)."
capture walkableProfile WALKABLE_PROFILE_RAW \
  ',"costing_options":{"pedestrian":{"walkway_factor":2.0,"sidewalk_factor":2.0}}' \
  "[$A,$B]" "걷기좋은 프로필 (walkway/sidewalk 가중)."
capture quietProfile    QUIET_PROFILE_RAW \
  ',"costing_options":{"pedestrian":{"walkway_factor":1.5,"use_living_streets":1.0}}' \
  "[$A,$B]" "한적 프로필 (walkway 가중 + 생활도로 선호)."

rm -rf "${TMP}"
echo "[capture] DONE → ${OUT}/*.ts"
