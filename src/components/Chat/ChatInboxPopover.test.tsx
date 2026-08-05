/**
 * 헤더 채팅 버튼 → DM 목록 팝오버 → 플로팅 채팅창까지의 열림 경로.
 *
 * 이 경로는 "배지는 뜨는데 눌러도 안 열린다"는 신고가 들어온 자리다. 팝오버를 여는 클릭이
 * 바깥 클릭 리스너에 그대로 잡혀 같은 제스처로 닫히는 사고가 알림 벨에서 한 번 있었고
 * (NotificationBell의 1틱 지연 주석), 여기는 그 방어가 없다. 눌러서 열리는지를 고정한다.
 */
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { createWrapper, ok, resetApiMock } from '../../test-utils.js';

const api = vi.hoisted(() => ({
  get: vi.fn(),
  post: vi.fn(),
  patch: vi.fn(),
  delete: vi.fn(),
}));
vi.mock('../../api/client.js', () => ({ api }));

vi.mock('../../context/AuthContext.jsx', () => ({
  useAuth: () => ({
    user: { userId: 'me', id: 'me' },
    isLoggedIn: true,
    isRestored: true,
    clearUser: vi.fn(),
  }),
}));

const { Header } = await import('../Header.js');
const { useChatUiStore } = await import('../../store/useChatUiStore.js');

const ROOM = {
  roomId: 'room-1',
  peerUserId: 'peer-1',
  peerNickname: '코코아빠',
  lastMessagePreview: '주말에 산책 가실래요?',
  unreadCount: 2,
  updatedAt: new Date().toISOString(),
};

beforeEach(() => {
  resetApiMock(api);
  api.get.mockImplementation((url: string) =>
    Promise.resolve(url.includes('/chat/rooms') ? ok({ items: [ROOM] }) : ok())
  );
  useChatUiStore.setState({ isChatInboxOpen: false, floatingRoom: null });
});

describe('헤더 채팅 버튼', () => {
  it('누르면 DM 목록 팝오버가 열린다', async () => {
    render(<Header />, { wrapper: createWrapper() });
    await waitFor(() => expect(api.get).toHaveBeenCalled());

    await userEvent.click(screen.getByRole('button', { name: '채팅' }));

    expect(await screen.findByRole('dialog', { name: '최근 대화 목록' })).toBeTruthy();
    expect(await screen.findByText('코코아빠')).toBeTruthy();
  });

  it('목록에서 방을 고르면 플로팅 채팅창 상태가 열린다', async () => {
    render(<Header />, { wrapper: createWrapper() });
    await userEvent.click(screen.getByRole('button', { name: '채팅' }));
    await screen.findByText('코코아빠');

    await userEvent.click(screen.getByText('코코아빠'));

    // 창 렌더는 App 최상단의 FloatingChatWindow 몫 — 여기서는 열림 상태만 확인한다.
    await waitFor(() =>
      expect(useChatUiStore.getState().floatingRoom?.roomId).toBe('room-1')
    );
    expect(useChatUiStore.getState().isChatInboxOpen).toBe(false);
  });
});
