# Wayfinder Notepad

## P3 Foundation 이월 (보류)

### 워커 간 중복 유틸 통합 (P2 검증 라운드에서 보류 결정)
- 프록시 정규화기(`googleRoutes.ts`, `googleTransit.ts`)의 `parseDurationSec`/`decodePolyline`이
  파일별로 거의 동일하게 중복 정의되어 있다. P2에서는 리팩터 리스크(회귀)로 통합 보류.
- 단, **디코드 에러 정책은 P2에서 일관화함**: 둘 다 디코드 실패 시 throw(장애 격리 미들웨어가
  502로 처리), 누락 polyline은 `[]`. (이전엔 googleTransit만 try/catch로 삼켰음.)
- P3 Foundation에서 공용 `normalize/googleShared.ts`(가칭)로 추출 검토.

### 시외(intercity) transit 실-모드 3분할 스티칭
- 현재 kr 시외 실 모드는 단일 ODsay 도시간 탐색 → train 승격 → `stitchIntercity([], promoted, [])`
  (degenerate, access/egress 빈 그룹). 실 형식의 출발역/도착역 좌표 도출(3-call) 휴리스틱은
  레퍼런스 데이터가 없어 open-question으로 §5 스모크 검증까지 연기.
