/**
 * 자전거 경로 핸들러 (A2 — F1 stub 덮어쓰기).
 *
 * 한국=TMAP 자전거, 글로벌=Google Routes(BICYCLE).
 * 검증·지역판정·데모/실 분기는 공용 handleDirectRoute에 위임.
 * modeHandlers.ts·index.ts는 불가침.
 */
import type { RouteHandler } from './modeHandlers.js';
import { handleDirectRoute } from './routeDirect.js';

export const routeBike: RouteHandler = (c) => handleDirectRoute(c, 'bike');
