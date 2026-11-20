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
import { stripHtml } from './html.js';
import { normalizeKakaoBlogDocument } from '../kakaoBlog.js';
import { normalizeNaverBlogItem } from '../naverBlog.js';

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

describe('stripHtml — 블로그 <b> 제거 + 엔티티 디코드', () => {
  it.each([
    ['<b>맛집</b> &#34;강남&#34;', '맛집 "강남"'],
    ['it&#x27;s &#39;ok&#39;', "it's 'ok'"],
    ['A&amp;B &lt;tag&gt; &quot;q&quot; &apos;a&apos;', 'A&B <tag> "q" \'a\''],
    ['카페&middot;베이커리&hellip;', '카페·베이커리…'],
    ['&amp;lt; 이중 디코드 금지', '&lt; 이중 디코드 금지'],
    ['&unknown; &#0; &#x110000;', '&unknown; &#0; &#x110000;'],
  ])('%s', (input, out) => {
    expect(stripHtml(input)).toBe(out);
  });

  it('카카오·네이버 정규화가 공용 디코더를 쓴다', () => {
    const k = normalizeKakaoBlogDocument({
      title: '<b>강남</b>&#x27;s', contents: '&#34;x&#34;', url: 'u', blogname: 'b', thumbnail: '', datetime: '2026-04-30T00:00:00.000+09:00',
    });
    const n = normalizeNaverBlogItem({
      title: '<b>강남</b>&#39;s', link: 'u', description: '&#34;x&#34;', bloggername: 'b', bloggerlink: '', postdate: '20260430',
    });
    expect([k.title, k.snippet, n.title, n.snippet]).toEqual(["강남's", '"x"', "강남's", '"x"']);
  });
});
