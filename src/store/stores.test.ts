/**
 * 스토어가 만드는 요청 URL·본문 검증.
 *
 * 타입은 파라미터 이름까지만 보증한다 — roomId 자리에 messageId를 넣어도 통과한다.
 * 여기서 최종 URL을 고정해 그 구멍을 메운다.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { resetApiMock } from '../test-utils.js';

const api = vi.hoisted(() => ({
  get: vi.fn(),
  post: vi.fn(),
  patch: vi.fn(),
  delete: vi.fn(),
}));
vi.mock('../api/client.js', () => ({ api }));
const { get, patch } = api;

const { useNotificationStore } = await import('./useNotificationStore.js');
const { useChatStore } = await import('./useChatStore.js');
const { usePostStore } = await import('./usePostStore.js');

beforeEach(() => resetApiMock(api));

describe('useNotificationStore', () => {
  it('목록은 size만 보낸다 — 서버가 무시하는 page를 붙이지 않는다', async () => {
    get.mockResolvedValue({ code: 'OK', data: { items: [], hasMore: false } });
    await useNotificationStore.getState().fetchNotifications(12);
    expect(get).toHaveBeenCalledWith('/notifications?size=12');
  });

  it('응답의 hasMore를 그대로 상태에 싣는다 — 더보기 노출의 유일한 근거다', async () => {
    get.mockResolvedValue({ code: 'OK', data: { items: [], hasMore: true } });
    await useNotificationStore.getState().fetchNotifications(6);
    expect(useNotificationStore.getState().listHasMore).toBe(true);
  });

  it('읽음 처리는 ids를 본문에 싣는다', async () => {
    await useNotificationStore.getState().markRead(['n1', 'n2']);
    expect(patch).toHaveBeenCalledWith('/notifications/read', { ids: ['n1', 'n2'] });
  });
});

describe('useChatStore', () => {
  it('첫 페이지는 limit만, 커서는 붙이지 않는다', async () => {
    get.mockResolvedValue({ code: 'OK', data: { items: [], hasMore: false } });
    await useChatStore.getState().fetchInitialMessages('room-7', 25);
    expect(get).toHaveBeenCalledWith('/chat/rooms/room-7/messages?limit=25');
  });

  it('roomId를 URL 인코딩한다', async () => {
    get.mockResolvedValue({ code: 'OK', data: { items: [], hasMore: false } });
    await useChatStore.getState().fetchInitialMessages('a/b', 10);
    expect(get).toHaveBeenCalledWith('/chat/rooms/a%2Fb/messages?limit=10');
  });

  it('더 과거를 받을 때 직전 페이지의 커서를 쓴다', async () => {
    get.mockResolvedValueOnce({
      code: 'OK',
      data: {
        items: [
          { id: 'm2', roomId: 'r1', senderId: 'u', content: 'b', createdAt: '2026-01-02' },
          { id: 'm1', roomId: 'r1', senderId: 'u', content: 'a', createdAt: '2026-01-01' },
        ],
        hasMore: true,
      },
    });
    await useChatStore.getState().fetchInitialMessages('r1', 2);
    get.mockResolvedValueOnce({ code: 'OK', data: { items: [], hasMore: false } });
    await useChatStore.getState().fetchOlderMessages('r1', 2);

    expect(get.mock.calls[1][0]).toBe('/chat/rooms/r1/messages?limit=2&cursor=m1');
  });
});

describe('usePostStore', () => {
  it('게시글 로드는 상세 경로를 부른다', async () => {
    get.mockResolvedValue({ code: 'OK', data: { id: 'p1', title: 't', content: 'c' } });
    await usePostStore.getState().loadPost('p1');
    expect(get).toHaveBeenCalledWith('/posts/p1');
  });
});
