/**
 * 라우팅 API 스모크 테스트 (E3).
 *
 * 실 API 키(KakaoMobility / TMAP / ODsay / Google Routes)가 필요한 테스트.
 * env 미설정 시 자동 skip — 단위/통합 테스트(src/**‌/*.test.ts)와 분리되어 기본 CI를 깨지 않는다.
 *
 * 실행:
 *   KAKAO_MOBILITY_KEY=<key> TMAP_APP_KEY=<key> ODSAY_API_KEY=<key> GOOGLE_ROUTES_KEY=<key> \
 *   pnpm --filter @wayfinder/proxy test:smoke
 *
 * §부록 형식 실증용 — byte-perfect 보장 아님. 정규화 함수 방어적 작성의 근거 자료.
 */
import { describe, it, expect } from 'vitest';

const kakaoMobilityKey = process.env.KAKAO_MOBILITY_KEY ?? '';
const tmapAppKey = process.env.TMAP_APP_KEY ?? '';
const odsayApiKey = process.env.ODSAY_API_KEY ?? '';
const googleRoutesKey = process.env.GOOGLE_ROUTES_KEY ?? '';

const hasKakaoMobility = kakaoMobilityKey.length > 0;
const hasTmap = tmapAppKey.length > 0;
const hasOdsay = odsayApiKey.length > 0;
const hasGoogleRoutes = googleRoutesKey.length > 0;

// 서울 시청(출발) → 강남역(도착) 테스트 좌표
const SEOUL_CITY_HALL = { x: 126.9784147, y: 37.5662952 }; // {x: 경도, y: 위도}
const GANGNAM_STATION = { x: 127.0276368, y: 37.4979302 };

describe.skipIf(!hasKakaoMobility)('smoke: 카카오모빌리티 자동차 경로 API', () => {
  it('다중경유지 Directions — 실 API 응답', async () => {
    const url = 'https://apis-navi.kakaomobility.com/v1/waypoints/directions';
    const body = {
      origin: SEOUL_CITY_HALL,
      destination: GANGNAM_STATION,
      waypoints: [],
      priority: 'RECOMMEND',
    };
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `KakaoAK ${kakaoMobilityKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });
    expect(res.ok).toBe(true);
    const json = await res.json() as { routes?: unknown[] };
    expect(Array.isArray(json.routes)).toBe(true);
    expect((json.routes ?? []).length).toBeGreaterThan(0);
  });
});

describe.skipIf(!hasTmap)('smoke: TMAP 보행자 경로 API', () => {
  it('보행자 경로 — 실 API 응답', async () => {
    const url = 'https://apis.openapi.sk.com/tmap/routes/pedestrian?version=1';
    const body = {
      startX: String(SEOUL_CITY_HALL.x),
      startY: String(SEOUL_CITY_HALL.y),
      endX: String(GANGNAM_STATION.x),
      endY: String(GANGNAM_STATION.y),
      startName: '서울시청',
      endName: '강남역',
    };
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        appKey: tmapAppKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });
    expect(res.ok).toBe(true);
    const json = await res.json() as { features?: unknown[] };
    expect(Array.isArray(json.features)).toBe(true);
    expect((json.features ?? []).length).toBeGreaterThan(0);
  });
});

describe.skipIf(!hasTmap)('smoke: TMAP 자전거 경로 API', () => {
  it('자전거 경로 — 실 API 응답 (형식 미검증 — open-questions)', async () => {
    // TMAP 자전거 실 API 형식 미검증 → 응답 구조 로깅 목적.
    const url = 'https://apis.openapi.sk.com/tmap/routes/bicycle?version=1';
    const body = {
      startX: String(SEOUL_CITY_HALL.x),
      startY: String(SEOUL_CITY_HALL.y),
      endX: String(GANGNAM_STATION.x),
      endY: String(GANGNAM_STATION.y),
      startName: '서울시청',
      endName: '강남역',
    };
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        appKey: tmapAppKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });
    // 200 또는 4xx(엔드포인트 미확인) 모두 기록 — 형식 실증이 목적.
    const json = await res.json() as Record<string, unknown>;
    console.info('TMAP 자전거 응답 구조:', JSON.stringify(json).slice(0, 500));
    // 최소: JSON 파싱 가능
    expect(typeof json).toBe('object');
  });
});

describe.skipIf(!hasOdsay)('smoke: ODsay 대중교통 경로 API', () => {
  it('시내 대중교통 경로 — 실 API 응답', async () => {
    const params = new URLSearchParams({
      apiKey: odsayApiKey,
      SX: String(SEOUL_CITY_HALL.x),
      SY: String(SEOUL_CITY_HALL.y),
      EX: String(GANGNAM_STATION.x),
      EY: String(GANGNAM_STATION.y),
    });
    const url = `https://api.odsay.com/v1/api/searchPubTransPathT?${params.toString()}`;
    const res = await fetch(url);
    expect(res.ok).toBe(true);
    const json = await res.json() as { result?: { path?: unknown[] } };
    expect(json.result).toBeDefined();
    expect(Array.isArray(json.result?.path)).toBe(true);
    expect((json.result?.path ?? []).length).toBeGreaterThan(0);
  });
});

describe.skipIf(!hasGoogleRoutes)('smoke: Google Routes v2 API', () => {
  it('자동차 경로 — 실 API 응답', async () => {
    const url = 'https://routes.googleapis.com/directions/v2:computeRoutes';
    const body = {
      origin: {
        location: { latLng: { latitude: SEOUL_CITY_HALL.y, longitude: SEOUL_CITY_HALL.x } },
      },
      destination: {
        location: { latLng: { latitude: GANGNAM_STATION.y, longitude: GANGNAM_STATION.x } },
      },
      travelMode: 'DRIVE',
      polylineEncoding: 'ENCODED_POLYLINE',
    };
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'X-Goog-Api-Key': googleRoutesKey,
        'X-Goog-FieldMask': 'routes.legs,routes.duration,routes.distanceMeters,routes.polyline',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });
    expect(res.ok).toBe(true);
    const json = await res.json() as { routes?: unknown[] };
    expect(Array.isArray(json.routes)).toBe(true);
    expect((json.routes ?? []).length).toBeGreaterThan(0);
  });

  it('대중교통 경로 — 실 API 응답', async () => {
    const url = 'https://routes.googleapis.com/directions/v2:computeRoutes';
    const body = {
      origin: {
        location: { latLng: { latitude: SEOUL_CITY_HALL.y, longitude: SEOUL_CITY_HALL.x } },
      },
      destination: {
        location: { latLng: { latitude: GANGNAM_STATION.y, longitude: GANGNAM_STATION.x } },
      },
      travelMode: 'TRANSIT',
      polylineEncoding: 'ENCODED_POLYLINE',
    };
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'X-Goog-Api-Key': googleRoutesKey,
        'X-Goog-FieldMask': 'routes.legs,routes.duration,routes.distanceMeters,routes.polyline',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });
    expect(res.ok).toBe(true);
    const json = await res.json() as { routes?: unknown[] };
    expect(Array.isArray(json.routes)).toBe(true);
  });
});
