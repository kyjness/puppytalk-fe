/**
 * 플로팅 채팅창이 **화면에 실제로 붙는지**.
 *
 * "눌렀는데 채팅창이 안 뜬다"는 신고에서, 서버 쪽 흔적(방 읽음 처리)은 남았는데 창은 못 봤다는
 * 정황이 나왔다. 그 조합은 "상태와 부수효과는 열렸으나 렌더 결과가 문서에 없는" 모양이다 —
 * 이 창은 document.body에 직접 만든 컨테이너로 포털링하므로, 컨테이너가 떨어져 나가면
 * 효과는 다 돌면서 화면에는 아무것도 안 나온다. 컨테이너가 문서에 붙어 있는지까지 본다.
 */
import { render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { createWrapper, resetApiMock } from '../../test-utils.js';

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

// WebSocket 자체는 여기 관심사가 아니다 — 소켓이 노출하는 connectionEpoch만 흉내 낸다.
const socket = vi.hoisted(() => ({ epoch: 1 }));
vi.mock('./ChatSocketProvider', () => ({
  useChat: () => ({
    sendMessage: vi.fn(() => true),
    status: 'open',
    lastError: null,
    connectionEpoch: socket.epoch,
  }),
}));

const { FloatingChatWindow } = await import('./FloatingChatWindow.js');
const { useChatUiStore } = await import('../../store/useChatUiStore.js');

const PORTAL_ID = 'floating-chat-portal-root';

// 라우터는 필요 없다 — 이 창은 포털로 body에 직접 붙는다.
const wrapper = createWrapper({ router: false });

beforeEach(() => {
  resetApiMock(api, { items: [] });
  document.getElementById(PORTAL_ID)?.remove();
  useChatUiStore.setState({ isChatInboxOpen: false, floatingRoom: null });
  socket.epoch = 1;
});

/** 메시지 목록 재조회만 센다(상대 정보 조회 등 다른 GET은 제외). */
function messageFetchCount(roomId: string): number {
  return api.get.mock.calls.filter((c: unknown[]) =>
    String(c[0]).startsWith(`/chat/rooms/${roomId}/messages`),
  ).length;
}

describe('FloatingChatWindow', () => {
  it('방이 열리면 창이 문서에 붙는다', async () => {
    render(<FloatingChatWindow />, { wrapper });
    expect(screen.queryByRole('dialog', { name: '플로팅 채팅창' })).toBeNull();

    useChatUiStore.getState().openFloatingRoom({
      roomId: 'room-1',
      peerUserId: 'peer-1',
      title: '코코아빠',
    });

    const dialog = await screen.findByRole('dialog', { name: '플로팅 채팅창' });
    // 포털 컨테이너가 body에서 떨어져 나가면 효과는 돌지만 화면엔 안 보인다.
    const portal = document.getElementById(PORTAL_ID);
    expect(portal?.isConnected).toBe(true);
    expect(portal?.contains(dialog)).toBe(true);
  });

  it('닫았다 다시 열어도 창이 붙는다', async () => {
    render(<FloatingChatWindow />, { wrapper });
    const room = { roomId: 'room-1', peerUserId: 'peer-1', title: '코코아빠' };

    useChatUiStore.getState().openFloatingRoom(room);
    await screen.findByRole('dialog', { name: '플로팅 채팅창' });

    useChatUiStore.getState().closeFloatingRoom();
    await waitFor(() =>
      expect(screen.queryByRole('dialog', { name: '플로팅 채팅창' })).toBeNull()
    );

    useChatUiStore.getState().openFloatingRoom(room);
    const dialog = await screen.findByRole('dialog', { name: '플로팅 채팅창' });
    expect(document.getElementById(PORTAL_ID)?.contains(dialog)).toBe(true);
  });

  it('소켓이 다시 열리면 끊긴 구간을 DB에서 재동기한다', async () => {
    const { rerender } = render(<FloatingChatWindow />, { wrapper });
    useChatUiStore.getState().openFloatingRoom({
      roomId: 'room-9',
      peerUserId: 'peer-9',
      title: '코코아빠',
    });
    await screen.findByRole('dialog', { name: '플로팅 채팅창' });
    await waitFor(() => expect(messageFetchCount('room-9')).toBe(1));

    // 재연결 = epoch 증가. 실시간은 at-most-once라 끊긴 사이 메시지는 다시 오지 않는다 —
    // 이 재조회가 없으면 유실분이 화면에 영영 나타나지 않는다.
    socket.epoch = 2;
    rerender(<FloatingChatWindow />);
    await waitFor(() => expect(messageFetchCount('room-9')).toBe(2));
  });

  it('연결이 그대로면 리렌더만으로 재조회하지 않는다', async () => {
    const { rerender } = render(<FloatingChatWindow />, { wrapper });
    useChatUiStore.getState().openFloatingRoom({
      roomId: 'room-8',
      peerUserId: 'peer-8',
      title: '코코아빠',
    });
    await screen.findByRole('dialog', { name: '플로팅 채팅창' });
    await waitFor(() => expect(messageFetchCount('room-8')).toBe(1));

    rerender(<FloatingChatWindow />);
    rerender(<FloatingChatWindow />);
    expect(messageFetchCount('room-8')).toBe(1);
  });
});
