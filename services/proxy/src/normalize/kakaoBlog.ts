/**
 * 카카오(Daum) 블로그 검색 API 응답 → 정규화 BlogPost 변환.
 *
 * 주요 특징:
 * - title, contents에 <b> HTML 태그 포함 → stripHtml()로 제거
 * - datetime은 ISO 8601 형식 ("2026-04-30T00:00:00.000+09:00")
 *   → "YYYY-MM-DD" 변환 (날짜 부분만 추출)
 * - blogname이 저자명
 */
import type { BlogPost } from '@wayfinder/shared';
import { stripHtml } from './_shared/html.js';

/** 카카오 블로그 문서 원시 타입 */
export interface KakaoBlogDocument {
  title: string;     // <b> 태그 포함
  contents: string;  // <b> 태그 포함
  url: string;
  blogname: string;
  thumbnail: string;
  datetime: string;  // ISO 8601
}

/** 카카오 블로그 검색 응답 원시 타입 */
export interface KakaoBlogResponse {
  meta: { total_count: number; pageable_count: number; is_end: boolean };
  documents: KakaoBlogDocument[];
}

/** ISO 8601 datetime → "YYYY-MM-DD" (날짜 부분만) */
function extractDate(datetime: string): string {
  // "2026-04-30T00:00:00.000+09:00" → "2026-04-30"
  return datetime.slice(0, 10);
}

/** 카카오 블로그 문서 → 정규화 BlogPost */
export function normalizeKakaoBlogDocument(doc: KakaoBlogDocument): BlogPost {
  return {
    title: stripHtml(doc.title),
    url: doc.url,
    snippet: stripHtml(doc.contents),
    bloggerName: doc.blogname,
    postDate: extractDate(doc.datetime),
  };
}

/** 카카오 블로그 응답 전체 → BlogPost[] */
export function normalizeKakaoBlogResponse(raw: KakaoBlogResponse): BlogPost[] {
  return raw.documents.map(normalizeKakaoBlogDocument);
}
