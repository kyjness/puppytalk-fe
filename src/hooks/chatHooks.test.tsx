/**
 * 채팅 관련 훅이 만드는 요청 URL 검증.
 *
 * 방 id·상대 유저 id가 서로 다른 경로에 들어가는데 둘 다 string이라 타입은 구분하지 못한다.
 */
import { renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { createWrapper, ok, resetApiMock } from '../test-utils.js';

const api = vi.hoisted(() => ({
  get: vi.fn(),
  post: vi.fn(),
  patch: vi.fn(),
  delete: vi.fn(),
}));
vi.mock('../api/client.js', () => ({ api }));
const { get, post } = api;

const { useMarkChatRoomRead } = await import('./useMarkChatRoomRead.js');
const { useChatRoomPeerInfo } = await import('./useChatRoomPeerInfo.js');
const { useRecentChatRooms } = await import('./useRecentChatRooms.js');
const { useNavigateToDirectChat } = await import('./useNavigateToDirectChat.js');

const wrapper = createWrapper({ router: false });

beforeEach(() => {
  resetApiMock(api, { items: [] });
  post.mockResolvedValue(ok({ roomId: 'room-new' }));
});

describe('useMarkChatRoomRead', () => {
  it('방 읽음 처리는 room_id 경로를 쓴다', async () => {
    const { result } = renderHook(() => useMarkChatRoomRead(), { wrapper });
    await result.current('room-3');
    expect(post.mock.calls[0][0]).toBe('/chat/rooms/room-3/read');
  });

  it('빈 roomId면 아예 요청하지 않는다', async () => {
    const { result } = renderHook(() => useMarkChatRoomRead(), { wrapper });
    await result.current('   ');
    expect(post).not.toHaveBeenCalled();
  });
});

describe('useChatRoomPeerInfo', () => {
  it('방 상세 경로를 부른다', async () => {
    get.mockResolvedValue({ code: 'OK', data: { roomId: 'r9', peerUserId: 'u1' } });
    renderHook(() => useChatRoomPeerInfo(true, 'r9'), { wrapper });
    await waitFor(() => expect(get).toHaveBeenCalled());
    expect(get.mock.calls[0][0]).toBe('/chat/rooms/r9');
  });

  it('비활성이면 요청하지 않는다', async () => {
    renderHook(() => useChatRoomPeerInfo(false, 'r9'), { wrapper });
    await new Promise((r) => setTimeout(r, 20));
    expect(get).not.toHaveBeenCalled();
  });
});

describe('useRecentChatRooms', () => {
  it('limit을 쿼리로 보낸다', async () => {
    renderHook(() => useRecentChatRooms(true, 15), { wrapper });
    await waitFor(() => expect(get).toHaveBeenCalled());
    expect(get.mock.calls[0][0]).toBe('/chat/rooms?limit=15');
  });

  it('limit은 1~50으로 조인다', async () => {
    renderHook(() => useRecentChatRooms(true, 999), { wrapper });
    await waitFor(() => expect(get).toHaveBeenCalled());
    expect(get.mock.calls[0][0]).toBe('/chat/rooms?limit=50');
  });
});

describe('useNavigateToDirectChat', () => {
  it('상대 유저 id로 방 생성 경로를 부른다 — 방 id가 아니다', async () => {
    const { result } = renderHook(() => useNavigateToDirectChat(), { wrapper });
    await result.current.go('peer-42', '상대', null);
    expect(post.mock.calls[0][0]).toBe('/chat/rooms/direct/peer-42');
  });

  it('상대 id가 비면 요청하지 않는다', async () => {
    const { result } = renderHook(() => useNavigateToDirectChat(), { wrapper });
    const ok = await result.current.go('', null, null);
    expect(ok).toBe(false);
    expect(post).not.toHaveBeenCalled();
  });
});
