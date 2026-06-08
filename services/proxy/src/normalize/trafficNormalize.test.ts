/**
 * T1 — 실시간 교통 정규화 단위 테스트.
 * 공급자 교통 raw → RouteLegTraffic: 혼잡도 버킷 매핑·지연 산출·하위호환(부재 시 미부착) 검증.
 *
 * ⚠️ 지식 기반 픽스처(traffic.ts fixtures) — 실 형식 미보장. 라이브 viability는 키 후 QA(§P5).
 */
import { describe, it, expect } from 'vitest';

import { normalizeTraffic } from './traffic.js';
import {
  TRAFFIC_JAM_RAW,
  TRAFFIC_SLOW_RAW,
  TRAFFIC_FREE_RAW,
  TRAFFIC_EMPTY_RAW,
} from '../../test/fixtures/traffic.js';

describe('normalizeTraffic', () => {
  it('congestionLevel 3 → jam, delaySec 180 (정체)', () => {
    expect(normalizeTraffic(TRAFFIC_JAM_RAW)).toEqual({
      congestion: 'jam',
      delaySec: 180,
    });
  });

  it('congestionLevel 2 → slow, delaySec 60 (서행)', () => {
    expect(normalizeTraffic(TRAFFIC_SLOW_RAW)).toEqual({
      congestion: 'slow',
      delaySec: 60,
    });
  });

  it('congestionLevel 1 → free, delaySec 0 (원활)', () => {
    expect(normalizeTraffic(TRAFFIC_FREE_RAW)).toEqual({
      congestion: 'free',
      delaySec: 0,
    });
  });

  it('빈 응답 → undefined (하위호환: 메타 미부착)', () => {
    expect(normalizeTraffic(TRAFFIC_EMPTY_RAW)).toBeUndefined();
  });

  it('미매핑 혼잡 코드 → congestion 필드 생략 (지연만 부착)', () => {
    expect(normalizeTraffic({ congestionLevel: 99, delaySeconds: 30 })).toEqual({
      delaySec: 30,
    });
  });

  it('혼잡도만 있고 지연 부재 → congestion만 부착', () => {
    expect(normalizeTraffic({ congestionLevel: 2 })).toEqual({
      congestion: 'slow',
    });
  });

  it('지연만 있고 혼잡도 부재 → delaySec만 부착', () => {
    expect(normalizeTraffic({ delaySeconds: 45 })).toEqual({
      delaySec: 45,
    });
  });

  it('미매핑 혼잡 코드 + 지연 부재 → undefined (전부 부재)', () => {
    expect(normalizeTraffic({ congestionLevel: 7 })).toBeUndefined();
  });

  it('음수 지연 → 0으로 클램프', () => {
    expect(normalizeTraffic({ delaySeconds: -10 })).toEqual({
      delaySec: 0,
    });
  });
});
