/**
 * 차단 관리 화면을 실제로 렌더하고 "더 보기"를 눌러본다.
 *
 * 이 화면은 이번에 두 번 바뀌었다 — 전량 반환에서 커서 페이지네이션으로, 그리고 타입 안전
 * 클라이언트로. 타입은 통과해도 커서를 엉뚱한 값으로 넘기면 런타임에서만 드러나므로,
 * 두 번째 요청의 **실제 URL**을 확인한다.
 */
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const get = vi.fn();
const post = vi.fn().mockResolvedValue({ code: 'OK', data: null });
vi.mock('../../api/client.js', () => ({
  api: { get, post, patch: vi.fn(), delete: vi.fn() },
}));

const { BlockManagement } = await import('./BlockManagement.js');

const user = (id: string) => ({ id, nickname: `유저${id}`, profileImageUrl: null });

beforeEach(() => {
  get.mockReset();
  post.mockClear();
});

describe('BlockManagement', () => {
  it('첫 요청은 커서 없이 size만 보낸다', async () => {
    get.mockResolvedValue({ code: 'OK', data: { items: [user('a')], hasMore: false } });
    render(<BlockManagement />);

    await waitFor(() => expect(get).toHaveBeenCalled());
    expect(get.mock.calls[0][0]).toBe('/users/me/blocks?size=20');
    expect(await screen.findByText('유저a')).toBeTruthy();
  });

  it('"더 보기"를 누르면 마지막 항목 id를 커서로 이어 받는다', async () => {
    get
      .mockResolvedValueOnce({ code: 'OK', data: { items: [user('a'), user('b')], hasMore: true } })
      .mockResolvedValueOnce({ code: 'OK', data: { items: [user('c')], hasMore: false } });
    render(<BlockManagement />);

    const more = await screen.findByRole('button', { name: '더 보기' });
    await userEvent.click(more);

    await waitFor(() => expect(get).toHaveBeenCalledTimes(2));
    // 커서는 직전 페이지의 **마지막** 항목이어야 한다 — 첫 항목을 넣으면 b가 영영 안 보인다.
    expect(get.mock.calls[1][0]).toBe('/users/me/blocks?size=20&cursor=b');
    expect(await screen.findByText('유저c')).toBeTruthy();
    expect(screen.getByText('유저a')).toBeTruthy(); // 이어붙이기(교체 아님)
  });

  it('마지막 페이지면 "더 보기"가 사라진다', async () => {
    get.mockResolvedValue({ code: 'OK', data: { items: [user('a')], hasMore: false } });
    render(<BlockManagement />);

    await screen.findByText('유저a');
    expect(screen.queryByRole('button', { name: '더 보기' })).toBeNull();
  });

  it('차단 해제는 해당 유저 id로 토글 엔드포인트를 부른다', async () => {
    get.mockResolvedValue({ code: 'OK', data: { items: [user('zz')], hasMore: false } });
    render(<BlockManagement />);

    await userEvent.click(await screen.findByRole('button', { name: '차단 해제' }));

    await waitFor(() => expect(post).toHaveBeenCalled());
    expect(post.mock.calls[0][0]).toBe('/users/zz/block');
  });

  it('비어 있으면 안내 문구를 보여준다', async () => {
    get.mockResolvedValue({ code: 'OK', data: { items: [], hasMore: false } });
    render(<BlockManagement />);
    expect(await screen.findByText('차단한 유저가 없습니다.')).toBeTruthy();
  });
});
