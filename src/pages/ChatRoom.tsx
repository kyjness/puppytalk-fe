// 1:1 채팅방(전체화면): 상단 무한 스크롤(위치 유지)·하단 입력.
// 메시지 렌더링·데이터 로드·전송은 ChatMessageList / useChatRoomSession이 소유하고,
// 하단 고정 스크롤은 useStickToBottom이 소유한다. 여기 남는 건 레이아웃과
// **이 화면에만 있는** 과거 페이지 위치 복원이다.
import { useCallback, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useInView } from 'react-intersection-observer';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';

import { ChatInput } from '../components/Chat/ChatInput';
import { ChatMessageList } from '../components/Chat/ChatMessageList';
import { ChatPeerDogMeta } from '../components/Chat/ChatPeerDogMeta';
import { useChatRoomSession } from '../hooks/useChatRoomSession';
import { useStickToBottom } from '../hooks/useStickToBottom';
import { useChatStore } from '../store/useChatStore.js';

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

  const {
    myId,
    status,
    peerInfo,
    peerDog,
    messages,
    loadingInitial,
    loadError,
    draft,
    setDraft,
    sendDraft,
  } = useChatRoomSession(roomId, peerUserId);

  const peerNickname = peerInfo?.peerNickname || searchParams.get('title') || '채팅';
  const peerProfileImageUrl = peerInfo?.peerProfileImageUrl || peerProfileImageUrlFromQuery || '';

  // 무한 스크롤은 이 화면 전용이라 스토어에서 직접 읽는다.
  const nextCursor = useChatStore(
    useCallback((s) => s.nextCursorByRoom[roomId] ?? null, [roomId]),
  );
  const loadingOlder = useChatStore(
    useCallback((s) => Boolean(s.loadingOlderByRoom[roomId]), [roomId]),
  );
  const fetchOlderMessages = useChatStore((s) => s.fetchOlderMessages);

  const scrollRef = useRef<HTMLDivElement | null>(null);
  const [scrollRoot, setScrollRoot] = useState<HTMLDivElement | null>(null);
  const setScrollContainer = useCallback((node: HTMLDivElement | null) => {
    scrollRef.current = node;
    setScrollRoot(node);
  }, []);

  const { onScroll, scrollToBottom, skipNextAutoScrollRef } = useStickToBottom(
    scrollRef,
    messages.length,
    roomId,
  );

  const pendingScrollRestoreRef = useRef<{ prevH: number; prevTop: number } | null>(null);

  const tryLoadOlder = useCallback(() => {
    if (!roomId || !nextCursor || loadingOlder) return;
    const el = scrollRef.current;
    if (!el) return;
    pendingScrollRestoreRef.current = { prevH: el.scrollHeight, prevTop: el.scrollTop };
    // 과거가 앞에 붙는 동안은 하단 고정이 끼어들면 안 된다 — 복원은 아래 effect가 한다.
    skipNextAutoScrollRef.current = true;
    void fetchOlderMessages(roomId);
  }, [roomId, nextCursor, loadingOlder, fetchOlderMessages, skipNextAutoScrollRef]);

  const { ref: topSentinelRef } = useInView({
    root: scrollRoot ?? undefined,
    rootMargin: '80px 0px 0px 0px',
    threshold: 0,
    skip: !scrollRoot,
    onChange: (inView) => {
      if (inView) tryLoadOlder();
    },
  });

  // 과거 페이지가 앞에 붙으면 늘어난 높이만큼 보정해 읽던 위치를 유지한다.
  useLayoutEffect(() => {
    const snap = pendingScrollRestoreRef.current;
    const el = scrollRef.current;
    if (!snap || !el || loadingOlder) return;
    pendingScrollRestoreRef.current = null;
    el.scrollTop = snap.prevTop + (el.scrollHeight - snap.prevH);
    skipNextAutoScrollRef.current = false;
  }, [messages, loadingOlder, skipNextAutoScrollRef]);

  const handleSend = useCallback(() => {
    if (sendDraft()) scrollToBottom();
  }, [sendDraft, scrollToBottom]);

  const topSentinel = useMemo(
    () => <div ref={topSentinelRef} className="pointer-events-none h-1 w-full shrink-0" aria-hidden />,
    [topSentinelRef],
  );

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
          <div className="min-w-0">
            <h1 className="min-w-0 truncate text-[18px] font-bold leading-tight text-[#111827]">
              {peerNickname}
            </h1>
            <ChatPeerDogMeta
              {...peerDog}
              className="mt-1 inline-flex items-center gap-1 text-[13px] font-medium text-[#4b5563]"
            />
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
        <ChatMessageList
          messages={messages}
          myId={myId}
          peerProfileImageUrl={peerProfileImageUrl}
          loadingInitial={loadingInitial}
          loadError={loadError}
          topSentinel={topSentinel}
        />
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
