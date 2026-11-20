/**
 * 네이버 블로그 검색 API 응답 → 정규화 BlogPost 변환.
 *
 * 주요 특징:
 * - title, description에 <b> HTML 태그 포함 → stripHtml()로 제거
 * - postdate는 "YYYYMMDD" → "YYYY-MM-DD" 변환
 * - bloggername이 저자명
 */
import type { BlogPost } from '@wayfinder/shared';
import { stripHtml } from './_shared/html.js';

/** 네이버 블로그 검색 아이템 원시 타입 */
export interface NaverBlogItem {
  title: string;       // <b> 태그 포함
  link: string;
  description: string; // <b> 태그 포함
  bloggername: string;
  bloggerlink: string;
  postdate: string;    // "YYYYMMDD"
}

/** 네이버 블로그 검색 응답 원시 타입 */
export interface NaverBlogResponse {
  lastBuildDate?: string;
  total: number;
  start: number;
  display: number;
  items: NaverBlogItem[];
}

/** "YYYYMMDD" → "YYYY-MM-DD" */
function formatPostDate(postdate: string): string {
  if (postdate.length !== 8) return postdate;
  return `${postdate.slice(0, 4)}-${postdate.slice(4, 6)}-${postdate.slice(6, 8)}`;
}

/** 네이버 블로그 아이템 → 정규화 BlogPost */
export function normalizeNaverBlogItem(item: NaverBlogItem): BlogPost {
  return {
    title: stripHtml(item.title),
    url: item.link,
    snippet: stripHtml(item.description),
    bloggerName: item.bloggername,
    postDate: formatPostDate(item.postdate),
  };
}

/** 네이버 블로그 응답 전체 → BlogPost[] */
export function normalizeNaverBlogResponse(raw: NaverBlogResponse): BlogPost[] {
  return raw.items.map(normalizeNaverBlogItem);
}
