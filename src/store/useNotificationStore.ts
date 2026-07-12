// 알림 전역 상태: 목록·미읽음 수·토스트·SSE 중복 방지용 seen 집합.
import { create } from 'zustand';
import { api } from '../api/client.js';
import { getErrorCode } from '../api/errors.js';
import {
  parseNotificationListResponse,
  parseSseRealtimePayload,
  type NotificationItem,
} from '../utils/notificationParse.js';

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
  /** GET /notifications 응답 total */
  listTotal: number;
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
  fetchNotifications: (page?: number, size?: number) => Promise<void>;
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
  listTotal: 0,
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

  /** GET /notifications?page=1 */
  fetchNotifications: async (page = 1, size = 30) => {
    set({ listLoading: true, listError: '' });
    try {
      const res = await api.get(`/notifications?page=${page}&size=${size}`);
      const { items, total } = parseNotificationListResponse(res);
      set({
        items,
        listTotal: total,
        unreadCount: countUnread(items),
        listLoading: false,
        listError: '',
      });
    } catch (e) {
      set({
        listLoading: false,
        listError: getErrorCode(e) ?? 'FETCH_FAILED',
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
      await api.patch('/notifications/read', { ids });
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
      listTotal: 0,
      streamConnected: false,
      seenNotificationIds: [],
      toasts: [],
    }),
}));
