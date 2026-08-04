// 알림 전역 상태: 목록·미읽음 수·토스트·SSE 중복 방지용 seen 집합.
import { create } from 'zustand';
import { apiGet, apiPatch } from '../api/typed.js';
import {
  parseNotificationListResponse,
  parseSseRealtimePayload,
  type NotificationItem,
} from '../utils/notificationParse.js';
import { appendDedupedById, nextCursorFromPage } from '../utils/cursorPage.js';

const MAX_SEEN_IDS = 200;
const MAX_TOASTS = 4;

interface Toast {
  id: string;
  message: string;
}

interface NotificationState {
  items: NotificationItem[];
  unreadCount: number;
  listLoading: boolean;
  listError: string;
  /** 다음 페이지가 남았는지(서버는 total을 주지 않는다 — CursorPage). */
  listHasMore: boolean;
  /** 다음 페이지 커서. null=끝. */
  listCursor: string | null;
  streamConnected: boolean;
  /** 최근 처리한 알림 id (탭 간·SSE 중복 억제) */
  seenNotificationIds: string[];
  toasts: Toast[];
}

interface NotificationActions {
  setStreamConnected: (v: boolean) => void;
  pushToast: (message: string) => string;
  removeToast: (id: string) => void;
  rememberSeen: (id: string) => void;
  hasSeen: (id: string) => boolean;
  fetchNotifications: (size?: number, cursor?: string) => Promise<void>;
  ingestFromStream: (payload: unknown) => void;
  markRead: (ids: string[]) => Promise<void>;
  reset: () => void;
}

function countUnread(items: NotificationItem[]): number {
  return items.filter((n) => n.readAt == null).length;
}

function kindLabel(kind: string): string {
  switch (kind) {
    case 'COMMENT_ON_POST':
      return '새 댓글';
    case 'LIKE_POST':
      return '게시글 좋아요';
    case 'LIKE_COMMENT':
      return '댓글 좋아요';
    default:
      return '알림';
  }
}

export const useNotificationStore = create<NotificationState & NotificationActions>((set, get) => ({
  items: [],
  unreadCount: 0,
  listLoading: false,
  listError: '',
  listHasMore: false,
  listCursor: null,
  streamConnected: false,
  seenNotificationIds: [],
  toasts: [],

  setStreamConnected: (v) => set({ streamConnected: Boolean(v) }),

  pushToast: (message) => {
    const id =
      typeof globalThis.crypto?.randomUUID === 'function'
        ? globalThis.crypto.randomUUID()
        : `toast-${Date.now()}`;
    set((s) => ({
      toasts: [...s.toasts, { id, message }].slice(-MAX_TOASTS),
    }));
    return id;
  },

  removeToast: (id) => {
    set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) }));
  },

  rememberSeen: (id) => {
    if (!id) return;
    set((s) => {
      const next = [...s.seenNotificationIds.filter((x) => x !== id), id].slice(-MAX_SEEN_IDS);
      return { seenNotificationIds: next };
    });
  },

  hasSeen: (id) => get().seenNotificationIds.includes(id),

  /** GET /notifications — 서버 keyset(cursor). cursor 없이 부르면 처음부터 다시 받는다.
   *
   *  이전엔 size를 12씩 키워 전체를 다시 받았는데, 상한(60)에 닿으면 같은 값이라
   *  리렌더·재조회가 일어나지 않아 61번째부터는 어떤 경로로도 볼 수 없었다.
   *  이제 커서로 이어 붙인다 — 매 클릭마다 전부 다시 받던 낭비도 사라진다. */
  fetchNotifications: async (size = 30, cursor?: string) => {
    set({ listLoading: !cursor, listError: '' });
    try {
      const res = await apiGet('/v1/notifications', { query: { size, cursor } });
      const { items, hasMore } = parseNotificationListResponse(res);
      set((s) => {
        const next = cursor ? appendDedupedById(s.items, items) : items;
        return {
          items: next,
          listHasMore: hasMore,
          listCursor: nextCursorFromPage(items, hasMore),
          unreadCount: countUnread(next),
          listLoading: false,
          listError: '',
        };
      });
    } catch (e) {
      const code = (e as { code?: unknown })?.code;
      set({
        listLoading: false,
        listError: code != null ? String(code) : 'FETCH_FAILED',
      });
    }
  },

  /** SSE 페이로드 수신: 목록 선두 병합·미읽음 증가·토스트. */
  ingestFromStream: (payload) => {
    const item = parseSseRealtimePayload(payload);
    if (!item) return;
    const { hasSeen, rememberSeen, pushToast } = get();
    if (hasSeen(item.id)) return;
    rememberSeen(item.id);

    set((s) => {
      const withoutDup = s.items.filter((x) => x.id !== item.id);
      const nextItems = [item, ...withoutDup].slice(0, 100);
      return {
        items: nextItems,
        unreadCount: s.unreadCount + 1,
      };
    });

    pushToast(`${kindLabel(item.kind)} 알림이 도착했습니다.`);
  },

  /**
   * PATCH /notifications/read — 낙관적 업데이트 후 API.
   * ids 빈 배열이면 서버 규약상 전체 읽음.
   */
  markRead: async (ids) => {
    const prevItems = get().items;
    const prevUnread = get().unreadCount;

    if (ids.length === 0) {
      set({
        items: prevItems.map((n) => ({ ...n, readAt: n.readAt ?? new Date().toISOString() })),
        unreadCount: 0,
      });
    } else {
      const idSet = new Set(ids);
      set({
        items: prevItems.map((n) =>
          idSet.has(n.id) ? { ...n, readAt: n.readAt ?? new Date().toISOString() } : n
        ),
        unreadCount: Math.max(
          0,
          prevUnread - prevItems.filter((n) => idSet.has(n.id) && n.readAt == null).length
        ),
      });
    }

    try {
      await apiPatch('/v1/notifications/read', { body: { ids } });
    } catch (e) {
      set({ items: prevItems, unreadCount: prevUnread });
      throw e;
    }
  },

  reset: () =>
    set({
      items: [],
      unreadCount: 0,
      listLoading: false,
      listError: '',
      listHasMore: false,
      listCursor: null,
      streamConnected: false,
      seenNotificationIds: [],
      toasts: [],
    }),
}));
