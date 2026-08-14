// 채팅방 세션 공용 로직 — 전체화면(ChatRoom)과 플로팅(FloatingChatWindow)이 공유한다.
// 데이터 로드·상대 정보·전송까지만 담당한다. 스크롤은 공통분(하단 고정)만 useStickToBottom이
// 가져가고, 전체화면 전용인 과거 페이지 위치 복원은 그 화면이 직접 소유한다.
import { useCallback, useEffect, useMemo, useState } from 'react';

import type { ChatMessageRow } from '../api/api-types.js';
import { useChat } from '../components/Chat/ChatSocketProvider';
import type { ChatSocketStatus } from './useChatSocket.js';
import { useAuth } from '../context/AuthContext.jsx';
import { useChatStore } from '../store/useChatStore.js';
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
  peerInfo: ChatRoomPeerInfo | null | undefined;
  peerDog: ChatPeerDog;
  messages: ChatMessageRow[];
  loadingInitial: boolean;
  loadError: string | null;
  draft: string;
  setDraft: (v: string) => void;
  /** 초안을 전송하고 낙관적 말풍선을 넣는다. 전송하지 못했으면 false. */
  sendDraft: () => boolean;
}

export function useChatRoomSession(roomId: string, peerUserId: string): ChatRoomSession {
  const { user } = useAuth();
  const myId = user == null ? '' : String(user.userId ?? user.id ?? '').trim();

  const { sendMessage, status } = useChat();

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
  const appendMessage = useChatStore((s) => s.appendMessage);
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

  const sendDraft = useCallback((): boolean => {
    const text = draft.trim();
    if (!roomId || !peerUserId || !text) return false;
    if (!sendMessage(peerUserId, text)) return false;
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
    return true;
  }, [appendMessage, draft, myId, peerUserId, roomId, sendMessage]);

  return {
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
  };
}
