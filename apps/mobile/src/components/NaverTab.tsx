/**
 * NaverTab — 네이버 블로그 목록 탭 (C4).
 *
 * 블로그 글 리스트 + "네이버에서 더보기" 딥링크. 데이터는 props 주입(PlaceDetail.blogs.naver).
 * 빈 배열이면 빈 상태 안내(graceful degradation — 다른 탭에 영향 없음).
 */
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import type { BlogPost } from '@wayfinder/shared';
import { Deeplink } from './Deeplink.js';

export interface NaverTabProps {
  posts: BlogPost[];
  /** "더보기" 딥링크 URL (PlaceLinks.naverPlace). */
  moreUrl?: string;
  /** 링크 열기 주입(테스트용). */
  onOpenLink?: (url: string) => void;
}

export function NaverTab({ posts, moreUrl, onOpenLink }: NaverTabProps): React.ReactElement {
  if (posts.length === 0) {
    return (
      <View style={styles.empty}>
        <Text style={styles.emptyText}>네이버 블로그 글이 아직 없어요.</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {posts.map((post) => (
        <View key={post.url} style={styles.item}>
          <Text style={styles.title} numberOfLines={2}>
            {post.title}
          </Text>
          <Text style={styles.snippet} numberOfLines={2}>
            {post.snippet}
          </Text>
          <Text style={styles.meta}>
            {post.bloggerName}
            {post.postDate ? ` · ${post.postDate}` : ''}
          </Text>
        </View>
      ))}
      <Deeplink url={moreUrl} label="네이버 지도에서 더보기" onOpen={onOpenLink} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { paddingVertical: 4 },
  empty: { padding: 24, alignItems: 'center' },
  emptyText: { fontSize: 14, color: '#6b7280' },
  item: {
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#eee',
  },
  title: { fontSize: 15, fontWeight: '600', color: '#222' },
  snippet: { fontSize: 13, color: '#555', marginTop: 2 },
  meta: { fontSize: 12, color: '#6b7280', marginTop: 4 },
});
