// 채팅방 세션 공용 로직 — 전체화면(ChatRoom)과 플로팅(FloatingChatWindow)이 공유한다.
// 데이터 로드·상대 정보·전송까지만 담당한다. 스크롤은 공통분(하단 고정)만 useStickToBottom이
// 가져가고, 전체화면 전용인 과거 페이지 위치 복원은 그 화면이 직접 소유한다.
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import type { ChatMessageRow } from '../api/api-types.js';
import { useChat } from '../components/Chat/ChatSocketProvider';
import type { ChatSocketError, ChatSocketStatus } from './useChatSocket.js';
import { useAuth } from '../context/AuthContext.jsx';
import { newPendingMessageId, useChatStore } from '../store/useChatStore.js';
import { calculateDogAge } from '../utils/index.js';
import { useChatRoomPeerInfo, type ChatRoomPeerInfo } from './useChatRoomPeerInfo';
import { useMarkChatRoomRead } from './useMarkChatRoomRead';

// 셀렉터가 매번 새 `[]`를 반환하면 스토어가 바뀔 때마다 참조가 달라져 불필요한 리렌더가 난다.
const EMPTY_MESSAGES: ChatMessageRow[] = [];

export interface ChatPeerDog {
  name: string;
  breed: string;
  gender: string;
  age: string;
}

export interface ChatRoomSession {
  /** 내 공개 사용자 ID(없으면 빈 문자열). */
  myId: string;
  status: ChatSocketStatus;
  lastError: ChatSocketError | null;
  peerInfo: ChatRoomPeerInfo | null | undefined;
  peerDog: ChatPeerDog;
  messages: ChatMessageRow[];
  loadingInitial: boolean;
  loadError: string | null;
  draft: string;
  setDraft: (v: string) => void;
  /** 초안을 전송하고 낙관적 말풍선을 넣는다. 전송하지 못했으면 false. */
  sendDraft: () => boolean;
  /** 실패한 말풍선을 지우고 같은 내용으로 다시 보낸다. */
  retryMessage: (message: ChatMessageRow) => void;
  /** 실패한 말풍선을 목록에서 버린다. */
  discardMessage: (id: string) => void;
}

export function useChatRoomSession(roomId: string, peerUserId: string): ChatRoomSession {
  const { user } = useAuth();
  const myId = user == null ? '' : String(user.userId ?? user.id ?? '').trim();

  const { sendMessage, status, lastError, connectionEpoch } = useChat();

  const peerInfoQuery = useChatRoomPeerInfo(Boolean(myId), roomId);
  const peerInfo = peerInfoQuery.data;
  const peerDog = useMemo<ChatPeerDog>(
    () => ({
      name: peerInfo?.peerDogName || '',
      breed: peerInfo?.peerDogBreed || '',
      gender: peerInfo?.peerDogGender || '',
      age: calculateDogAge(peerInfo?.peerDogBirthDate || ''),
    }),
    [peerInfo],
  );

  const messages = useChatStore(
    useCallback((s) => s.messagesByRoom[roomId] ?? EMPTY_MESSAGES, [roomId]),
  );
  const loadingInitial = useChatStore(
    useCallback((s) => Boolean(s.loadingInitialByRoom[roomId]), [roomId]),
  );

  const fetchInitialMessages = useChatStore((s) => s.fetchInitialMessages);
  const fetchGapMessages = useChatStore((s) => s.fetchGapMessages);
  const appendPendingMessage = useChatStore((s) => s.appendPendingMessage);
  const removeMessage = useChatStore((s) => s.removeMessage);
  const markRoomRead = useMarkChatRoomRead();

  const [draft, setDraft] = useState('');
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    setLoadError(null);
    if (!roomId) return;
    void markRoomRead(roomId);
    void fetchInitialMessages(roomId).catch((err: unknown) => {
      const msg = err instanceof Error ? err.message : String(err ?? 'load_failed');
      setLoadError(msg);
      console.error('[useChatRoomSession] fetchInitialMessages', err);
    });
  }, [roomId, fetchInitialMessages, markRoomRead]);

  // 소켓이 다시 열리면 끊긴 구간을 DB에서 메운다. 실시간은 at-most-once라 그 사이 메시지는
  // 다시 오지 않는다 — 이 재조회가 없으면 유실분이 화면에 영영 나타나지 않는다.
  // roomId 초기 로드와 겹치지 않도록 epoch가 **실제로 바뀐 경우에만** 돌고,
  // 스크롤은 건드리지 않는다(사용자가 과거를 읽는 중일 수 있다).
  const syncedEpochRef = useRef(connectionEpoch);
  useEffect(() => {
    if (syncedEpochRef.current === connectionEpoch) return;
    syncedEpochRef.current = connectionEpoch;
    if (!roomId) return;
    void fetchGapMessages(roomId).catch((err: unknown) => {
      console.warn('[useChatRoomSession] 재연결 재동기 실패', err);
    });
  }, [connectionEpoch, roomId, fetchGapMessages]);

  const sendText = useCallback(
    (text: string): boolean => {
      if (!roomId || !peerUserId || !text) return false;
      if (!sendMessage(peerUserId, text)) return false;
      if (myId) {
        // `ws.send()` 성공은 서버 저장을 보장하지 않는다 — 낙관적 말풍선은 확정 대기 상태로
        // 들어가고, 에코가 안 오면 스토어가 실패로 뒤집는다.
        appendPendingMessage(roomId, {
          id: newPendingMessageId(),
          roomId,
          senderId: myId,
          content: text,
          isRead: true,
          createdAt: new Date().toISOString(),
        });
      }
      return true;
    },
    [appendPendingMessage, myId, peerUserId, roomId, sendMessage],
  );

  const sendDraft = useCallback((): boolean => {
    if (!sendText(draft.trim())) return false;
    setDraft('');
    return true;
  }, [draft, sendText]);

  const retryMessage = useCallback(
    (message: ChatMessageRow) => {
      removeMessage(roomId, message.id);
      sendText(message.content);
    },
    [removeMessage, roomId, sendText],
  );

  const discardMessage = useCallback(
    (id: string) => {
      removeMessage(roomId, id);
    },
    [removeMessage, roomId],
  );

  return {
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
  };
}
