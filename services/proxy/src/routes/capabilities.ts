/**
 * GET /v1/capabilities — 지역별로 실제 경로를 낼 수 있는 이동수단.
 * 앱은 여기 없는 모드 탭을 숨긴다. 키 보유 여부만 보는 순수 계산 (외부 호출 없음).
 */
import type { Context } from 'hono';
import type { TravelMode } from '@wayfinder/shared';
import type { Capabilities } from '@wayfinder/shared/api';
import { routeGate, type Env } from '../config.js';

const MODES: TravelMode[] = ['walk', 'transit', 'car', 'bike'];

export function handleCapabilities(c: Context<{ Bindings: Env }>): Response {
  const real = (region: 'kr' | 'global') =>
    MODES.filter((m) => routeGate(c.env, region, m) === 'real');
  // 한국 대중교통은 웹 앱이 ODsay를 직접 호출하므로 프록시 키 유무와 무관하게 지원.
  const kr = real('kr');
  if (!kr.includes('transit')) kr.push('transit');
  const body: Capabilities = { modes: { kr: MODES.filter((m) => kr.includes(m)), global: real('global') } };
  return c.json(body);
}
