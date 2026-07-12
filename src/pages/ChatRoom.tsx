// 1:1 채팅방: 메시지 목록·상단 무한 스크롤(스크롤 위치 유지)·하단 입력.
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useInView } from 'react-intersection-observer';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';

import type { ChatMessageRow } from '../api/api-types.js';
import { ChatInput } from '../components/Chat/ChatInput';
import { ChatMessageBubble } from '../components/Chat/ChatMessageBubble';
import { useChat } from '../components/Chat/ChatSocketProvider';
import { useAuth } from '../context/AuthContext.jsx';
import { useChatRoomPeerInfo } from '../hooks/useChatRoomPeerInfo';
import { useMarkChatRoomRead } from '../hooks/useMarkChatRoomRead';
import { useChatStore } from '../store/useChatStore.js';
import { calculateDogAge, formatDogGenderLabel } from '../utils/index.js';
import { safeImageUrl } from '../utils/index.js';
import { DEFAULT_PROFILE_IMAGE } from '../config.js';

const STICK_BOTTOM_PX = 96;

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

export function ChatRoom() {
  const navigate = useNavigate();
  const { roomId: roomIdParam } = useParams<{ roomId: string }>();
  const [searchParams] = useSearchParams();
  const roomId = useMemo(() => {
    const raw = roomIdParam ?? '';
    if (!raw) return '';
    try {
      return decodeURIComponent(raw);
    } catch {
      return raw;
    }
  }, [roomIdParam]);
  const peerUserId = searchParams.get('peer') ?? '';
  const peerProfileImageUrlFromQuery = searchParams.get('avatar') ?? '';

  const { user } = useAuth();
  const myId = user == null ? '' : String(user.userId ?? user.id ?? '').trim();
  const peerInfoQuery = useChatRoomPeerInfo(Boolean(roomId && myId), roomId);
  const peerInfo = peerInfoQuery.data;
  const peerNickname = peerInfo?.peerNickname || searchParams.get('title') || '채팅';
  const peerProfileImageUrl = peerInfo?.peerProfileImageUrl || peerProfileImageUrlFromQuery || '';
  const peerDogName = peerInfo?.peerDogName || '';
  const peerDogBreed = peerInfo?.peerDogBreed || '';
  const peerDogGender = peerInfo?.peerDogGender || '';
  const peerDogAge = calculateDogAge(peerInfo?.peerDogBirthDate || '');

  const { sendMessage, status } = useChat();

  const messagesRaw = useChatStore(
    useCallback((s) => (roomId ? (s.messagesByRoom[roomId] ?? []) : []), [roomId]),
  );
  const messages = useMemo(
    () => (Array.isArray(messagesRaw) ? messagesRaw : []),
    [messagesRaw]
  );
  const nextCursor = useChatStore(
    useCallback((s) => (roomId ? (s.nextCursorByRoom[roomId] ?? null) : null), [roomId]),
  );
  const loadingOlder = useChatStore(
    useCallback((s) => (roomId ? Boolean(s.loadingOlderByRoom[roomId]) : false), [roomId]),
  );
  const loadingInitial = useChatStore(
    useCallback((s) => (roomId ? Boolean(s.loadingInitialByRoom[roomId]) : false), [roomId]),
  );

  const fetchInitialMessages = useChatStore((s) => s.fetchInitialMessages);
  const fetchOlderMessages = useChatStore((s) => s.fetchOlderMessages);
  const appendMessage = useChatStore((s) => s.appendMessage);
  const markRoomRead = useMarkChatRoomRead();

  const scrollRef = useRef<HTMLDivElement | null>(null);
  const [scrollRoot, setScrollRoot] = useState<HTMLDivElement | null>(null);
  const setScrollContainer = useCallback((node: HTMLDivElement | null) => {
    scrollRef.current = node;
    setScrollRoot(node);
  }, []);

  const stickBottomRef = useRef(true);
  const pendingScrollRestoreRef = useRef<{ prevH: number; prevTop: number } | null>(null);
  const didInitialScrollRef = useRef(false);
  const prevLenRef = useRef(0);

  const [draft, setDraft] = useState('');
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    didInitialScrollRef.current = false;
    prevLenRef.current = 0;
    stickBottomRef.current = true;
    setLoadError(null);
    if (!roomId) return;
    void markRoomRead(roomId);
    void fetchInitialMessages(roomId).catch((err: unknown) => {
      const msg = err instanceof Error ? err.message : String(err ?? 'load_failed');
      setLoadError(msg);
      console.error('[ChatRoom] fetchInitialMessages', err);
    });
  }, [roomId, fetchInitialMessages, markRoomRead]);

  const onScroll = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    const dist = el.scrollHeight - el.scrollTop - el.clientHeight;
    stickBottomRef.current = dist < STICK_BOTTOM_PX;
  }, []);

  const tryLoadOlder = useCallback(() => {
    if (!roomId || !nextCursor || loadingOlder) return;
    const el = scrollRef.current;
    if (!el) return;
    pendingScrollRestoreRef.current = {
      prevH: el.scrollHeight,
      prevTop: el.scrollTop,
    };
    void fetchOlderMessages(roomId);
  }, [roomId, nextCursor, loadingOlder, fetchOlderMessages]);

  const { ref: topSentinelRef } = useInView({
    root: scrollRoot ?? undefined,
    rootMargin: '80px 0px 0px 0px',
    threshold: 0,
    skip: !scrollRoot,
    onChange: (inView) => {
      if (inView) tryLoadOlder();
    },
  });

  useLayoutEffect(() => {
    const el = scrollRef.current;
    if (!el || !roomId) return;

    if (pendingScrollRestoreRef.current) {
      if (loadingOlder) return;
      const snap = pendingScrollRestoreRef.current;
      pendingScrollRestoreRef.current = null;
      const newH = el.scrollHeight;
      el.scrollTop = snap.prevTop + (newH - snap.prevH);
      return;
    }

    if (messages.length === 0) {
      prevLenRef.current = 0;
      return;
    }

    const prevLen = prevLenRef.current;
    prevLenRef.current = messages.length;

    if (!didInitialScrollRef.current) {
      el.scrollTop = el.scrollHeight;
      didInitialScrollRef.current = true;
      return;
    }

    if (messages.length > prevLen && stickBottomRef.current) {
      el.scrollTop = el.scrollHeight;
    }
  }, [messages, loadingOlder, roomId]);

  const handleSend = useCallback(() => {
    const text = draft.trim();
    if (!text || !peerUserId || !roomId) return;
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

  const title = peerNickname;

  const goBack = useCallback(() => {
    navigate(-1);
  }, [navigate]);

  if (!roomId.trim()) {
    return (
      <div className="flex min-h-[100dvh] flex-col items-center justify-center gap-4 bg-[#f9fafb] px-4 text-center">
        <p className="text-sm text-gray-600">채팅방 정보가 없습니다.</p>
        <button
          type="button"
          onClick={() => navigate('/posts')}
          className="cursor-pointer rounded-lg border border-[#d1d5db] bg-white px-4 py-2 text-sm font-medium text-[#111827] hover:bg-gray-50"
        >
          게시글 목록으로
        </button>
      </div>
    );
  }

  const messageList = messages ?? [];

  return (
    <div className="flex h-[100dvh] min-h-0 flex-col bg-[#f9fafb]">
      <header className="flex shrink-0 items-center gap-2 border-b border-[#e5e7eb] bg-white px-2 py-2 pr-4 sm:px-3">
        <button
          type="button"
          onClick={goBack}
          aria-label="뒤로 가기"
          className="inline-flex h-10 w-10 shrink-0 cursor-pointer items-center justify-center rounded-lg border-0 bg-transparent p-0 text-[#1C1B1F] hover:bg-[#f3f4f6] focus-visible:outline focus-visible:outline-2 focus-visible:outline-black focus-visible:outline-offset-2"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            className="h-[22px] w-[22px]"
            aria-hidden
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <div className="min-w-0 flex-1 py-1">
          <div className="flex min-w-0 items-center gap-2">
            <div className="min-w-0 flex-1">
              <h1 className="min-w-0 truncate text-[18px] font-bold leading-tight text-[#111827]">{title}</h1>
              {peerDogName && (
                <span className="mt-1 inline-flex items-center gap-1 text-[13px] font-medium text-[#4b5563]">
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
          </div>
          {status !== 'open' && status !== 'connecting' && (
            <p className="mt-0.5 text-xs text-amber-700">
              실시간 연결 끊김 — 메시지 수신이 지연될 수 있어요.
            </p>
          )}
        </div>
      </header>

      <div
        ref={setScrollContainer}
        className="min-h-0 flex-1 overflow-y-auto px-3 py-2"
        onScroll={onScroll}
      >
        <div
          ref={topSentinelRef}
          className="pointer-events-none h-1 w-full shrink-0"
          aria-hidden
        />

        {loadError && (
          <p className="py-6 text-center text-sm text-red-600" role="alert">
            대화를 불러오지 못했습니다. {loadError}
          </p>
        )}

        {!loadingInitial && messageList.length === 0 && !loadError && (
          <p className="py-6 text-center text-sm text-gray-400">아직 메시지가 없습니다.</p>
        )}

        <ul className="m-0 list-none flex flex-col gap-2 pb-2 p-0">
          {messageList.map((m: ChatMessageRow, i: number) => {
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

                  {/* 내 메시지: 말풍선 왼쪽에 시간 */}
                  {isMine && showTime && created && (
                    <time
                      className="shrink-0 text-[11px] leading-none tabular-nums text-gray-400"
                      dateTime={m?.createdAt ?? ''}
                    >
                      {formatChatTime12h(created)}
                    </time>
                  )}

                  <ChatMessageBubble message={m} isMine={isMine} />

                  {/* 상대 메시지: 말풍선 오른쪽에 시간 */}
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
        placeholder={peerUserId ? '메시지를 입력하세요…' : 'peer 쿼리가 필요합니다 (?peer=상대방ID)'}
      />
    </div>
  );
}
