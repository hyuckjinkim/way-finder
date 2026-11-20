import { describe, it, expect } from 'vitest';
import { formatDistance, placeSubtitle, splitMatch } from './format.js';

describe('formatDistance', () => {
  it.each([
    [350, '350m'],
    [999.4, '999m'],
    [1234, '1.2km'],
    [12500, '13km'],
  ])('%d → %s', (m, out) => expect(formatDistance(m)).toBe(out));

  it('잘못된 값은 빈 문자열', () => {
    expect(formatDistance(-1)).toBe('');
    expect(formatDistance(NaN)).toBe('');
  });
});

describe('placeSubtitle', () => {
  const base = { category: '음식점 > 카페', address: '서울 중구 세종대로 110' };
  it('업종 그룹 · 거리 · 주소 순서', () => {
    expect(placeSubtitle({ ...base, categoryGroup: '카페', distanceM: 350 })).toBe('카페 · 350m · 서울 중구 세종대로 110');
  });
  it('그룹·거리가 없으면 category · 주소', () => {
    expect(placeSubtitle(base)).toBe('음식점 > 카페 · 서울 중구 세종대로 110');
  });
  it('빈 항목은 구분자 없이 건너뛴다', () => {
    expect(placeSubtitle({ category: '', address: '서울' })).toBe('서울');
  });
  it('주소 검색 결과: 제목과 같은 주소는 다시 쓰지 않는다', () => {
    const addr = '경기 성남시 분당구 판교역로 235';
    expect(placeSubtitle({ category: '주소', address: addr }, addr)).toBe('주소');
  });
});

describe('splitMatch', () => {
  it('일치 부분을 분리한다(대소문자 무시)', () => {
    expect(splitMatch('Starbucks 강남점', 'bucks')).toEqual([
      { text: 'Star', match: false },
      { text: 'bucks', match: true },
      { text: ' 강남점', match: false },
    ]);
  });
  it('일치가 없거나 빈 질의면 통째로 반환', () => {
    expect(splitMatch('강남역', 'xyz')).toEqual([{ text: '강남역', match: false }]);
    expect(splitMatch('강남역', '  ')).toEqual([{ text: '강남역', match: false }]);
  });
  it('전체 일치', () => {
    expect(splitMatch('강남역', '강남역')).toEqual([{ text: '강남역', match: true }]);
  });
});
