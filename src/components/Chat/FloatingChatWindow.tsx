// 1:1 채팅 플로팅 창(포털). 하단 고정 스크롤만 하고 과거 무한 스크롤은 없다.
// 메시지 렌더링·데이터 로드·전송은 ChatMessageList / useChatRoomSession이 소유한다.
import { useCallback, useEffect, useMemo, useRef } from 'react';
import { createPortal } from 'react-dom';

import { ChatConnectionNotice } from './ChatConnectionNotice';
import { ChatInput, chatInputPlaceholder } from './ChatInput';
import { ChatMessageList } from './ChatMessageList';
import { ChatPeerDogMeta } from './ChatPeerDogMeta';
import { useChatRoomSession } from '../../hooks/useChatRoomSession';
import { useStickToBottom } from '../../hooks/useStickToBottom';
import { useChatUiStore } from '../../store/useChatUiStore';

const PORTAL_CONTAINER_ID = 'floating-chat-portal-root';

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

  const roomId = floatingRoom?.roomId ?? '';
  const peerUserId = floatingRoom?.peerUserId ?? '';
  const title = floatingRoom?.title ?? '채팅';
  const peerProfileImageUrlFromUi = floatingRoom?.peerProfileImageUrl ?? '';

  const {
    myId,
    status,
    lastError,
    peerInfo,
    peerDog,
    messages,
    loadingInitial,
    loadError,
    draft,
    setDraft,
    sendDraft,
    retryMessage,
    discardMessage,
  } = useChatRoomSession(roomId, peerUserId);

  const peerNickname = peerInfo?.peerNickname || title;
  const peerProfileImageUrl = peerInfo?.peerProfileImageUrl || peerProfileImageUrlFromUi || '';

  const scrollRef = useRef<HTMLDivElement | null>(null);
  const { onScroll, scrollToBottom } = useStickToBottom(scrollRef, messages.length, roomId);

  const handleSend = useCallback(() => {
    if (sendDraft()) scrollToBottom();
  }, [sendDraft, scrollToBottom]);

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
            <ChatPeerDogMeta
              {...peerDog}
              className="mt-0.5 inline-flex items-center gap-1 text-[11px] font-medium text-[#4b5563]"
            />
          </div>
          <ChatConnectionNotice status={status} lastError={lastError} />
        </div>
        <button
          type="button"
          className="inline-flex h-9 w-9 cursor-pointer items-center justify-center rounded-lg border-0 bg-transparent text-gray-600 hover:bg-gray-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-black focus-visible:outline-offset-2"
          aria-label="채팅창 닫기"
          onClick={closeFloatingRoom}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
            <path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
          </svg>
        </button>
      </div>

      <div ref={scrollRef} className="min-h-0 flex-1 overflow-y-auto px-3 py-2" onScroll={onScroll}>
        <ChatMessageList
          messages={messages}
          myId={myId}
          peerProfileImageUrl={peerProfileImageUrl}
          loadingInitial={loadingInitial}
          loadError={loadError}
          onRetry={retryMessage}
          onDiscard={discardMessage}
        />
      </div>

      <ChatInput
        value={draft}
        onChange={setDraft}
        onSend={handleSend}
        // 소켓이 열려 있지 않으면 전송 자체가 불가능하다(ChatRoom과 동일 정책).
        disabled={!peerUserId || status !== 'open'}
        placeholder={chatInputPlaceholder(peerUserId, status, 'peer 정보가 없습니다.')}
      />
    </div>,
    portalEl,
  );
}
