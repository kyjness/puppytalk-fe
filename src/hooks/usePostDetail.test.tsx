/**
 * 게시글 상세 훅이 만드는 실제 요청 검증.
 *
 * 이 파일에만 호출부가 13곳이라 마이그레이션 중 변수를 바꿔 넣기 가장 쉬운 자리다.
 * 타입은 `post_id: string`까지만 보증한다 — 거기에 commentId를 넣어도 통과한다.
 * 그래서 **최종 URL 문자열**을 고정한다. 특히 대댓글 경로는 id가 둘이라 순서가 뒤바뀌면
 * 조용히 엉뚱한 글의 댓글을 부른다.
 */
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react';
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

const emptyPage = { code: 'OK', data: { items: [], hasMore: false, total: 0 } };

function mountHook(postId: string = POST_ID) {
  return renderHook(({ id }: { id: string }) => usePostDetail(id, USER, vi.fn() as never), {
    wrapper,
    initialProps: { id: postId },
  });
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
  it('게시글 상세와 댓글 1쪽을 부른다 — 커서가 아니라 page(ADR 0016)', async () => {
    mountHook();
    await waitFor(() => expect(get).toHaveBeenCalledTimes(2));
    const urls = get.mock.calls.map((c) => c[0] as string);
    expect(urls).toContain(`/posts/${POST_ID}`);
    expect(urls).toContain(`/posts/${POST_ID}/comments?page=1&size=10&sort=popular`);
  });

  it('다른 글로 이동하면 페이지가 1쪽으로 돌아간다', async () => {
    // 라우터가 /posts/:id에 같은 element를 재사용하므로 훅 state가 글을 넘나들어 살아남는다.
    // 3쪽에 머문 채 댓글 적은 글로 가면 빈 목록 + 페이지 nav 소멸 = 막다른 길이었다.
    // 3쪽이 실제로 존재해야 한다 — 없으면 클램프가 즉시 1쪽으로 되돌린다(그건 다른 테스트).
    get.mockImplementation((url: string) =>
      Promise.resolve(
        url.includes('/comments')
          ? { code: 'OK', data: { items: [], hasMore: true, total: 30 } }
          : { code: 'OK', data: { id: POST_ID } }
      )
    );
    const { result, rerender } = mountHook();
    await waitFor(() => expect(get).toHaveBeenCalledTimes(2));

    act(() => result.current.setCommentPage(3));
    await waitFor(() => expect(result.current.commentPage).toBe(3));

    rerender({ id: 'post-2' });

    await waitFor(() => expect(result.current.commentPage).toBe(1));
    expect(get.mock.calls.map((c) => c[0] as string)).toContain(
      '/posts/post-2/comments?page=1&size=10&sort=popular'
    );
  });

  it('쪽수가 줄면 현재 쪽을 마지막 쪽으로 끌어내린다', async () => {
    // 2쪽에 홀로 있던 댓글을 지우면 total이 줄어 2쪽이 사라진다 — 그 자리에 남으면
    // 빈 목록에 nav까지 없어져 돌아올 방법이 없다.
    let total = 11;
    get.mockImplementation((url: string) => {
      if (!url.includes('/comments')) return Promise.resolve({ code: 'OK', data: { id: POST_ID } });
      return Promise.resolve({
        code: 'OK',
        data: { items: [{ id: 'c1', content: 'x', replies: [] }], hasMore: false, total },
      });
    });

    const { result } = mountHook();
    await waitFor(() => expect(result.current.commentTotalPages).toBe(2));

    act(() => result.current.setCommentPage(2));
    await waitFor(() => expect(result.current.commentPage).toBe(2));

    total = 10; // 마지막 댓글 삭제
    await act(async () => {
      await result.current.loadComments();
    });

    await waitFor(() => expect(result.current.commentPage).toBe(1));
  });

  it('같은 쪽 번호를 다시 눌러도 펼친 답글이 접히지 않는다', async () => {
    const rootId = 'root-p';
    get.mockImplementation((url: string) => {
      if (url.includes('/replies')) {
        return Promise.resolve({
          code: 'OK',
          data: { items: [{ id: 'r2', content: '답글2', parentId: rootId }], hasMore: false },
        });
      }
      if (url.includes('/comments')) {
        return Promise.resolve({
          code: 'OK',
          data: {
            items: [
              {
                id: rootId,
                content: '루트',
                replies: [{ id: 'r1', content: '답글1', parentId: rootId }],
                replyCount: 2,
                hasMoreReplies: true,
              },
            ],
            hasMore: false,
            total: 1,
          },
        });
      }
      return Promise.resolve({ code: 'OK', data: { id: POST_ID } });
    });

    const { result } = mountHook();
    await waitFor(() => expect(result.current.comments.length).toBe(1));
    await result.current.loadMoreReplies(rootId);
    await waitFor(() => expect(result.current.expandedReplyIds.has(rootId)).toBe(true));

    act(() => result.current.setCommentPage(result.current.commentPage));

    expect(result.current.expandedReplyIds.has(rootId)).toBe(true);
  });

  it('정렬을 최신순으로 바꾸면 sort=latest로 1쪽부터 다시 부른다', async () => {
    const { result } = mountHook();
    await waitFor(() => expect(get).toHaveBeenCalledTimes(2));

    act(() => result.current.setCommentPage(3));
    await waitFor(() =>
      expect(get.mock.calls.map((c) => c[0] as string)).toContain(
        `/posts/${POST_ID}/comments?page=3&size=10&sort=popular`
      )
    );

    act(() => result.current.setCommentSort('latest'));
    // 정렬을 바꾸면 3쪽에 머무르지 않는다 — 순서 축이 달라져 그 페이지 번호가 의미를 잃는다.
    await waitFor(() =>
      expect(get.mock.calls.map((c) => c[0] as string)).toContain(
        `/posts/${POST_ID}/comments?page=1&size=10&sort=latest`
      )
    );
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
    // sort는 싣지 않는다 — 대댓글 축은 루트 정렬과 무관하게 id 고정이다(ADR 0016).
    expect(repliesUrl).toBe(`/posts/${POST_ID}/comments/${rootId}/replies?size=10&cursor=r1`);
  });

  it('좋아요 후 2쪽으로 넘어가도 새 페이지가 렌더되고 낙관적 갱신이 남는다', async () => {
    // 낙관적 갱신이 리스트를 통째로 덮던 시절엔 여기서 화면이 얼어붙어 다음 페이지가
    // 영영 안 보였다. 패치를 id별로 두는 한 페이지를 갈아끼워도 서로를 덮지 않는다.
    const page = (ids: string[]) => ({
      code: 'OK',
      data: {
        items: ids.map((id) => ({ id, content: id, replies: [], likeCount: 0, isLiked: false })),
        hasMore: false,
        // 2쪽이 실제로 존재해야 한다 — total이 한 쪽 분량이면 클램프가 1쪽으로 되돌린다.
        total: 20,
      },
    });
    get.mockImplementation((url: string) => {
      if (!url.includes('/comments')) return Promise.resolve({ code: 'OK', data: { id: POST_ID } });
      return Promise.resolve(url.includes('page=2') ? page(['c3', 'c1']) : page(['c1', 'c2']));
    });
    post.mockResolvedValue({ code: 'OK', data: { likeCount: 1, isLiked: true } });

    const { result } = mountHook();
    await waitFor(() => expect(result.current.comments.length).toBe(2));
    expect(result.current.commentTotalPages).toBe(2);

    await result.current.handleCommentLike('c1');
    await waitFor(() => expect(result.current.comments[0].isLiked).toBe(true));

    act(() => result.current.setCommentPage(2));

    await waitFor(() => expect(result.current.comments.map((c) => c.id)).toEqual(['c3', 'c1']));
    // 2쪽에도 있는 c1의 낙관적 갱신은 살아 있어야 한다 — 페이지 교체가 지워선 안 된다.
    expect(result.current.comments[1].isLiked).toBe(true);
  });

  it('답글 접기는 이어받은 것만 버리고 서버 preview로 돌아간다', async () => {
    const rootId = 'root-c';
    const rootPage = {
      code: 'OK',
      data: {
        items: [
          {
            id: rootId,
            content: '루트',
            replies: [{ id: 'r1', content: '답글1', parentId: rootId }],
            replyCount: 3,
            hasMoreReplies: true,
          },
        ],
        hasMore: false,
        total: 1,
      },
    };
    get.mockImplementation((url: string) => {
      if (url.includes('/replies')) {
        return Promise.resolve({
          code: 'OK',
          data: {
            items: [
              { id: 'r2', content: '답글2', parentId: rootId },
              { id: 'r3', content: '답글3', parentId: rootId },
            ],
            hasMore: false,
          },
        });
      }
      if (url.includes('/comments')) return Promise.resolve(rootPage);
      return Promise.resolve({ code: 'OK', data: { id: POST_ID } });
    });

    const { result } = mountHook();
    await waitFor(() => expect(result.current.comments.length).toBe(1));

    await result.current.loadMoreReplies(rootId);
    await waitFor(() => expect(result.current.comments[0].replies.length).toBe(3));
    expect(result.current.expandedReplyIds.has(rootId)).toBe(true);
    expect(result.current.comments[0].hasMoreReplies).toBe(false);

    act(() => result.current.collapseReplies(rootId));

    await waitFor(() => expect(result.current.comments[0].replies.length).toBe(1));
    // 서버가 준 hasMoreReplies로 되돌아가야 "더보기"가 다시 뜬다.
    expect(result.current.comments[0].hasMoreReplies).toBe(true);
    expect(result.current.expandedReplyIds.has(rootId)).toBe(false);
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
