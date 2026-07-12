// 게시글 목록 API: 커서(UUIDv7 공개 ID) 기반 무한 스크롤. 첫 요청은 cursor 미포함.
import { api } from './client.js';
import type { ApiResponse, PostResponse } from './api-types.js';

/** 커서 페이지 응답 payload (ApiResponse.data). */
export interface PostFeedPageData {
  items: PostResponse[];
  hasMore: boolean;
  total?: number;
}

export interface FetchPostsFeedParams {
  cursor?: string | null;
  q?: string | null;
  categoryId?: string | number;
  size: number;
}

export async function fetchPostsFeedPage({
  cursor,
  q,
  categoryId,
  size,
}: FetchPostsFeedParams): Promise<ApiResponse<PostFeedPageData>> {
  const qs = new URLSearchParams();
  qs.set('size', String(size));
  const trimmedQ = (q ?? '').trim();
  if (trimmedQ) qs.set('q', trimmedQ);
  if (categoryId != null && categoryId !== '' && categoryId !== 'all') {
    qs.set('category_id', String(categoryId));
  }
  if (cursor != null && String(cursor).trim() !== '') {
    qs.set('cursor', String(cursor));
  }
  return api.get(`/posts?${qs.toString()}`);
}

export async function fetchTrendingPosts(): Promise<ApiResponse<PostResponse[]>> {
  return api.get('/posts/trending');
}
