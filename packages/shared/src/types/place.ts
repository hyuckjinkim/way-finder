/**
 * 정규화 장소 모델 (설계 문서 §7).
 * 프록시가 공급자별(카카오/구글) 스키마를 이 공통 모델로 변환한다.
 */
import type { LatLng } from './geo.js';

/** 검색 결과 한 건 — 지도 핀·검색 리스트용 최소 정보. */
export interface Place {
  /** "kakao:12345" | "google:ChIJ..." 출처 프리픽스 포함 (§7). */
  id: string;
  name: string;
  coord: LatLng;
  category: string;
  address: string;
  /** 검색 기준 좌표로부터 거리(m) — 좌표를 보낸 검색에만. */
  distanceM?: number;
  /** 업종 대분류(카페·음식점·지하철역 …). */
  categoryGroup?: string;
}

/** 구글 평점 요약. P1에서 source는 항상 'google' (§7). */
export interface Rating {
  score: number;
  count: number;
  source: 'google';
}

/** 구글 리뷰 본문 (구글 탭, 최대 5개). */
export interface Review {
  author: string;
  rating: number;
  text: string;
  /** ISO 8601 작성 시각. */
  time: string;
  /** 리뷰 작성자 프로필/리뷰 원문 링크 (선택). */
  authorUrl?: string;
}

/** 블로그 글 한 건 (네이버/카카오 블로그 검색 API 정규화). */
export interface BlogPost {
  title: string;
  url: string;
  /** 본문 요약/스니펫. */
  snippet: string;
  /** 블로거 이름 또는 블로그명. */
  bloggerName: string;
  /** ISO 8601 게시 날짜 (선택 — 공급자가 제공할 때만). */
  postDate?: string;
}

/**
 * 외부 플랫폼 딥링크 모음 (§7). "더보기" 동작의 타깃.
 */
export interface PlaceLinks {
  kakaoMap?: string;
  naverPlace?: string;
  googleMaps?: string;
}

/**
 * 장소 상세. 기본정보(Place) + 플랫폼 탭 콘텐츠 (§7·§9).
 * - rating·reviews: 구글 (탭 열릴 때 lazy load)
 * - blogs: 네이버/카카오 탭별 분리 표시
 * - roadview: 한국 장소만 (카카오 로드뷰 진입 좌표), 글로벌은 미존재
 */
export interface PlaceDetail extends Place {
  phone?: string;
  rating?: Rating;
  /** 구글 리뷰 최대 5개 (구글 탭). 미로드/미제공 시 빈 배열. */
  reviews: Review[];
  /** 탭별 분리 (§7). */
  blogs: {
    naver: BlogPost[];
    kakao: BlogPost[];
  };
  links: PlaceLinks;
  /** 한국 장소의 카카오 로드뷰 진입 좌표 (글로벌은 undefined). */
  roadview?: { lat: number; lng: number };
}
