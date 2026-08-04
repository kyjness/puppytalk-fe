/**
 * 관리자 대시보드를 실제로 렌더하고 액션 버튼을 눌러본다.
 *
 * 이 파일에만 호출부가 11곳이고, 게시글·댓글·유저 경로가 서로 다른데 id는 전부 string이라
 * 타입이 구분하지 못한다. 버튼을 눌러 **실제로 나가는 URL**을 고정한다.
 *
 * 신고 피드는 의도적으로 offset 기반이다(ADR 0012) — 커서가 아니라 page를 보내는 게 정상이며,
 * 그 점도 함께 고정한다.
 */
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ReactNode } from 'react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const get = vi.fn();
const patch = vi.fn().mockResolvedValue({ code: 'OK', data: null });
const del = vi.fn().mockResolvedValue({ code: 'OK', data: null });

vi.mock('../api/client.js', () => ({
  api: { get, post: vi.fn(), patch, delete: del },
  getStoredAccessToken: () => 'tok',
}));
vi.mock('../context/AuthContext.jsx', () => ({
  useAuth: () => ({ user: { userId: 'admin', role: 'ADMIN' }, setUser: vi.fn(), isLoggedIn: true }),
}));
// 헤더는 알림 벨·검색 등 곁가지를 끌고 온다 — 이 테스트의 관심사가 아니다.
// 단, 페이지 본문이 Header의 children으로 들어가므로 반드시 children을 렌더해야 한다.
vi.mock('../components/Header.jsx', () => ({
  Header: ({ children }: { children?: ReactNode }) => <div>{children}</div>,
}));

const { AdminDashboard } = await import('./AdminDashboard.js');

const postRow = (over: Record<string, unknown> = {}) => ({
  id: 'p-1',
  targetType: 'POST',
  title: '신고된 글',
  reportCount: 3,
  isBlinded: false,
  userId: 'u-1',
  authorStatus: 'ACTIVE',
  createdAt: '2026-01-01T00:00:00Z',
  ...over,
});

const commentRow = (over: Record<string, unknown> = {}) => ({
  id: 'c-1',
  targetType: 'COMMENT',
  title: '호스트 글',
  postId: 'p-9',
  reportCount: 2,
  isBlinded: false,
  userId: 'u-2',
  authorStatus: 'ACTIVE',
  createdAt: '2026-01-01T00:00:00Z',
  ...over,
});

function renderPage() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const wrapper = ({ children }: { children: ReactNode }) => (
    <MemoryRouter>
      <QueryClientProvider client={qc}>{children}</QueryClientProvider>
    </MemoryRouter>
  );
  return render(<AdminDashboard />, { wrapper });
}

/** 액션 버튼은 details 드롭다운 안에 있다 — 닫혀 있으면 접근성 트리에 없다. */
async function openActionMenu() {
  await userEvent.click(await screen.findByText('관리 메뉴'));
}

function mockFeed(items: unknown[]) {
  get.mockResolvedValue({ code: 'OK', data: { items, total: items.length } });
}

beforeEach(() => {
  get.mockReset();
  patch.mockClear();
  del.mockClear();
  vi.stubGlobal('confirm', vi.fn().mockReturnValue(true));
  vi.stubGlobal('alert', vi.fn());
});

describe('AdminDashboard 신고 피드', () => {
  it('offset 기반이라 page·size를 보낸다(ADR 0012의 의도적 예외)', async () => {
    mockFeed([]);
    renderPage();
    await waitFor(() => expect(get).toHaveBeenCalled());
    expect(get.mock.calls[0][0]).toMatch(/^\/admin\/reported-posts\?/);
    const params = new URLSearchParams((get.mock.calls[0][0] as string).split('?')[1]);
    expect(params.get('page')).toBe('1');
    expect(params.get('size')).toBeTruthy();
  });
});

describe('AdminDashboard 게시글 액션', () => {
  it('블라인드 처리는 게시글 경로를 쓴다', async () => {
    mockFeed([postRow()]);
    renderPage();
    await openActionMenu();
    await userEvent.click(await screen.findByRole('button', { name: '블라인드 처리' }));
    await waitFor(() => expect(patch).toHaveBeenCalled());
    expect(patch.mock.calls[0][0]).toBe('/admin/posts/p-1/blind');
  });

  it('블라인드 해제는 해제 경로를 쓴다', async () => {
    mockFeed([postRow({ isBlinded: true })]);
    renderPage();
    await openActionMenu();
    await userEvent.click(await screen.findByRole('button', { name: '블라인드 해제' }));
    await waitFor(() => expect(patch).toHaveBeenCalled());
    expect(patch.mock.calls[0][0]).toBe('/admin/posts/p-1/unblind');
  });

  it('게시글 삭제는 게시글 id로 지운다', async () => {
    mockFeed([postRow()]);
    renderPage();
    await openActionMenu();
    await userEvent.click(await screen.findByRole('button', { name: '글 삭제' }));
    await waitFor(() => expect(del).toHaveBeenCalled());
    expect(del.mock.calls[0][0]).toBe('/admin/posts/p-1');
  });

  it('신고 리셋은 리셋 경로를 쓴다', async () => {
    mockFeed([postRow()]);
    renderPage();
    await openActionMenu();
    await userEvent.click(await screen.findByRole('button', { name: '신고 무시' }));
    await waitFor(() => expect(patch).toHaveBeenCalled());
    expect(patch.mock.calls[0][0]).toBe('/admin/posts/p-1/reset-reports');
  });
});

describe('AdminDashboard 댓글 액션', () => {
  it('댓글 블라인드는 댓글 경로를 쓴다 — 게시글 경로와 섞이면 안 된다', async () => {
    mockFeed([commentRow()]);
    renderPage();
    await openActionMenu();
    await userEvent.click(await screen.findByRole('button', { name: '블라인드 처리' }));
    await waitFor(() => expect(patch).toHaveBeenCalled());
    expect(patch.mock.calls[0][0]).toBe('/admin/comments/c-1/blind');
  });

  it('댓글 삭제는 호스트 글 id와 댓글 id를 제자리에 넣는다', async () => {
    mockFeed([commentRow()]);
    renderPage();
    await openActionMenu();
    await userEvent.click(await screen.findByRole('button', { name: '댓글 삭제' }));
    await waitFor(() => expect(del).toHaveBeenCalled());
    // 순서가 뒤바뀌면 /admin/posts/c-1/comments/p-9 가 된다 — 타입은 통과한다.
    expect(del.mock.calls[0][0]).toBe('/admin/posts/p-9/comments/c-1');
  });

  it('댓글 신고 리셋은 댓글 경로를 쓴다', async () => {
    mockFeed([commentRow()]);
    renderPage();
    await openActionMenu();
    await userEvent.click(await screen.findByRole('button', { name: '신고 무시' }));
    await waitFor(() => expect(patch).toHaveBeenCalled());
    expect(patch.mock.calls[0][0]).toBe('/admin/comments/c-1/reset-reports');
  });
});

describe('AdminDashboard 유저 액션', () => {
  it('정지는 유저 경로를 쓴다', async () => {
    mockFeed([postRow()]);
    renderPage();
    await openActionMenu();
    await userEvent.click(await screen.findByRole('button', { name: '유저 정지' }));
    await waitFor(() => expect(patch).toHaveBeenCalled());
    expect(patch.mock.calls[0][0]).toBe('/admin/users/u-1/suspend');
  });

  it('정지 해제는 해제 경로를 쓴다', async () => {
    mockFeed([postRow({ authorStatus: 'SUSPENDED' })]);
    renderPage();
    await openActionMenu();
    await userEvent.click(await screen.findByRole('button', { name: '정지 해제' }));
    await waitFor(() => expect(patch).toHaveBeenCalled());
    expect(patch.mock.calls[0][0]).toBe('/admin/users/u-1/activate');
  });

  it('작성자 id가 없으면 요청하지 않는다 — undefined가 URL에 들어가면 안 된다', async () => {
    mockFeed([postRow({ userId: undefined })]);
    renderPage();
    await openActionMenu();
    const btn = screen.queryByRole('button', { name: '유저 정지' });
    if (btn) {
      await userEvent.click(btn);
      await new Promise((r) => setTimeout(r, 20));
    }
    expect(patch.mock.calls.every((c) => !String(c[0]).includes('undefined'))).toBe(true);
  });
});
