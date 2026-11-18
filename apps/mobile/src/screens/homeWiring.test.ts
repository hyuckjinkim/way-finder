/**
 * 회귀(라이브 QA): 홈 지도가 마운트 이후 카메라 변화를 무시했고(스토어 카메라를 useState로 한 번만 복사),
 * 장소 상세는 프록시 힌트 없이 불러 404가 났다. 라우트 어댑터가 배선을 유지하는지 확인한다.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const read = (rel: string): string => readFileSync(join(__dirname, '../../app', rel), 'utf8');

describe('라우트 어댑터 배선', () => {
  it('홈: 스토어 카메라를 제어형 camera로 넘기고 내 위치 점을 전달한다', () => {
    const src = read('index.tsx');
    expect(src).toMatch(/<HomeScreen\b[^>]*\bcamera=\{camera\}/s);
    expect(src).toMatch(/\buserLocation=\{/);
  });

  it('장소 상세: URL 힌트를 상세 쿼리에 넘긴다', () => {
    expect(read('place/[id].tsx')).toMatch(/usePlaceDetailQuery\(id, hint\)/);
  });

  it('검색: 선택 시 name/lat/lng가 실린 place URL로 이동하고 검색 기준 좌표를 넘긴다', () => {
    const src = read('search.tsx');
    expect(src).toMatch(/router\.replace\(placeHref\(place\)\)/);
    expect(src).toMatch(/<SearchScreen\b[^>]*\bnear=\{near\}/s);
  });
});
