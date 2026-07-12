// 실시간 인기글: TanStack Query, 5분 staleTime으로 목록 API 호출 억제.
import { useQuery } from '@tanstack/react-query';
import { fetchTrendingPosts } from '../api/posts.js';

const STALE_TIME_MS = 5 * 60 * 1000;

export interface TrendingPostRow {
  id: string | number;
  title: string;
  categoryId: string | number | null;
  commentCount: number;
  likeCount: number;
  viewCount: number;
}

function _unwrapApiList(res: unknown): unknown[] {
  if (!res) return [];
  const data = (res as { data?: unknown }).data ?? res;
  const list = (data as { data?: unknown })?.data ?? data;
  return Array.isArray(list) ? list : [];
}

function _normalizeTrendingList(envelope: unknown): TrendingPostRow[] {
  return _unwrapApiList(envelope)
    .map((raw): TrendingPostRow => {
      const row = (raw ?? {}) as Record<string, unknown>;
      return {
        id: (row.id as string | number) ?? '',
        title: String(row.title ?? '').trim(),
        categoryId: (row.categoryId ?? row.category_id ?? null) as string | number | null,
        commentCount: Number(row.commentCount ?? row.comment_count ?? 0),
        likeCount: Number(row.likeCount ?? row.like_count ?? 0),
        viewCount: Number(row.viewCount ?? row.view_count ?? 0),
      };
    })
    .filter((p) => p.id != null && p.id !== '');
}

export function useTrendingPosts({ enabled = true }: { enabled?: boolean } = {}) {
  return useQuery({
    queryKey: ['posts', 'trending'],
    queryFn: async () => {
      const res = await fetchTrendingPosts();
      return _normalizeTrendingList(res);
    },
    enabled,
    staleTime: STALE_TIME_MS,
  });
}
