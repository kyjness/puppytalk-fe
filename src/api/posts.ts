// 게시글 목록 API: 커서(UUIDv7 공개 ID) 기반 무한 스크롤. 첫 요청은 cursor 미포함.
import { apiGet } from './typed.js';
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
  const trimmedQ = (q ?? '').trim();
  const hasCategory = categoryId != null && categoryId !== '' && categoryId !== 'all';
  const hasCursor = cursor != null && String(cursor).trim() !== '';
  return apiGet('/v1/posts', {
    query: {
      size,
      q: trimmedQ || undefined,
      // 스펙상 정수다 — 문자열로 보내면 서버가 강제 변환해줄 뿐 계약과는 어긋난다.
      category_id: hasCategory ? Number(categoryId) : undefined,
      cursor: hasCursor ? String(cursor) : undefined,
    },
  }) as Promise<ApiResponse<PostFeedPageData>>;
}

export async function fetchTrendingPosts(): Promise<ApiResponse<PostResponse[]>> {
  return apiGet('/v1/posts/trending', {}) as Promise<ApiResponse<PostResponse[]>>;
}
