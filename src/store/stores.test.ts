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

/** 채팅 메시지 1건 — id를 내용으로 겸해 어떤 행이 살아남았는지 바로 읽힌다. */
function row(roomId: string, id: string, createdAt: string) {
  return { id, roomId, senderId: 'u', content: id, createdAt };
}

/** 마지막으로 나간 GET URL — 재동기는 여러 페이지를 도니 인덱스로 세기 번거롭다. */
function lastGetUrl(): string {
  const calls = get.mock.calls;
  return String(calls[calls.length - 1]?.[0] ?? '');
}

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

  it('재연결 재동기는 읽어둔 과거 메시지와 다음 커서를 보존한다', async () => {
    get.mockResolvedValueOnce({
      code: 'OK',
      data: { items: [row('r2', 'm3', '2026-01-03T00:00:00Z'), row('r2', 'm2', '2026-01-02T00:00:00Z')], hasMore: true },
    });
    await useChatStore.getState().fetchInitialMessages('r2', 2);

    get.mockResolvedValueOnce({ code: 'OK', data: { items: [row('r2', 'm1', '2026-01-01T00:00:00Z')], hasMore: true } });
    await useChatStore.getState().fetchOlderMessages('r2', 2);
    expect(useChatStore.getState().messagesByRoom.r2.map((m) => m.id)).toEqual(['m1', 'm2', 'm3']);
    expect(useChatStore.getState().nextCursorByRoom.r2).toBe('m1');

    // 끊긴 사이 도착한 m4를 "m3 이후"로 이어 받는다.
    get.mockResolvedValueOnce({ code: 'OK', data: { items: [row('r2', 'm4', '2026-01-04T00:00:00Z')], hasMore: false } });
    await useChatStore.getState().fetchGapMessages('r2', 2);

    expect(lastGetUrl()).toBe('/chat/rooms/r2/messages?limit=2&cursor=m3&direction=after');
    // 무한 스크롤로 읽어둔 m1이 살아 있고, 다음 페이지 위치도 그대로여야 한다 —
    // replaceWithInitialPage를 재사용하면 둘 다 날아간다.
    expect(useChatStore.getState().messagesByRoom.r2.map((m) => m.id)).toEqual([
      'm1',
      'm2',
      'm3',
      'm4',
    ]);
    expect(useChatStore.getState().nextCursorByRoom.r2).toBe('m1');
  });

  it('끊긴 구간이 한 페이지를 넘으면 이어서 마저 받는다', async () => {
    get.mockResolvedValueOnce({ code: 'OK', data: { items: [row('r5', 'n1', '2026-02-01T00:00:00Z')], hasMore: false } });
    await useChatStore.getState().fetchInitialMessages('r5', 2);

    // 1페이지(오래된 쪽부터 n2·n3, 응답은 최신순) + 더 남음 → 2페이지에서 n4.
    get.mockResolvedValueOnce({
      code: 'OK',
      data: { items: [row('r5', 'n3', '2026-02-03T00:00:00Z'), row('r5', 'n2', '2026-02-02T00:00:00Z')], hasMore: true },
    });
    get.mockResolvedValueOnce({ code: 'OK', data: { items: [row('r5', 'n4', '2026-02-04T00:00:00Z')], hasMore: false } });
    await useChatStore.getState().fetchGapMessages('r5', 2);

    // 최신 N건만 다시 읽는 방식이면 n2가 통째로 빠진 채 앞뒤만 맞아떨어진다.
    expect(useChatStore.getState().messagesByRoom.r5.map((m) => m.id)).toEqual([
      'n1',
      'n2',
      'n3',
      'n4',
    ]);
    expect(lastGetUrl()).toBe('/chat/rooms/r5/messages?limit=2&cursor=n3&direction=after');
  });

  it('에코가 안 오면 낙관적 말풍선은 실패로 뒤집힌다', () => {
    vi.useFakeTimers();
    try {
      useChatStore.getState().appendPendingMessage('r3', {
        id: 'pending-a',
        roomId: 'r3',
        senderId: 'me',
        content: 'hi',
        isRead: true,
        createdAt: '2026-01-01T00:00:00Z',
      });
      expect(useChatStore.getState().messagesByRoom.r3[0].deliveryStatus).toBe('pending');

      vi.advanceTimersByTime(10_000);
      // ws.send() 성공은 서버 저장을 보장하지 않는다 — 확정 증거가 없으면 실패로 보여야 한다.
      expect(useChatStore.getState().messagesByRoom.r3[0].deliveryStatus).toBe('failed');
    } finally {
      vi.useRealTimers();
    }
  });

  it('서버 에코가 오면 말풍선이 확정되고 실패 타이머가 풀린다', () => {
    vi.useFakeTimers();
    try {
      useChatStore.getState().appendPendingMessage('r4', {
        id: 'pending-b',
        roomId: 'r4',
        senderId: 'me',
        content: 'hi',
        isRead: true,
        createdAt: '2026-01-01T00:00:00Z',
      });
      useChatStore.getState().appendMessage('r4', {
        id: 'srv-1',
        roomId: 'r4',
        senderId: 'me',
        content: 'hi',
        isRead: false,
        createdAt: '2026-01-01T00:00:01Z',
      });

      vi.advanceTimersByTime(30_000);
      const rows = useChatStore.getState().messagesByRoom.r4;
      // 타이머가 안 풀리면 잘 도착한 메시지가 10초 뒤 실패로 뒤집힌다.
      expect(rows.map((m) => m.id)).toEqual(['srv-1']);
      expect(rows[0].deliveryStatus).toBeUndefined();
    } finally {
      vi.useRealTimers();
    }
  });
});

describe('usePostStore', () => {
  it('게시글 로드는 상세 경로를 부른다', async () => {
    get.mockResolvedValue({ code: 'OK', data: { id: 'p1', title: 't', content: 'c' } });
    await usePostStore.getState().loadPost('p1');
    expect(get).toHaveBeenCalledWith('/posts/p1');
  });
});
