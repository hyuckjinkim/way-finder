/**
 * Google Places API v1 (New) raw 응답 픽스처.
 * GET https://places.googleapis.com/v1/places/{placeId}
 *
 * 주요 특징:
 * - text는 { text: string; languageCode: string } 형태의 LocalizedText
 * - authorAttribution.displayName 이 저자명
 * - publishTime은 RFC 3339 (ISO 8601)
 * - location: { latitude, longitude } (Google의 필드명)
 * - rating: number (전체 평점)
 * - userRatingCount: number
 */
export const GOOGLE_PLACE_DETAIL_RAW = {
  name: 'places/ChIJ51cu8IcbXWARiRtXIothAS4',
  id: 'ChIJ51cu8IcbXWARiRtXIothAS4',
  displayName: { text: 'Shibuya Crossing Cafe', languageCode: 'en' },
  formattedAddress: '2-chōme-1 Dōgenzaka, Shibuya City, Tokyo 150-0043, Japan',
  location: { latitude: 35.6595, longitude: 139.7005 },
  rating: 4.2,
  userRatingCount: 856,
  reviews: [
    {
      name: 'places/ChIJ51cu8IcbXWARiRtXIothAS4/reviews/Ahv1t',
      relativePublishTimeDescription: '2 weeks ago',
      text: { text: 'Great view of the crossing. Coffee is decent.', languageCode: 'en' },
      originalText: { text: 'Great view of the crossing. Coffee is decent.', languageCode: 'en' },
      rating: 4,
      authorAttribution: {
        displayName: 'Akira T.',
        uri: 'https://maps.google.com/maps/contrib/1001',
        photoUri: '',
      },
      publishTime: '2026-05-20T03:15:00Z',
    },
    {
      name: 'places/ChIJ51cu8IcbXWARiRtXIothAS4/reviews/Bkw2u',
      relativePublishTimeDescription: '1 month ago',
      text: { text: 'Perfect spot to watch the famous Shibuya scramble. Loved it!', languageCode: 'en' },
      originalText: { text: 'Perfect spot to watch the famous Shibuya scramble. Loved it!', languageCode: 'en' },
      rating: 5,
      authorAttribution: {
        displayName: 'Emma W.',
        uri: 'https://maps.google.com/maps/contrib/1002',
        photoUri: '',
      },
      publishTime: '2026-05-05T07:40:00Z',
    },
    {
      name: 'places/ChIJ51cu8IcbXWARiRtXIothAS4/reviews/Clx3v',
      relativePublishTimeDescription: '2 months ago',
      text: { text: '混んでいるけど景色は最高。', languageCode: 'ja' },
      originalText: { text: '混んでいるけど景色は最高。', languageCode: 'ja' },
      rating: 4,
      authorAttribution: {
        displayName: 'Kenji M.',
        uri: 'https://maps.google.com/maps/contrib/1003',
        photoUri: '',
      },
      publishTime: '2026-04-18T05:00:00Z',
    },
  ],
};

/** 구글 평점이 없는 장소 (graceful degradation 테스트용) */
export const GOOGLE_PLACE_NO_REVIEWS_RAW = {
  name: 'places/ChIJ_test_no_reviews',
  id: 'ChIJ_test_no_reviews',
  displayName: { text: 'Test Place No Reviews', languageCode: 'en' },
  formattedAddress: '1 Test St, Tokyo, Japan',
  location: { latitude: 35.6762, longitude: 139.6503 },
  rating: 0,
  userRatingCount: 0,
  reviews: [],
};
