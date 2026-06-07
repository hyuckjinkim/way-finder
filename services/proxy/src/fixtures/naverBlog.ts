/**
 * 네이버 블로그 검색 API raw 응답 픽스처.
 * GET https://openapi.naver.com/v1/search/blog?query={q}&display=10&start=1&sort=sim
 * 헤더: X-Naver-Client-Id, X-Naver-Client-Secret
 *
 * 주요 특징:
 * - items[].title, description에 <b> 태그 포함 → 정규화 시 제거 필요
 * - postdate는 "YYYYMMDD" 문자열 → "YYYY-MM-DD" 변환 필요
 * - author 정보는 bloggername
 */
export const NAVER_BLOG_SEARCH_RAW = {
  lastBuildDate: 'Sat, 07 Jun 2026 21:30:00 +0900',
  total: 12345,
  start: 1,
  display: 10,
  items: [
    {
      title: '서울 중구 <b>분위기</b> 좋은 카페 다녀왔어요',
      link: 'https://blog.naver.com/example/223456789',
      description: '주말에 친구랑 다녀온 안목해변 <b>커피거리</b> 서울점. 커피 맛집으로 유명한 곳이라...',
      bloggername: '커피러버',
      bloggerlink: 'blog.naver.com/example',
      postdate: '20260501',
    },
    {
      title: '통일로 카페 투어 <b>#3</b>',
      link: 'https://blog.naver.com/example/223456790',
      description: '오늘은 <b>핸드드립</b>이 맛있다는 그 카페. 평일 오후라 한산해서 좋았다.',
      bloggername: '서울맛집탐방',
      bloggerlink: 'blog.naver.com/example2',
      postdate: '20260420',
    },
  ],
};

/** 결과 없는 응답 (degradation 테스트) */
export const NAVER_BLOG_EMPTY_RAW = {
  lastBuildDate: 'Sat, 07 Jun 2026 21:30:00 +0900',
  total: 0,
  start: 1,
  display: 10,
  items: [],
};
