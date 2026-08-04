/**
 * 피드·트렌딩 요청이 만드는 실제 URL 검증.
 *
 * 타입은 "size라는 파라미터가 있다"까지만 보증한다 — size 자리에 cursor를 넣어도 타입은
 * 통과한다. 전송 계층을 목킹해 **최종 URL 문자열**을 고정하는 것이 그 구멍을 메운다.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

const get = vi.fn().mockResolvedValue({ code: 'OK', data: null });
vi.mock('./client.js', () => ({ api: { get, post: vi.fn(), patch: vi.fn(), delete: vi.fn() } }));

const { fetchPostsFeedPage, fetchTrendingPosts } = await import('./posts.js');

beforeEach(() => get.mockClear());

describe('fetchPostsFeedPage', () => {
  it('빈 검색어·카테고리 전체·커서 없음이면 size만 보낸다', async () => {
    await fetchPostsFeedPage({ cursor: undefined, q: '', categoryId: 'all', size: 20 });
    expect(get).toHaveBeenCalledWith('/posts?size=20');
  });

  it('검색어·카테고리·커서를 각자 제자리에 넣는다', async () => {
    await fetchPostsFeedPage({ cursor: 'cur1', q: ' 강아지 ', categoryId: 3, size: 10 });
    const url = get.mock.calls[0][0] as string;
    const params = new URLSearchParams(url.split('?')[1]);
    expect(url.startsWith('/posts?')).toBe(true);
    expect(params.get('size')).toBe('10');
    expect(params.get('q')).toBe('강아지'); // 앞뒤 공백 제거
    expect(params.get('category_id')).toBe('3');
    expect(params.get('cursor')).toBe('cur1');
  });

  it("categoryId가 'all'이면 category_id를 보내지 않는다", async () => {
    await fetchPostsFeedPage({ cursor: undefined, q: null, categoryId: 'all', size: 5 });
    expect(get.mock.calls[0][0]).not.toContain('category_id');
  });
});

describe('fetchTrendingPosts', () => {
  it('파라미터 없이 트렌딩 경로를 부른다', async () => {
    await fetchTrendingPosts();
    expect(get).toHaveBeenCalledWith('/posts/trending');
  });
});
