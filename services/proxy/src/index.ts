/**
 * Cloudflare Workers 프록시 진입점 — Hono 앱 (스트림 A2).
 *
 * 엔드포인트:
 *   GET /v1/places/search?q=&lat=&lng=   장소 검색 (카카오/구글 지역 라우팅)
 *   GET /v1/places/:id                    장소 상세 (기본정보 + 블로그, 구글 미포함)
 *   GET /v1/places/:id/google             구글 평점·리뷰 (lazy — 구글 탭 활성화 시)
 *   GET /v1/blogs?q=&region=kr            네이버+카카오 블로그 병합
 *
 * 키 없이 데모 모드로 동작 (A5 config.ts).
 */
import { Hono } from 'hono';
import type { Env } from './config.js';
import { rateLimitMiddleware } from './middleware/ratelimit.js';
import { handlePlacesSearch } from './routes/places-search.js';
import { handlePlaceDetail } from './routes/place-detail.js';
import { handlePlaceGoogle } from './routes/place-google.js';
import { handleBlogs } from './routes/blogs.js';

const app = new Hono<{ Bindings: Env }>();

// 레이트리밋 (IP 단위, 60 req/min)
app.use('/v1/*', rateLimitMiddleware);

// 헬스 체크
app.get('/', (c) => c.json({ status: 'ok', service: 'wayfinder-proxy', phase: 1 }));

// 엔드포인트 (구체 경로를 먼저 등록 — :id/google 이 :id 보다 우선 매칭)
app.get('/v1/places/search', handlePlacesSearch);
app.get('/v1/places/:id/google', handlePlaceGoogle);
app.get('/v1/places/:id', handlePlaceDetail);
app.get('/v1/blogs', handleBlogs);

// 404 핸들러
app.notFound((c) => c.json({ error: 'Not Found' }, 404));

export default app;
