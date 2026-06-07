/**
 * 카카오(Daum) 블로그 검색 API raw 응답 픽스처.
 * GET https://dapi.kakao.com/v2/search/blog?query={q}&size=10&sort=accuracy
 * 헤더: Authorization: KakaoAK {REST_API_KEY}
 *
 * 주요 특징:
 * - documents[].title, contents에 <b> 태그 포함 → 정규화 시 제거 필요
 * - datetime은 ISO 8601 형식 (e.g. "2026-04-30T00:00:00.000+09:00")
 * - 저자 정보는 blogname
 */
export const KAKAO_BLOG_SEARCH_RAW = {
  meta: {
    total_count: 1234,
    pageable_count: 800,
    is_end: false,
  },
  documents: [
    {
      title: '[서울카페] 작업하기 좋은 <b>조용한</b> 카페 추천',
      contents: '콘센트도 많고 <b>와이파이</b>도 빨라서 노트북 작업하기 딱 좋은 카페를 발견했다.',
      url: 'https://example.tistory.com/142',
      blogname: '디지털노마드김씨',
      thumbnail: 'https://example.tistory.com/thumbnail/142.jpg',
      datetime: '2026-04-30T00:00:00.000+09:00',
    },
    {
      title: '카카오 <b>블로그</b> 맛집 리스트',
      contents: '이번에 방문한 <b>카페</b>는 정말 훌륭했다.',
      url: 'https://another.tistory.com/99',
      blogname: '맛집블로거',
      thumbnail: '',
      datetime: '2026-05-10T12:00:00.000+09:00',
    },
  ],
};

/** 결과 없는 응답 (degradation 테스트) */
export const KAKAO_BLOG_EMPTY_RAW = {
  meta: { total_count: 0, pageable_count: 0, is_end: true },
  documents: [],
};
