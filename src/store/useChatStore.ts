// 1:1 DM 메시지 목록(Zustand). 시간순 오름차순(위=과거, 아래=최신)으로 보관.
import { create } from 'zustand';

import type { ChatMessageRow } from '../api/api-types.js';
import { apiGet } from '../api/typed.js';
import { nextCursorFromPage } from '../utils/index.js';

/** 낙관적 말풍선 id 접두사 — 서버가 확정한 메시지와 구분하는 유일한 표식. */
const PENDING_ID_PREFIX = 'pending-';

/**
 * 낙관적 말풍선을 실패로 확정하기까지의 유예.
 *
 * `ws.send()` 성공은 "브라우저 버퍼에 넣었다"는 뜻일 뿐 서버 저장을 보장하지 않는다.
 * 서버 에러 프레임에는 어떤 메시지가 실패했는지 식별자가 없고, 죽어가는 소켓·발행 유실은
 * 아무 응답도 남기지 않는다 — 그래서 코드별로 대응하는 대신 **에코가 돌아왔는지**로
 * 판정한다. 이 시간이 지나도록 서버 메시지가 안 오면 실패로 표시한다.
 */
const PENDING_TIMEOUT_MS = 10_000;

// roomId → (pendingId → 타이머). 상태가 아니라 부수자원이라 스토어 밖에 둔다.
const pendingTimers = new Map<string, Map<string, ReturnType<typeof setTimeout>>>();

function clearPendingTimer(roomId: string, id: string): void {
  const byId = pendingTimers.get(roomId);
  const timer = byId?.get(id);
  if (timer == null) return;
  clearTimeout(timer);
  byId?.delete(id);
  if (byId && byId.size === 0) pendingTimers.delete(roomId);
}

function armPendingTimer(roomId: string, id: string, onExpire: () => void): void {
  let byId = pendingTimers.get(roomId);
  if (!byId) {
    byId = new Map();
    pendingTimers.set(roomId, byId);
  }
  // 이미 발화한 타이머에 clearTimeout은 무해하므로 정리 경로를 하나로 합친다.
  byId.set(
    id,
    setTimeout(() => {
      clearPendingTimer(roomId, id);
      onExpire();
    }, PENDING_TIMEOUT_MS),
  );
}

/** 이 방에 확정 대기 중인 말풍선이 있는가 — 없으면 정산 스캔 자체를 건너뛴다. */
function hasPendings(roomId: string): boolean {
  return (pendingTimers.get(roomId)?.size ?? 0) > 0;
}

export function isPendingMessageId(id: unknown): boolean {
  return String(id ?? '').startsWith(PENDING_ID_PREFIX);
}

export function newPendingMessageId(): string {
  const rand =
    globalThis.crypto?.randomUUID?.() ??
    `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
  return `${PENDING_ID_PREFIX}${rand}`;
}

export function normalizeChatMessage(raw: Record<string, unknown>): ChatMessageRow {
  return {
    id: String(raw.id ?? ''),
    roomId: String(raw.roomId ?? raw.roomid ?? ''),
    senderId: String(raw.senderId ?? raw.senderid ?? ''),
    content: String(raw.content ?? ''),
    isRead: Boolean(raw.isRead ?? raw.isread ?? false),
    createdAt: String(raw.createdAt ?? raw.createdat ?? ''),
  };
}

/**
 * 재동기가 한 번에 이어 받을 최대 페이지 수. 여기까지 왔다면 간격이 너무 커서
 * 이어붙이기보다 최신 페이지로 다시 시작하는 편이 싸다.
 */
const MAX_GAP_PAGES = 10;

/**
 * 메시지 페이지 1회 조회 — 응답 items는 방향과 무관하게 항상 최신순(DESC).
 *
 * 커서 파생은 호출부 몫이다. `nextCursorFromPage`(마지막 item = 가장 과거)는 `before`
 * 진행에만 맞고 `after`에는 틀리므로, 여기서 한 벌로 만들어 돌려주면 오답을 흘리게 된다.
 */
async function fetchMessagesPage(
  roomId: string,
  limit: number,
  cursor?: string,
  direction?: 'before' | 'after',
): Promise<{ items: unknown[]; hasMore: boolean }> {
  const res = await apiGet('/v1/chat/rooms/{room_id}/messages', {
    path: { room_id: roomId },
    query: { limit, cursor, direction },
  });
  const data = res?.data;
  return {
    items: Array.isArray(data?.items) ? data.items : [],
    hasMore: Boolean(data?.hasMore),
  };
}

/** 최신순 페이지에서 가장 새 메시지 id — `after` 진행의 다음 커서. */
function newestIdOfPage(itemsDesc: unknown[]): string {
  const head = itemsDesc[0];
  const id = head != null && typeof head === 'object' ? (head as { id?: unknown }).id : undefined;
  return id == null ? '' : String(id);
}

/** 서버가 아는 가장 최근 메시지 id — 낙관적 말풍선은 서버가 모르므로 커서로 쓸 수 없다. */
function newestConfirmedId(rows: ChatMessageRow[]): string {
  for (let i = rows.length - 1; i >= 0; i--) {
    if (!isPendingMessageId(rows[i].id)) return rows[i].id;
  }
  return '';
}

function dedupeById(list: ChatMessageRow[]): ChatMessageRow[] {
  const seen = new Set<string>();
  const out: ChatMessageRow[] = [];
  for (const m of list) {
    if (!m.id || seen.has(m.id)) continue;
    seen.add(m.id);
    out.push(m);
  }
  return out;
}

/** API는 최신순(DESC)이므로 뒤집어 오름차순으로 만든다. */
function toAscRows(itemsDesc: unknown[]): ChatMessageRow[] {
  return itemsDesc
    .filter((x): x is Record<string, unknown> => x != null && typeof x === 'object')
    .map((x) => normalizeChatMessage(x))
    .reverse();
}

/**
 * 시각→id 순 정렬. 비교자 안에서 `Date.parse`를 부르면 O(n log n)번 문자열을 다시 파싱하므로
 * 한 번만 파싱해 두고 정렬한다. 문자열 그대로 비교하면 안 된다 — 낙관적 말풍선은 `Z`,
 * 서버 행은 오프셋 표기라 표현이 섞인다.
 */
function sortByCreatedAt(list: ChatMessageRow[]): ChatMessageRow[] {
  return list
    .map((row) => ({ row, at: Date.parse(row.createdAt) || 0 }))
    .sort((a, b) => (a.at !== b.at ? a.at - b.at : String(a.row.id).localeCompare(String(b.row.id))))
    .map((d) => d.row);
}

/**
 * 서버 페이지를 기존 목록에 반영한다.
 *
 * 서버가 같은 (보낸이, 내용)을 이미 갖고 있으면 그 낙관적 말풍선은 확정된 것으로 보고
 * 실패 타이머를 해제한다 — 안 그러면 잘 도착한 메시지가 10초 뒤 실패로 뒤집힌다.
 * `keepConfirmed=false`면 기존 확정 메시지를 버리고 이 페이지로 갈아끼운다(첫 조회).
 */
function applyServerPage(
  roomId: string,
  prev: ChatMessageRow[],
  asc: ChatMessageRow[],
  keepConfirmed: boolean,
): ChatMessageRow[] {
  const merged: ChatMessageRow[] = keepConfirmed
    ? prev.filter((m) => !isPendingMessageId(m.id))
    : [];
  merged.push(...asc);
  for (const m of prev) {
    if (!isPendingMessageId(m.id)) continue;
    const settled = asc.some((s) => s.senderId === m.senderId && s.content === m.content);
    if (settled) clearPendingTimer(roomId, m.id);
    else merged.push(m);
  }
  return sortByCreatedAt(dedupeById(merged));
}

export interface ChatState {
  /** roomId → 시간순 오름차순 메시지 */
  messagesByRoom: Record<string, ChatMessageRow[]>;
  /** 다음(더 과거) 페이지 커서 — 응답 {items, hasMore}에서 마지막 item id로 파생. null=끝. */
  nextCursorByRoom: Record<string, string | null>;
  loadingOlderByRoom: Record<string, boolean>;
  loadingInitialByRoom: Record<string, boolean>;
  /** 재연결 재동기 진행 중 — 같은 방이 두 화면에 열려도 한 번만 돌게 하는 가드. */
  syncingGapByRoom: Record<string, boolean>;
}

export interface ChatActions {
  /** REST 첫/재조회: API는 최신순(DESC)이므로 내부에서 역순해 오름차순으로 저장 */
  replaceWithInitialPage: (roomId: string, itemsDesc: unknown[], nextCursor: string | null) => void;
  /** 이미 들고 있는 메시지와 커서를 보존한 채 서버 페이지를 병합(재연결 재동기용) */
  mergeServerPage: (roomId: string, itemsDesc: unknown[]) => void;
  /** 과거 페이지: API DESC 배열을 역순 후 기존 앞에 붙임 */
  prependMessages: (roomId: string, olderBatchDesc: unknown[]) => void;
  /** 실시간 수신: 맨 뒤에 추가(동일 id 중복 제거) */
  appendMessage: (roomId: string, message: ChatMessageRow) => void;
  /** 낙관적 전송: 말풍선을 먼저 그리고 실패 타이머를 건다 */
  appendPendingMessage: (roomId: string, message: ChatMessageRow) => void;
  markMessageFailed: (roomId: string, id: string) => void;
  removeMessage: (roomId: string, id: string) => void;
  fetchInitialMessages: (roomId: string, limit?: number) => Promise<void>;
  fetchOlderMessages: (roomId: string, limit?: number) => Promise<void>;
  fetchGapMessages: (roomId: string, limit?: number) => Promise<void>;
}

export const useChatStore = create<ChatState & ChatActions>((set, get) => ({
  messagesByRoom: {},
  nextCursorByRoom: {},
  loadingOlderByRoom: {},
  loadingInitialByRoom: {},
  syncingGapByRoom: {},

  replaceWithInitialPage: (roomId, itemsDesc, nextCursor) =>
    set((s) => ({
      messagesByRoom: {
        ...s.messagesByRoom,
        [roomId]: applyServerPage(roomId, s.messagesByRoom[roomId] ?? [], toAscRows(itemsDesc), false),
      },
      nextCursorByRoom: { ...s.nextCursorByRoom, [roomId]: nextCursor ?? null },
    })),

  mergeServerPage: (roomId, itemsDesc) =>
    // `replaceWithInitialPage`를 쓰면 안 된다 — 그쪽은 기존 배열을 버리고 커서를 덮어써서,
    // 무한 스크롤로 읽어둔 과거 메시지와 다음 페이지 위치가 통째로 날아간다.
    set((s) => ({
      messagesByRoom: {
        ...s.messagesByRoom,
        [roomId]: applyServerPage(roomId, s.messagesByRoom[roomId] ?? [], toAscRows(itemsDesc), true),
      },
    })),

  prependMessages: (roomId, olderBatchDesc) => {
    const olderAsc = toAscRows(olderBatchDesc);
    set((s) => {
      const prev = s.messagesByRoom[roomId] ?? [];
      return {
        messagesByRoom: { ...s.messagesByRoom, [roomId]: dedupeById([...olderAsc, ...prev]) },
      };
    });
  },

  // 실시간 수신 경로 — 들어오는 프레임마다 돈다. 대부분은 상대 메시지이고 그때는 정산할
  // 낙관적 말풍선이 아예 없으므로, 타이머 맵으로 먼저 걸러 목록 스캔을 건너뛴다.
  appendMessage: (roomId, message) => {
    const settlesPendings =
      Boolean(message.id) && !isPendingMessageId(message.id) && hasPendings(roomId);

    const settledIds: string[] = [];
    set((s) => {
      const prev = s.messagesByRoom[roomId] ?? [];
      const next: ChatMessageRow[] = [];
      let duplicate = false;
      settledIds.length = 0;
      for (const m of prev) {
        if (m.id === message.id) duplicate = true;
        // 서버가 확정한 메시지에 대응되는 말풍선은 걷어낸다.
        if (
          settlesPendings &&
          isPendingMessageId(m.id) &&
          m.senderId === message.senderId &&
          m.content === message.content &&
          m.roomId === roomId
        ) {
          settledIds.push(m.id);
          continue;
        }
        next.push(m);
      }
      if (duplicate) return s;
      next.push(message);
      return { messagesByRoom: { ...s.messagesByRoom, [roomId]: next } };
    });
    // 걷어낸 말풍선의 실패 타이머를 푼다 — 안 그러면 잘 도착한 메시지가 10초 뒤 실패로 뒤집힌다.
    for (const id of settledIds) clearPendingTimer(roomId, id);
  },

  appendPendingMessage: (roomId, message) => {
    set((s) => {
      const prev = s.messagesByRoom[roomId] ?? [];
      return {
        messagesByRoom: {
          ...s.messagesByRoom,
          [roomId]: [...prev, { ...message, deliveryStatus: 'pending' as const }],
        },
      };
    });
    armPendingTimer(roomId, message.id, () => get().markMessageFailed(roomId, message.id));
  },

  markMessageFailed: (roomId, id) =>
    set((s) => {
      const prev = s.messagesByRoom[roomId];
      if (!prev?.some((m) => m.id === id)) return s;
      return {
        messagesByRoom: {
          ...s.messagesByRoom,
          [roomId]: prev.map((m) => (m.id === id ? { ...m, deliveryStatus: 'failed' as const } : m)),
        },
      };
    }),

  removeMessage: (roomId, id) => {
    clearPendingTimer(roomId, id);
    set((s) => {
      const prev = s.messagesByRoom[roomId];
      if (!prev) return s;
      return {
        messagesByRoom: { ...s.messagesByRoom, [roomId]: prev.filter((m) => m.id !== id) },
      };
    });
  },

  fetchInitialMessages: async (roomId, limit = 30) => {
    if (!roomId) return;
    set((s) => ({
      loadingInitialByRoom: { ...s.loadingInitialByRoom, [roomId]: true },
    }));
    try {
      const { items, hasMore } = await fetchMessagesPage(roomId, limit);
      get().replaceWithInitialPage(roomId, items, nextCursorFromPage(items, hasMore));
    } finally {
      set((s) => ({
        loadingInitialByRoom: { ...s.loadingInitialByRoom, [roomId]: false },
      }));
    }
  },

  fetchOlderMessages: async (roomId, limit = 30) => {
    if (!roomId) return;
    // 인플라이트 가드는 스토어가 소유 — 훅 쪽 React 상태는 IntersectionObserver
    // 이중 발화 시점에 stale일 수 있어 동일 요청이 중복 발사된다.
    if (get().loadingOlderByRoom[roomId]) return;
    const cursor = get().nextCursorByRoom[roomId];
    if (cursor == null || cursor === '') return;
    set((s) => ({
      loadingOlderByRoom: { ...s.loadingOlderByRoom, [roomId]: true },
    }));
    try {
      const { items, hasMore } = await fetchMessagesPage(roomId, limit, cursor);
      get().prependMessages(roomId, items);
      set((s) => ({
        nextCursorByRoom: { ...s.nextCursorByRoom, [roomId]: nextCursorFromPage(items, hasMore) },
      }));
    } finally {
      set((s) => ({
        loadingOlderByRoom: { ...s.loadingOlderByRoom, [roomId]: false },
      }));
    }
  },

  /**
   * 소켓 재연결 후 재동기. 실시간은 at-most-once라 끊긴 구간의 메시지는 다시 오지 않는다 —
   * 진실은 DB이므로 **내가 가진 마지막 메시지 이후**를 오래된 것부터 이어 받아 구간을 메운다.
   *
   * 최신 N건을 다시 읽는 방식으로는 안 된다 — 끊긴 사이 N건을 넘게 쌓이면 중간이 빈 채로
   * 앞뒤만 맞아 떨어져서, 빠진 줄도 모르게 된다.
   */
  fetchGapMessages: async (roomId, limit = 50) => {
    if (!roomId) return;
    // 플로팅 창은 전역 마운트라 같은 방이 전체화면과 동시에 열릴 수 있다 — 재연결 1회에
    // 재동기가 두 벌 돌지 않도록 인플라이트 가드를 스토어가 소유한다(fetchOlderMessages와 동일).
    if (get().syncingGapByRoom[roomId]) return;
    let cursor = newestConfirmedId(get().messagesByRoom[roomId] ?? []);
    if (!cursor) {
      // 아직 아무것도 못 받은 방 — 이을 지점이 없으니 첫 페이지부터.
      await get().fetchInitialMessages(roomId);
      return;
    }
    set((s) => ({ syncingGapByRoom: { ...s.syncingGapByRoom, [roomId]: true } }));
    try {
      // 페이지마다 병합하면 그때마다 정렬 + 스토어 커밋 + 전체 리렌더가 난다 — 모아서 한 번만.
      const collected: unknown[] = [];
      let exhausted = false;
      for (let page = 0; page < MAX_GAP_PAGES && !exhausted; page++) {
        const { items, hasMore } = await fetchMessagesPage(roomId, limit, cursor, 'after');
        if (items.length === 0) break;
        collected.push(...items);
        cursor = newestIdOfPage(items);
        exhausted = !hasMore || !cursor;
      }
      if (!exhausted) {
        // 간격이 이 정도면 이어붙이기보다 최신 페이지로 다시 시작하는 편이 싸다.
        await get().fetchInitialMessages(roomId);
        return;
      }
      if (collected.length > 0) get().mergeServerPage(roomId, collected);
    } finally {
      set((s) => ({ syncingGapByRoom: { ...s.syncingGapByRoom, [roomId]: false } }));
    }
  },
}));
