import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

import type { ChatMessageRow } from '../../api/api-types.js';
import { useChat } from './ChatSocketProvider';
import { ChatInput } from './ChatInput';
import { ChatMessageBubble } from './ChatMessageBubble';
import { useAuth } from '../../context/AuthContext.jsx';
import { useMarkChatRoomRead } from '../../hooks/useMarkChatRoomRead';
import { useChatStore } from '../../store/useChatStore.js';
import { useChatUiStore } from '../../store/useChatUiStore';
import { useChatRoomPeerInfo } from '../../hooks/useChatRoomPeerInfo';
import { calculateDogAge, formatDogGenderLabel } from '../../utils/index.js';
import { safeImageUrl } from '../../utils/index.js';
import { DEFAULT_PROFILE_IMAGE } from '../../config.js';

const PORTAL_CONTAINER_ID = 'floating-chat-portal-root';
const EMPTY_MESSAGES: ChatMessageRow[] = [];

function parseDateSafe(iso: string): Date | null {
  if (!iso) return null;
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? null : d;
}

function dayKey(d: Date): string {
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
}

function formatDayDivider(d: Date): string {
  const weekday = ['일', '월', '화', '수', '목', '금', '토'][d.getDay()] ?? '';
  const y = d.getFullYear();
  const m = d.getMonth() + 1;
  const day = d.getDate();
  return `${y}년 ${m}월 ${day}일 ${weekday}요일`;
}

function formatChatTime12h(d: Date): string {
  const hours24 = d.getHours();
  const period = hours24 < 12 ? '오전' : '오후';
  const hours12 = hours24 % 12 === 0 ? 12 : hours24 % 12;
  const mm = String(d.getMinutes()).padStart(2, '0');
  return `${period} ${hours12}:${mm}`;
}

function ensurePortalContainer(): HTMLElement {
  const existing = document.getElementById(PORTAL_CONTAINER_ID);
  if (existing) return existing;
  const el = document.createElement('div');
  el.id = PORTAL_CONTAINER_ID;
  document.body.appendChild(el);
  return el;
}

export function FloatingChatWindow() {
  const floatingRoom = useChatUiStore((s) => s.floatingRoom);
  const closeFloatingRoom = useChatUiStore((s) => s.closeFloatingRoom);
  const { user } = useAuth();
  const myId = user == null ? '' : String(user.userId ?? user.id ?? '').trim();

  const { sendMessage, status } = useChat();
  const fetchInitialMessages = useChatStore((s) => s.fetchInitialMessages);
  const appendMessage = useChatStore((s) => s.appendMessage);
  const markRoomRead = useMarkChatRoomRead();

  const roomId = floatingRoom?.roomId ?? '';
  const peerUserId = floatingRoom?.peerUserId ?? '';
  const title = floatingRoom?.title ?? '채팅';
  const peerProfileImageUrl = floatingRoom?.peerProfileImageUrl ?? '';

  const peerInfoQuery = useChatRoomPeerInfo(Boolean(roomId && myId), roomId);
  const peerInfo = peerInfoQuery.data;
  const peerNickname = peerInfo?.peerNickname || title;
  const peerDogName = peerInfo?.peerDogName || '';
  const peerDogBreed = peerInfo?.peerDogBreed || '';
  const peerDogGender = peerInfo?.peerDogGender || '';
  const peerDogAge = calculateDogAge(peerInfo?.peerDogBirthDate || '');

  const messagesRaw = useChatStore(
    useCallback((s) => (roomId ? (s.messagesByRoom[roomId] ?? EMPTY_MESSAGES) : EMPTY_MESSAGES), [roomId]),
  );
  const messages = useMemo(
    () => (Array.isArray(messagesRaw) ? messagesRaw : []),
    [messagesRaw]
  );
  const loadingInitial = useChatStore(
    useCallback((s) => (roomId ? Boolean(s.loadingInitialByRoom[roomId]) : false), [roomId]),
  );

  const [draft, setDraft] = useState('');
  const [loadError, setLoadError] = useState<string | null>(null);

  const scrollRef = useRef<HTMLDivElement | null>(null);
  const stickBottomRef = useRef(true);
  const prevLenRef = useRef(0);

  const onScroll = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    const dist = el.scrollHeight - el.scrollTop - el.clientHeight;
    stickBottomRef.current = dist < 96;
  }, []);

  useEffect(() => {
    if (!roomId) return;
    void markRoomRead(roomId);
  }, [roomId, markRoomRead]);

  useEffect(() => {
    if (!roomId) return;
    setLoadError(null);
    prevLenRef.current = 0;
    stickBottomRef.current = true;
    void fetchInitialMessages(roomId).catch((err: unknown) => {
      const msg = err instanceof Error ? err.message : String(err ?? 'load_failed');
      setLoadError(msg);
      console.error('[FloatingChatWindow] fetchInitialMessages', err);
    });
  }, [roomId, fetchInitialMessages]);

  useLayoutEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    if (messages.length === 0) {
      prevLenRef.current = 0;
      return;
    }
    const prevLen = prevLenRef.current;
    prevLenRef.current = messages.length;
    if (messages.length > prevLen && stickBottomRef.current) {
      el.scrollTop = el.scrollHeight;
    }
    if (prevLen === 0) {
      el.scrollTop = el.scrollHeight;
    }
  }, [messages]);

  const handleClose = useCallback(() => {
    closeFloatingRoom();
  }, [closeFloatingRoom]);

  const handleSend = useCallback(() => {
    const text = draft.trim();
    if (!roomId || !peerUserId || !text) return;
    const ok = sendMessage(peerUserId, text);
    if (!ok) return;
    if (myId) {
      appendMessage(roomId, {
        id: `pending-${globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`}`,
        roomId,
        senderId: myId,
        content: text,
        isRead: true,
        createdAt: new Date().toISOString(),
      });
    }
    setDraft('');
    stickBottomRef.current = true;
    requestAnimationFrame(() => {
      const el = scrollRef.current;
      if (el) el.scrollTop = el.scrollHeight;
    });
  }, [appendMessage, draft, myId, peerUserId, roomId, sendMessage]);

  const portalEl = useMemo(() => {
    if (typeof document === 'undefined') return null;
    return ensurePortalContainer();
  }, []);

  useEffect(() => {
    if (!portalEl) return;
    return () => {
      // 메모리 누수 방지: 더 이상 사용하는 창이 없으면 컨테이너 제거
      // (단, 다른 Portal이 같은 id를 쓰지 않는다는 전제)
      if (portalEl.childNodes.length === 0 && portalEl.parentNode) {
        portalEl.parentNode.removeChild(portalEl);
      }
    };
  }, [portalEl]);

  const isOpen = Boolean(floatingRoom && roomId);
  if (!isOpen || !portalEl) return null;

  const messageList: ChatMessageRow[] = messages ?? [];

  return createPortal(
    <div
      className="fixed bottom-2 right-2 z-[1000] flex h-[520px] w-[372px] flex-col overflow-hidden rounded-2xl border border-[#e5e7eb] bg-white"
      role="dialog"
      aria-label="플로팅 채팅창"
    >
      <div className="flex shrink-0 items-center justify-between gap-2 border-b border-[#eef2f7] bg-white px-4 py-3">
        <div className="min-w-0">
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-[#111827]">{peerNickname}</p>
            {peerDogName && (
              <span className="mt-0.5 inline-flex items-center gap-1 text-[11px] font-medium text-[#4b5563]">
                {(() => {
                  const parts = [
                    peerDogName,
                    peerDogBreed || '',
                    peerDogGender ? formatDogGenderLabel(peerDogGender) : '',
                    peerDogAge || '',
                  ].filter(Boolean);
                  return parts.map((p, i) => (
                    <span key={i}>
                      {i > 0 && ' / '}
                      {p}
                    </span>
                  ));
                })()}
              </span>
            )}
          </div>
          {status !== 'open' && status !== 'connecting' && (
            <p className="mt-0.5 text-xs text-amber-700">실시간 연결 끊김 — 메시지 수신이 지연될 수 있어요.</p>
          )}
        </div>
        <button
          type="button"
          className="inline-flex h-9 w-9 cursor-pointer items-center justify-center rounded-lg border-0 bg-transparent text-gray-600 hover:bg-gray-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-black focus-visible:outline-offset-2"
          aria-label="채팅창 닫기"
          onClick={handleClose}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
            <path
              d="M6 6l12 12M18 6L6 18"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
            />
          </svg>
        </button>
      </div>

      <div ref={scrollRef} className="min-h-0 flex-1 overflow-y-auto px-3 py-2" onScroll={onScroll}>
        {loadError && (
          <p className="py-6 text-center text-sm text-red-600" role="alert">
            대화를 불러오지 못했습니다. {loadError}
          </p>
        )}

        {!loadingInitial && messageList.length === 0 && !loadError && (
          <p className="py-6 text-center text-sm text-gray-400">아직 메시지가 없습니다.</p>
        )}

        <ul className="m-0 list-none flex flex-col gap-2 pb-2 p-0">
          {messageList.map((m, i) => {
            const created = parseDateSafe(m?.createdAt ?? '');
            const prev = i > 0 ? messageList[i - 1] : null;
            const next = i + 1 < messageList.length ? messageList[i + 1] : null;
            const prevCreated = prev ? parseDateSafe(prev.createdAt ?? '') : null;
            const nextCreated = next ? parseDateSafe(next.createdAt ?? '') : null;

            const showDayDivider =
              created != null &&
              (prevCreated == null || dayKey(created) !== dayKey(prevCreated));

            const showTime =
              created != null &&
              (nextCreated == null ||
                Math.floor(created.getTime() / 60_000) !== Math.floor(nextCreated.getTime() / 60_000));

            const isMine = Boolean(myId && m?.senderId != null && String(m.senderId) === myId);

            return (
              <li key={m?.id != null && String(m.id) !== '' ? String(m.id) : `msg-${i}`}>
                {showDayDivider && created && (
                  <div className="my-2 flex w-full items-center justify-center">
                    <span className="rounded-full bg-[rgba(15,23,42,0.06)] px-3 py-1 text-[12px] font-semibold text-[rgba(15,23,42,0.55)]">
                      {formatDayDivider(created)}
                    </span>
                  </div>
                )}

                <div className={`flex w-full min-w-0 items-end gap-[2px] ${isMine ? 'justify-end' : 'justify-start'}`}>
                  {!isMine && (
                    <div className="mr-[2px] h-8 w-8 shrink-0 overflow-hidden rounded-full bg-[#e5e7eb]">
                      <img
                        src={safeImageUrl(peerProfileImageUrl, DEFAULT_PROFILE_IMAGE) || DEFAULT_PROFILE_IMAGE}
                        alt=""
                        className="h-full w-full object-cover"
                        loading="lazy"
                        decoding="async"
                        referrerPolicy="no-referrer"
                      />
                    </div>
                  )}

                  {isMine && showTime && created && (
                    <time
                      className="shrink-0 text-[11px] leading-none tabular-nums text-gray-400"
                      dateTime={m?.createdAt ?? ''}
                    >
                      {formatChatTime12h(created)}
                    </time>
                  )}

                  <ChatMessageBubble message={m} isMine={isMine} />

                  {!isMine && showTime && created && (
                    <time
                      className="shrink-0 text-[11px] leading-none tabular-nums text-gray-400"
                      dateTime={m?.createdAt ?? ''}
                    >
                      {formatChatTime12h(created)}
                    </time>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      </div>

      <ChatInput
        value={draft}
        onChange={setDraft}
        onSend={handleSend}
        disabled={!peerUserId || status === 'connecting'}
        placeholder={peerUserId ? '메시지를 입력하세요…' : 'peer 정보가 없습니다.'}
      />
    </div>,
    portalEl,
  );
}

