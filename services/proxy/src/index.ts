/**
 * Cloudflare Workers 프록시 진입점 — Hono 앱 (스트림 A2).
 *
 * 엔드포인트:
 *   GET /v1/places/search?q=&lat=&lng=   장소 검색 (카카오/구글 지역 라우팅)
 *   GET /v1/places/category?code=&rect=   카테고리 검색 (카카오, KV 미사용)
 *   GET /v1/geo/reverse?lat=&lng=         좌표 → 주소 라벨 (카카오 coord2address)
 *   GET /v1/places/:id                    장소 상세 (기본정보 + 블로그, 구글 미포함)
 *   GET /v1/places/:id/google             구글 평점·리뷰 (lazy — 구글 탭 활성화 시)
 *   GET /v1/blogs?q=&region=kr            네이버+카카오 블로그 병합
 *   GET /v1/capabilities                  지원 이동수단 (키 보유 기준)
 *   POST /v1/routes                       경로 탐색 (모드 디스패치 — F1 C2)
 *
 * 경로 등록은 @wayfinder/shared/api 상수를 단일 진실 소스로 사용한다 (P1 드리프트 봉합).
 * `:id` 파라미터 경로는 빌더 상수(`placeDetailPath('id')`)와 정합되는 Hono 패턴으로
 * 유지한다 — 빌더는 encodeURIComponent를 적용하므로 패턴 등록에 직접 쓸 수 없다.
 * 등록·빌더 정합은 contract.test.ts가 센티널로 강제한다.
 *
 * 키 없이 데모 모드로 동작 (A5 config.ts).
 */
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import {
  placesSearchPath,
  placesCategoryPath,
  geoReversePath,
  blogsPath,
  routesPath,
  capabilitiesPath,
} from '@wayfinder/shared/api';
import type { Env } from './config.js';
import { rateLimitMiddleware, routesRateLimit } from './middleware/ratelimit.js';
import { handlePlacesSearch } from './routes/places-search.js';
import { handlePlacesCategory, handleGeoReverse } from './routes/places-category.js';
import { handlePlaceDetail } from './routes/place-detail.js';
import { handlePlaceGoogle } from './routes/place-google.js';
import { handleBlogs } from './routes/blogs.js';
import { dispatchRoutes } from './routes/modeHandlers.js';
import { handleCapabilities } from './routes/capabilities.js';

const app = new Hono<{ Bindings: Env }>();

// 레이트리밋 (IP 단위, 60 req/min)
// 웹 앱(Pages, 별도 origin)에서 호출. 키는 서버에만 있고 응답은 공개 데이터라 전체 허용.
// ponytail: origin '*' — 남용이 보이면 Pages 도메인으로 좁힐 것 (curl 남용은 CORS가 못 막음 → ratelimit 담당).
app.use('/v1/*', cors());
app.use('/v1/*', rateLimitMiddleware);

// 헬스 체크
app.get('/', (c) => c.json({ status: 'ok', service: 'wayfinder-proxy', phase: 1 }));

// 엔드포인트 (구체 경로를 먼저 등록 — :id/google 이 :id 보다 우선 매칭)
// 정적 경로는 shared 상수로, 파라미터 경로는 빌더와 정합되는 Hono 패턴(contract.test 강제).
app.get(placesSearchPath, handlePlacesSearch);
app.get(placesCategoryPath, handlePlacesCategory); // :id 보다 먼저 — 아니면 id='category'
app.get(geoReversePath, handleGeoReverse);
app.get('/v1/places/:id/google', handlePlaceGoogle); // ≡ placeGooglePath(':id')
app.get('/v1/places/:id', handlePlaceDetail); // ≡ placeDetailPath(':id')
app.get(blogsPath, handleBlogs);
app.get(capabilitiesPath, handleCapabilities);

// POST /v1/routes — 모드 디스패치 (F1 C2). A/B가 핸들러 stub을 덮어쓴다.
// 경로는 전역 한도에 더해 전용 한도(10/min)를 한 번 더 — 프리플라이트(OPTIONS)는 세지 않는다.
app.post(routesPath, routesRateLimit, dispatchRoutes);

// 미처리 예외 → JSON 500 (Hono 기본은 text/plain이라 앱이 파싱 실패)
app.onError((err, c) => {
  console.error('[proxy] unhandled error:', err);
  return c.json({ error: 'Internal Server Error' }, 500);
});

// 404 핸들러
app.notFound((c) => c.json({ error: 'Not Found' }, 404));

export default app;

// Durable Object 클래스는 메인 모듈에서 named export 해야 wrangler가 바인딩한다.
export { KakaoTransitQuota } from './quota/transitQuota.js';
