// 알림 API·SSE 페이로드 파싱 (ApiResponse { code, data, message } / data.items).

export interface NotificationItem {
  id: string;
  kind: string;
  actorId: string | null;
  postId: string | null;
  commentId: string | null;
  readAt: string | null;
  createdAt: string | null;
}

export interface ApiEnvelope {
  code?: string;
  data?: unknown;
  message?: string | null;
  requestId?: string;
}

export interface NotificationListResult {
  items: NotificationItem[];
  hasMore: boolean;
  total: number;
  code?: string;
  requestId?: string;
}

export function parseApiEnvelope(res: unknown): ApiEnvelope | null {
  if (res == null || typeof res !== 'object') return null;
  const o = res as Record<string, unknown>;
  const data = 'data' in o ? o.data : res;
  const code = typeof o.code === 'string' ? o.code : undefined;
  const message = o.message == null ? null : String(o.message);
  const requestId =
    typeof o.requestId === 'string'
      ? o.requestId
      : typeof o.request_id === 'string'
        ? o.request_id
        : undefined;
  return { code, data, message, requestId };
}

export function normalizeNotificationItem(raw: unknown): NotificationItem | null {
  if (raw == null || typeof raw !== 'object') return null;
  const o = raw as Record<string, unknown>;
  const id =
    o.id != null
      ? String(o.id)
      : o.notificationId != null
        ? String(o.notificationId)
        : o.notification_id != null
          ? String(o.notification_id)
          : '';
  if (!id) return null;
  const kind = o.kind != null ? String(o.kind) : '';
  const actorId = o.actorId != null ? String(o.actorId) : o.actor_id != null ? String(o.actor_id) : null;
  const postId = o.postId != null ? String(o.postId) : o.post_id != null ? String(o.post_id) : null;
  const commentId =
    o.commentId != null ? String(o.commentId) : o.comment_id != null ? String(o.comment_id) : null;
  const readAt =
    o.readAt != null ? String(o.readAt) : o.read_at != null ? String(o.read_at) : null;
  const createdAt =
    o.createdAt != null ? String(o.createdAt) : o.created_at != null ? String(o.created_at) : null;
  return {
    id,
    kind,
    actorId,
    postId,
    commentId,
    readAt,
    createdAt,
  };
}

/** GET /notifications 목록 응답에서 items·페이지 정보 추출. */
export function parseNotificationListResponse(res: unknown): NotificationListResult {
  const env = parseApiEnvelope(res);

  let page: unknown = undefined;
  if (env?.data != null && typeof env.data === 'object') {
    page = env.data;
  } else if (res != null && typeof res === 'object') {
    page = res;
  }

  if (page != null && typeof page === 'object' && !Array.isArray(page)) {
    const bag = page as Record<string, unknown>;
    const hasTopItems = Array.isArray(bag.items);
    if (!hasTopItems && bag.data != null && typeof bag.data === 'object') {
      const inner = bag.data as Record<string, unknown>;
      if (Array.isArray(inner.items) || Array.isArray(inner)) {
        page = bag.data;
      }
    }
  }

  let rawItems: unknown[] = [];
  let hasMore = false;
  let total = 0;

  if (Array.isArray(page)) {
    rawItems = page;
  } else if (page != null && typeof page === 'object') {
    const bag = page as Record<string, unknown>;
    const list = bag.items ?? bag.Items;
    rawItems = Array.isArray(list) ? list : [];
    hasMore = Boolean(bag.hasMore);
    const t = bag.total ?? bag.Total;
    total = typeof t === 'number' && Number.isFinite(t) ? t : 0;
  }

  const items = rawItems
    .map(normalizeNotificationItem)
    .filter((it): it is NotificationItem => it !== null);
  return { items, hasMore, total, code: env?.code, requestId: env?.requestId };
}

/** SSE `data:` JSON (실시간 페이로드) → 스토어 아이템으로 병합용. */
export function parseSseRealtimePayload(raw: unknown): NotificationItem | null {
  if (raw == null || typeof raw !== 'object') return null;
  const o = raw as Record<string, unknown>;
  const nid =
    o.notificationId != null
      ? String(o.notificationId)
      : o.notification_id != null
        ? String(o.notification_id)
        : o.id != null
          ? String(o.id)
          : '';
  if (!nid) return null;
  const kind = o.kind != null ? String(o.kind) : '';
  const actorId = o.actorId != null ? String(o.actorId) : o.actor_id != null ? String(o.actor_id) : null;
  const postId = o.postId != null ? String(o.postId) : o.post_id != null ? String(o.post_id) : null;
  const commentId =
    o.commentId != null ? String(o.commentId) : o.comment_id != null ? String(o.comment_id) : null;
  const createdAt = new Date().toISOString();
  return {
    id: nid,
    kind,
    actorId,
    postId,
    commentId,
    readAt: null,
    createdAt,
  };
}
