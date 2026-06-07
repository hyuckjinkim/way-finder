/**
 * 카카오 Local 키워드 검색 API raw 응답 픽스처.
 * GET https://dapi.kakao.com/v2/local/search/keyword.json
 *
 * 주의: x = longitude(경도), y = latitude(위도) — 일반적 순서와 반대.
 * category_name은 ">" 구분자로 계층 표현.
 * x, y는 string 타입.
 */
export const KAKAO_LOCAL_SEARCH_RAW = {
  meta: {
    total_count: 2,
    pageable_count: 2,
    is_end: true,
    same_name: { region: [], keyword: '카페', selected_region: '' },
  },
  documents: [
    {
      id: '26338954',
      place_name: '안목해변 커피거리 서울점',
      category_name: '음식점 > 카페 > 커피전문점',
      category_group_code: 'CE7',
      category_group_name: '카페',
      phone: '02-1234-5678',
      address_name: '서울특별시 중구 통일로 1',
      road_address_name: '서울특별시 중구 통일로 1',
      x: '126.9723',   // longitude
      y: '37.5563',    // latitude
      place_url: 'https://place.map.kakao.com/26338954',
      distance: '',
    },
    {
      id: '11111111',
      place_name: '남산타워 전망카페',
      category_name: '음식점 > 카페',
      category_group_code: 'CE7',
      category_group_name: '카페',
      phone: '02-9999-8888',
      address_name: '서울특별시 용산구 남산공원길 105',
      road_address_name: '서울특별시 용산구 남산공원길 105',
      x: '126.9882',
      y: '37.5512',
      place_url: 'https://place.map.kakao.com/11111111',
      distance: '',
    },
  ],
};

/** 카카오 Local 단건 상세 응답 (same endpoint, single result) */
export const KAKAO_LOCAL_DETAIL_RAW = {
  meta: { total_count: 1, pageable_count: 1, is_end: true, same_name: { region: [], keyword: '', selected_region: '' } },
  documents: [KAKAO_LOCAL_SEARCH_RAW.documents[0]!],
};
