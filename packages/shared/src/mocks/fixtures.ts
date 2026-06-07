/**
 * 결정론적 목 픽스처 (설계 문서 §7·§9).
 * 앱의 데모 모드와 프록시 정규화 테스트 양쪽의 공통 입력.
 * 키 0개로 전체 빌드·테스트가 동작하도록 모든 외부 데이터를 여기서 채운다.
 */
import type { Place, PlaceDetail } from '../types/place.js';

/**
 * 한국 장소 — 서울 카페.
 * 구글 평점 + 리뷰 5개 + 네이버/카카오 블로그 + 카카오 로드뷰 좌표 포함.
 */
export const SEOUL_CAFE: PlaceDetail = {
  id: 'kakao:26338954',
  name: '안목해변 커피거리 서울점',
  coord: { lat: 37.5563, lng: 126.9723 },
  category: '카페',
  address: '서울특별시 중구 통일로 1',
  phone: '02-1234-5678',
  rating: { score: 4.5, count: 1287, source: 'google' },
  reviews: [
    {
      author: 'Jiwon K.',
      rating: 5,
      text: '분위기가 정말 좋고 커피도 훌륭해요. 자리가 넓어서 작업하기 좋습니다.',
      time: '2026-05-12T09:30:00Z',
      authorUrl: 'https://maps.google.com/?reviewer=jiwon',
    },
    {
      author: 'Minseok L.',
      rating: 4,
      text: 'Coffee was great, a bit crowded on weekends but worth it.',
      time: '2026-04-28T14:10:00Z',
    },
    {
      author: 'Hana P.',
      rating: 5,
      text: '라떼가 부드럽고 디저트도 맛있어요. 재방문 의사 100%.',
      time: '2026-04-15T11:00:00Z',
    },
    {
      author: 'Daniel R.',
      rating: 4,
      text: 'Cozy spot near the station. Friendly staff.',
      time: '2026-03-30T16:45:00Z',
    },
    {
      author: 'Sora J.',
      rating: 5,
      text: '인테리어가 감각적이고 사진 찍기 좋아요. 핸드드립 추천!',
      time: '2026-03-02T08:20:00Z',
    },
  ],
  blogs: {
    naver: [
      {
        title: '서울 중구 분위기 좋은 카페 다녀왔어요',
        url: 'https://blog.naver.com/example/223456789',
        snippet: '주말에 친구랑 다녀온 안목해변 커피거리 서울점. 커피 맛집으로 유명한 곳이라...',
        bloggerName: '커피러버',
        postDate: '2026-05-01',
      },
      {
        title: '통일로 카페 투어 #3',
        url: 'https://blog.naver.com/example/223456790',
        snippet: '오늘은 핸드드립이 맛있다는 그 카페. 평일 오후라 한산해서 좋았다.',
        bloggerName: '서울맛집탐방',
        postDate: '2026-04-20',
      },
    ],
    kakao: [
      {
        title: '[서울카페] 작업하기 좋은 조용한 카페 추천',
        url: 'https://example.tistory.com/142',
        snippet: '콘센트도 많고 와이파이도 빨라서 노트북 작업하기 딱 좋은 카페를 발견했다.',
        bloggerName: '디지털노마드김씨',
        postDate: '2026-04-30',
      },
    ],
  },
  links: {
    kakaoMap: 'https://map.kakao.com/link/map/26338954',
    naverPlace: 'https://map.naver.com/p/entry/place/1234567890',
    googleMaps: 'https://maps.google.com/?cid=9876543210',
  },
  roadview: { lat: 37.5563, lng: 126.9723 },
};

/**
 * 글로벌 장소 — 도쿄.
 * 구글 평점 + 리뷰. 블로그 없음, 로드뷰(카카오) 없음 (한국 밖이므로).
 */
export const TOKYO_PLACE: PlaceDetail = {
  id: 'google:ChIJ51cu8IcbXWARiRtXIothAS4',
  name: 'Shibuya Crossing Cafe',
  coord: { lat: 35.6595, lng: 139.7005 },
  category: 'Cafe',
  address: '2-chōme-1 Dōgenzaka, Shibuya City, Tokyo',
  phone: '+81 3-1234-5678',
  rating: { score: 4.2, count: 856, source: 'google' },
  reviews: [
    {
      author: 'Akira T.',
      rating: 4,
      text: 'Great view of the crossing. Coffee is decent.',
      time: '2026-05-20T03:15:00Z',
    },
    {
      author: 'Emma W.',
      rating: 5,
      text: 'Perfect spot to watch the famous Shibuya scramble. Loved it!',
      time: '2026-05-05T07:40:00Z',
    },
    {
      author: 'Kenji M.',
      rating: 4,
      text: '混んでいるけど景色は最高。',
      time: '2026-04-18T05:00:00Z',
    },
  ],
  blogs: { naver: [], kakao: [] },
  links: {
    googleMaps: 'https://maps.google.com/?cid=1234567890123456',
  },
  // roadview 없음 — 글로벌은 구글 스트리트뷰 딥링크 사용 (§5).
};

/**
 * 검색 결과 리스트 픽스처 (자동완성·검색 화면용).
 * 한국 + 글로벌 장소를 섞어 지역 라우팅 테스트가 가능하도록 한다.
 */
export const SEARCH_RESULTS: Place[] = [
  {
    id: SEOUL_CAFE.id,
    name: SEOUL_CAFE.name,
    coord: SEOUL_CAFE.coord,
    category: SEOUL_CAFE.category,
    address: SEOUL_CAFE.address,
  },
  {
    id: 'kakao:11111111',
    name: '남산타워 전망카페',
    coord: { lat: 37.5512, lng: 126.9882 },
    category: '카페',
    address: '서울특별시 용산구 남산공원길 105',
  },
  {
    id: TOKYO_PLACE.id,
    name: TOKYO_PLACE.name,
    coord: TOKYO_PLACE.coord,
    category: TOKYO_PLACE.category,
    address: TOKYO_PLACE.address,
  },
];

/** id로 상세 픽스처를 찾기 위한 색인. */
export const PLACE_DETAILS: Record<string, PlaceDetail> = {
  [SEOUL_CAFE.id]: SEOUL_CAFE,
  [TOKYO_PLACE.id]: TOKYO_PLACE,
};
