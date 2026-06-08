# services/valhalla — 자체 라우팅 엔진 (Valhalla, P4)

수도권(서울+경기) 도보 커스텀 라우팅을 위한 로컬 self-hosted Valhalla.
**키 불필요** — 로컬 Docker. 기존 4모드(kakao/tmap/google)는 불변, 커스텀 도보만 Valhalla.

## 범위 (P4)

- **커스텀 도보 = 한국·수도권 bbox 전용** (서울+경기). 글로벌·도보 외 모드는 범위 밖.
- 프로필 3종 costing 지원: `walkable`·`safe`·`quiet` (`conf/profiles.json`).
- `scenic`은 costing 미지원(❌) — 그래프 보강 후속 단계(`ENABLE_SCENIC` flag).

## 1-커맨드 기동

```bash
# 1) 타일 빌드 (geofabrik 다운로드 → osmium 수도권 추출 → 타일 빌드). 장시간.
bash services/valhalla/build-tiles.sh

# 2) 서빙 (빌드된 타일을 valhalla_service로). 포트 8002.
# 이미지는 다이제스트 핀 (재현성 — :latest 드리프트 방지). 라이브 검증 이미지(/status: 3.7.0-14e2c93a8).
docker run -d --name wayfinder-valhalla --memory=4g -p 8002:8002 \
  -v ~/valhalla-tiles:/data \
  ghcr.io/valhalla/valhalla@sha256:5f79c72167100c9573d84a49eeff095eb703a17a32a5abd7503fdf6982b47c70 \
  valhalla_service /data/valhalla.json 1

# 3) 헬스 확인
curl -fs http://localhost:8002/status

# 또는 compose (VALHALLA_DATA로 타일 경로 지정):
VALHALLA_DATA=~/valhalla-tiles docker compose -f services/valhalla/docker-compose.yml up -d
```

## 샘플 /route (도보, 서울)

```bash
curl -s -X POST http://localhost:8002/route -H 'Content-Type: application/json' -d '{
  "locations": [{"lat":37.5663,"lon":126.9779},{"lat":37.5704,"lon":126.9921}],
  "costing": "pedestrian"
}'
# → trip.status=0, legs[].shape = encoded polyline (precision 6)
```

## 메모리·IO 전략 (WSL2)

- **WSL 네이티브 경로**(`~/valhalla-tiles`)에 데이터·타일 보관 — `/mnt/d`(Windows 마운트)는
  IO가 느려 빌드가 수 배 느려진다. compose 볼륨·스크립트 모두 네이티브 경로 사용.
- 타일 빌드: `mjolnir.concurrency=1` + 컨테이너 `--memory=4g` 상한 (OOM 방지·재현성).
- 수도권 bbox 추출로 입력 ~35MB(전국 ~267MB 대비) → 가용 RAM에서 안전.
- 타일(`valhalla_tiles*`)·OSM pbf는 `.gitignore` (대용량·재생성 가능).

## 골든 픽스처 (F4)

`capture-fixtures.sh`가 라이브 컨테이너의 실 `/route` 응답을
`services/proxy/src/fixtures/valhalla/*.ts`로 저장한다 (프록시 정규화기·실-모드 테스트 입력).
**타일 재빌드 시 재캡처 필요** — 응답·polyline precision 6이 타일·costing에 의존.

```bash
bash services/valhalla/capture-fixtures.sh   # 컨테이너 기동 상태에서
```

## 전국 타일 빌드 (사용자 액션)

south-korea 전체 pbf 기반 전국 빌드는 RAM 8GB+ 또는 야간 빌드 필요 — P4 기능 검증과 분리.
`BBOX` env로 추출 범위를 넓히거나, bbox 추출 단계를 건너뛰고 `south-korea-latest.osm.pbf`를
직접 빌드 입력으로 사용한다 (P4 §7-2).
