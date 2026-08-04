/**
 * 나머지 컴포넌트가 만드는 요청 검증(신고·멍태그).
 *
 * 신고는 대상 종류·사유가 서버 enum이라 값이 어긋나면 422다 — 화면에서 고른 값이
 * 그대로 실려 나가는지 눌러서 확인한다.
 */
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ReactNode } from 'react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { resetApiMock } from '../test-utils.js';

const api = vi.hoisted(() => ({
  get: vi.fn(),
  post: vi.fn(),
  patch: vi.fn(),
  delete: vi.fn(),
}));
vi.mock('../api/client.js', () => ({ api }));
const { get, post } = api;

const { ReportModal } = await import('./PostDetail/ReportModal.js');
const { TrendingHashtags } = await import('./TrendingHashtags.js');

const wrap = (ui: ReactNode) => render(<MemoryRouter>{ui}</MemoryRouter>);

beforeEach(() => resetApiMock(api, []));

describe('ReportModal', () => {
  it('선택한 대상·사유를 그대로 실어 보낸다', async () => {
    wrap(
      <ReportModal open targetType="COMMENT" targetId="c-7" onClose={vi.fn()} onSuccess={vi.fn()} />
    );

    await userEvent.click(screen.getByRole('radio', { name: '욕설' }));
    await userEvent.click(screen.getByRole('button', { name: /신고/ }));

    await waitFor(() => expect(post).toHaveBeenCalled());
    expect(post.mock.calls[0][0]).toBe('/reports');
    expect(post.mock.calls[0][1]).toEqual({
      targetType: 'COMMENT',
      targetId: 'c-7',
      reason: '욕설',
    });
  });

  it('게시글 신고는 targetType이 POST다', async () => {
    wrap(<ReportModal open targetType="POST" targetId="p-3" onClose={vi.fn()} />);
    await userEvent.click(screen.getByRole('button', { name: /신고/ }));
    await waitFor(() => expect(post).toHaveBeenCalled());
    expect((post.mock.calls[0][1] as { targetType: string }).targetType).toBe('POST');
  });

  it('대상이 없으면 요청하지 않는다', async () => {
    wrap(<ReportModal open targetType={null} targetId={null} onClose={vi.fn()} />);
    const btn = screen.queryByRole('button', { name: /신고/ });
    if (btn) await userEvent.click(btn);
    expect(post).not.toHaveBeenCalled();
  });
});

describe('TrendingHashtags', () => {
  it('트렌딩 해시태그 경로를 부른다', async () => {
    get.mockResolvedValue({ code: 'OK', data: [{ name: '산책', count: 5 }] });
    wrap(<TrendingHashtags />);
    await waitFor(() => expect(get).toHaveBeenCalled());
    expect(get.mock.calls[0][0]).toBe('/posts/trending-hashtags');
  });

  it('받은 태그를 화면에 보여준다', async () => {
    get.mockResolvedValue({
      code: 'OK',
      data: [
        { name: '산책', count: 5 },
        { name: '간식', count: 3 },
      ],
    });
    wrap(<TrendingHashtags />);
    expect(await screen.findByText(/산책/)).toBeTruthy();
    expect(await screen.findByText(/간식/)).toBeTruthy();
  });
});
