#!/usr/bin/env bash
#
# P4 F3 — Valhalla 수도권 타일 빌드 (서울+경기 bbox).
#
# 흐름: geofabrik south-korea pbf → osmium 수도권 bbox 추출 → valhalla_build_config
#       → valhalla_build_tiles(concurrency=1) → valhalla_build_extract(tar 패키징).
#
# **WSL2 IO 주의:** 데이터·타일은 WSL 네이티브 경로(기본 ~/valhalla-tiles)에 둔다.
# /mnt/d(Windows 마운트)는 IO가 느려 타일 빌드가 수 배 느려진다 — 회피.
#
# 메모리 전략(§3 F3.3): concurrency=1 + 컨테이너 --memory=4g 상한. 수도권 bbox로
# 입력을 ~35MB로 축소(전국 ~267MB 대비) → 가용 RAM(~4.7GB)에서 안전·재현 가능.
#
# 사용법:
#   bash services/valhalla/build-tiles.sh                 # 전체(다운로드→추출→빌드)
#   DATA_DIR=~/valhalla-tiles bash .../build-tiles.sh      # 작업 디렉토리 변경
#
# 전국 타일 빌드는 별도(§7-2 사용자 액션) — RAM 8GB+ 또는 야간 빌드 필요.
set -euo pipefail

# --- 설정 (env로 override 가능) ---
DATA_DIR="${DATA_DIR:-$HOME/valhalla-tiles}"
# 다이제스트 핀 (재현성 — :latest 드리프트 방지). 라이브 검증 이미지(/status: 3.7.0-14e2c93a8).
VALHALLA_IMAGE="${VALHALLA_IMAGE:-ghcr.io/valhalla/valhalla@sha256:5f79c72167100c9573d84a49eeff095eb703a17a32a5abd7503fdf6982b47c70}"
OSMIUM_IMAGE="${OSMIUM_IMAGE:-iboates/osmium:latest}"
MEM_LIMIT="${MEM_LIMIT:-4g}"
CONCURRENCY="${CONCURRENCY:-1}"

# 수도권(서울+경기) bbox: 경도 126.7~127.3, 위도 37.4~37.7 (§3 F3.2).
BBOX="${BBOX:-126.7,37.4,127.3,37.7}"

GEOFABRIK_URL="https://download.geofabrik.de/asia/south-korea-latest.osm.pbf"
KR_PBF="south-korea-latest.osm.pbf"
METRO_PBF="seoul-metro.osm.pbf"

mkdir -p "${DATA_DIR}"
cd "${DATA_DIR}"

# --- 1. geofabrik south-korea pbf 다운로드 (없으면) ---
if [[ ! -f "${KR_PBF}" ]]; then
  echo "[build-tiles] downloading ${KR_PBF} (~267MB)..."
  if ! curl -fL --retry 3 -o "${KR_PBF}" "${GEOFABRIK_URL}"; then
    echo "[build-tiles] ERROR: geofabrik 다운로드 실패 (네트워크 throttle 가능)." >&2
    echo "[build-tiles] 수동 다운로드 후 ${DATA_DIR}/${KR_PBF}에 배치하고 재실행하세요 (§7-1)." >&2
    exit 1
  fi
else
  echo "[build-tiles] ${KR_PBF} 이미 존재 — 다운로드 건너뜀."
fi

# --- 2. osmium 수도권 bbox 추출 ---
echo "[build-tiles] osmium extract bbox=${BBOX} → ${METRO_PBF}..."
# iboates/osmium 이미지는 entrypoint=osmium (osmium 접두 없이 인자 전달).
docker run --rm -v "${DATA_DIR}:/data" "${OSMIUM_IMAGE}" \
  extract --bbox="${BBOX}" --overwrite -o "/data/${METRO_PBF}" "/data/${KR_PBF}"
echo "[build-tiles] extracted: $(du -h "${METRO_PBF}" | cut -f1)"

# --- 3. config + 타일 빌드 + tar 패키징 (concurrency=1, mem 상한) ---
echo "[build-tiles] building tiles (concurrency=${CONCURRENCY}, mem=${MEM_LIMIT})..."
docker run --rm --memory="${MEM_LIMIT}" -v "${DATA_DIR}:/data" "${VALHALLA_IMAGE}" bash -c "
  set -e
  cd /data
  valhalla_build_config \
    --mjolnir-tile-dir /data/valhalla_tiles \
    --mjolnir-tile-extract /data/valhalla_tiles.tar \
    --mjolnir-concurrency ${CONCURRENCY} > /data/valhalla.json
  echo '[build-tiles] config built'
  valhalla_build_tiles -c /data/valhalla.json /data/${METRO_PBF}
  echo '[build-tiles] tiles built'
  valhalla_build_extract -c /data/valhalla.json -v
  echo '[build-tiles] extract tar built'
"

echo "[build-tiles] DONE. tar: $(du -h "${DATA_DIR}/valhalla_tiles.tar" | cut -f1)"
echo "[build-tiles] 다음: docker compose up (services/valhalla/docker-compose.yml), 또는 health-check.sh."
