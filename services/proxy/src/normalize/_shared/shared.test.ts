/**
 * F2 — 통합 유틸 단위 테스트 (parseDurationSec·decodePolyline·coords 매퍼).
 *
 * 게이트(§3 F2 완료 기준): precision 5/6 양쪽 좌표 정확성 + duration 양형 + coords 매퍼.
 */
import { describe, it, expect } from 'vitest';
import { encode } from '@googlemaps/polyline-codec';
import { parseDurationSec } from './duration.js';
import { decodePolyline } from './polyline.js';
import { flatPairsToCoords, pairsToCoords } from './coords.js';

describe('parseDurationSec', () => {
  it('정수 초 문자열 → 초', () => {
    expect(parseDurationSec('123s')).toBe(123);
  });
  it('소수 초 문자열 → 반올림 초', () => {
    expect(parseDurationSec('123.4s')).toBe(123);
    expect(parseDurationSec('123.6s')).toBe(124);
  });
  it('누락/형식 이상 → 0', () => {
    expect(parseDurationSec(undefined)).toBe(0);
    expect(parseDurationSec('')).toBe(0);
    expect(parseDurationSec('abc')).toBe(0);
    expect(parseDurationSec('123')).toBe(0); // 's' 접미 없음
  });
});

describe('decodePolyline — precision 파라미터 (Google 5 vs Valhalla 6)', () => {
  const seoul = [
    { lat: 37.5563, lng: 126.9723 },
    { lat: 37.5665, lng: 126.978 },
  ];

  it('누락 → 빈 배열', () => {
    expect(decodePolyline(undefined, 5)).toEqual([]);
    expect(decodePolyline('', 6)).toEqual([]);
  });

  it('precision 5로 인코딩한 좌표를 precision 5로 디코드하면 복원 (Google)', () => {
    const enc = encode(seoul.map((p) => [p.lat, p.lng]), 5);
    const dec = decodePolyline(enc, 5);
    expect(dec).toHaveLength(2);
    expect(dec[0]!.lat).toBeCloseTo(37.5563, 4);
    expect(dec[0]!.lng).toBeCloseTo(126.9723, 4);
  });

  it('precision 6으로 인코딩한 좌표를 precision 6으로 디코드하면 복원 (Valhalla)', () => {
    const enc = encode(seoul.map((p) => [p.lat, p.lng]), 6);
    const dec = decodePolyline(enc, 6);
    expect(dec).toHaveLength(2);
    expect(dec[0]!.lat).toBeCloseTo(37.5563, 5);
    expect(dec[0]!.lng).toBeCloseTo(126.9723, 5);
  });

  it('precision 불일치는 10× 오차 (미파라미터화 함정 실증)', () => {
    // precision 6 인코딩을 precision 5로 디코드하면 좌표가 ~10× 커진다.
    const enc6 = encode(seoul.map((p) => [p.lat, p.lng]), 6);
    const wrong = decodePolyline(enc6, 5);
    // 37.5563 → 약 375.x (한국 bbox 밖) — 정밀도 인자 필수임을 증명.
    expect(Math.abs(wrong[0]!.lat)).toBeGreaterThan(300);
  });
});

describe('coords 매퍼', () => {
  it('flatPairsToCoords: [lng,lat,...] 평면 → LatLng[], 홀수 꼬리 무시', () => {
    expect(flatPairsToCoords([126.97, 37.55, 126.98, 37.56])).toEqual([
      { lng: 126.97, lat: 37.55 },
      { lng: 126.98, lat: 37.56 },
    ]);
    expect(flatPairsToCoords([126.97, 37.55, 126.98])).toEqual([
      { lng: 126.97, lat: 37.55 },
    ]);
    expect(flatPairsToCoords([])).toEqual([]);
  });

  it('pairsToCoords: [[lng,lat],...] 쌍 → LatLng[], 길이<2 쌍 제외', () => {
    expect(
      pairsToCoords([
        [126.97, 37.55],
        [126.98, 37.56],
      ]),
    ).toEqual([
      { lng: 126.97, lat: 37.55 },
      { lng: 126.98, lat: 37.56 },
    ]);
    expect(pairsToCoords([[126.97]])).toEqual([]);
    expect(pairsToCoords([])).toEqual([]);
  });
});
