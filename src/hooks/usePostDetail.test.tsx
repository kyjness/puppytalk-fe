/**
 * 게시글 상세 훅이 만드는 실제 요청 검증.
 *
 * 이 파일에만 호출부가 13곳이라 마이그레이션 중 변수를 바꿔 넣기 가장 쉬운 자리다.
 * 타입은 `post_id: string`까지만 보증한다 — 거기에 commentId를 넣어도 통과한다.
 * 그래서 **최종 URL 문자열**을 고정한다. 특히 대댓글 경로는 id가 둘이라 순서가 뒤바뀌면
 * 조용히 엉뚱한 글의 댓글을 부른다.
 */
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const get = vi.fn();
const post = vi.fn().mockResolvedValue({ code: 'OK', data: null });
const patch = vi.fn().mockResolvedValue({ code: 'OK', data: null });
const del = vi.fn().mockResolvedValue({ code: 'OK', data: null });

vi.mock('../api/client.js', () => ({
  api: { get, post, patch, delete: del },
}));
vi.mock('../context/AuthContext.jsx', () => ({
  useAuth: () => ({ isRestored: true }),
}));

const { usePostDetail } = await import('./usePostDetail.js');

const POST_ID = 'post-1';
const USER = { userId: 'me', id: 'me' } as never;

function wrapper({ children }: { children: ReactNode }) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
}

const emptyPage = { code: 'OK', data: { items: [], hasMore: false } };

function mountHook() {
  return renderHook(() => usePostDetail(POST_ID, USER, vi.fn() as never), { wrapper });
}

beforeEach(() => {
  get.mockReset();
  get.mockImplementation((url: string) =>
    Promise.resolve(url.includes('/comments') ? emptyPage : { code: 'OK', data: { id: POST_ID } })
  );
  post.mockClear();
  patch.mockClear();
  del.mockClear();
});

describe('usePostDetail 요청 URL', () => {
  it('게시글 상세와 댓글 첫 페이지를 부른다 — 커서 없이 size만', async () => {
    mountHook();
    await waitFor(() => expect(get).toHaveBeenCalledTimes(2));
    const urls = get.mock.calls.map((c) => c[0] as string);
    expect(urls).toContain(`/posts/${POST_ID}`);
    expect(urls).toContain(`/posts/${POST_ID}/comments?size=10&sort=latest`);
  });

  it('대댓글 더보기는 post_id·comment_id를 제자리에 넣는다', async () => {
    const rootId = 'root-9';
    get.mockImplementation((url: string) => {
      if (url.includes('/replies')) {
        return Promise.resolve({ code: 'OK', data: { items: [], hasMore: false } });
      }
      if (url.includes('/comments')) {
        return Promise.resolve({
          code: 'OK',
          data: {
            items: [
              {
                id: rootId,
                content: '루트',
                replies: [{ id: 'r1', content: '답글', parentId: rootId }],
                replyCount: 5,
                hasMoreReplies: true,
              },
            ],
            hasMore: false,
          },
        });
      }
      return Promise.resolve({ code: 'OK', data: { id: POST_ID } });
    });

    const { result } = mountHook();
    await waitFor(() => expect(result.current.comments.length).toBe(1));

    await result.current.loadMoreReplies(rootId);

    const repliesUrl = get.mock.calls.map((c) => c[0] as string).find((u) => u.includes('/replies'));
    // 순서가 뒤바뀌면 /posts/root-9/comments/post-1/replies 가 된다 — 타입은 통과한다.
    expect(repliesUrl).toBe(`/posts/${POST_ID}/comments/${rootId}/replies?size=10&sort=latest&cursor=r1`);
  });

  it('좋아요 후 "더 보기"가 2페이지를 실제로 렌더한다', async () => {
    // 낙관적 갱신이 리스트를 통째로 덮던 시절엔 여기서 화면이 얼어붙어 2페이지가
    // 영영 안 보였다(버튼도 곧 사라진다).
    const page = (ids: string[], hasMore: boolean) => ({
      code: 'OK',
      data: {
        items: ids.map((id) => ({ id, content: id, replies: [], likeCount: 0, isLiked: false })),
        hasMore,
      },
    });
    get.mockImplementation((url: string) => {
      if (!url.includes('/comments')) return Promise.resolve({ code: 'OK', data: { id: POST_ID } });
      return Promise.resolve(
        url.includes('cursor=') ? page(['c3', 'c4'], false) : page(['c1', 'c2'], true)
      );
    });
    post.mockResolvedValue({ code: 'OK', data: { likeCount: 1, isLiked: true } });

    const { result } = mountHook();
    await waitFor(() => expect(result.current.comments.length).toBe(2));

    await result.current.handleCommentLike('c1');
    await waitFor(() => expect(result.current.comments[0].isLiked).toBe(true));

    result.current.loadMoreComments();

    await waitFor(() => expect(result.current.comments.length).toBe(4));
    expect(result.current.comments.map((c) => c.id)).toEqual(['c1', 'c2', 'c3', 'c4']);
    // 낙관적 갱신도 살아 있어야 한다 — 페이지 누적이 그것을 지워도 안 된다.
    expect(result.current.comments[0].isLiked).toBe(true);
  });

  it('댓글 등록은 게시글 경로 + 본문에 content', async () => {
    const { result } = mountHook();
    await waitFor(() => expect(get).toHaveBeenCalled());

    result.current.setCommentForm({ content: '새 댓글', submitting: false });
    await waitFor(() => expect(result.current.commentForm.content).toBe('새 댓글'));
    await result.current.handleCommentSubmit({ preventDefault: () => {} } as never);

    expect(post.mock.calls[0][0]).toBe(`/posts/${POST_ID}/comments`);
    expect(post.mock.calls[0][1]).toEqual({ content: '새 댓글' });
  });

  it('댓글 수정은 댓글 경로로 patch한다', async () => {
    const { result } = mountHook();
    await waitFor(() => expect(get).toHaveBeenCalled());

    await result.current.handleCommentEdit('c-77', '고친 내용');

    expect(patch).toHaveBeenCalledWith(`/posts/${POST_ID}/comments/c-77`, {
      content: '고친 내용',
    });
  });

  it('댓글 삭제는 게시글·댓글 id 순서를 지킨다', async () => {
    const { result } = mountHook();
    await waitFor(() => expect(get).toHaveBeenCalled());

    await result.current.handleCommentDelete('c-88');

    expect(del).toHaveBeenCalledWith(`/posts/${POST_ID}/comments/c-88`);
  });

  it('게시글 좋아요는 likes 경로를 쓴다', async () => {
    const { result } = mountHook();
    await waitFor(() => expect(result.current.post).toBeTruthy());

    await result.current.handleLike();

    expect(post.mock.calls[0][0]).toBe(`/likes/posts/${POST_ID}`);
  });

  it('댓글 좋아요는 댓글 id로 부른다', async () => {
    const { result } = mountHook();
    await waitFor(() => expect(get).toHaveBeenCalled());

    await result.current.handleCommentLike('c-5');

    expect(post.mock.calls[0][0]).toBe('/likes/comments/c-5');
  });

  it('게시글 삭제는 게시글 경로만 부른다', async () => {
    const { result } = mountHook();
    await waitFor(() => expect(get).toHaveBeenCalled());

    await result.current.handlePostDelete();

    expect(del).toHaveBeenCalledWith(`/posts/${POST_ID}`);
  });
});
