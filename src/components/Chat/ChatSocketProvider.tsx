// 전역 DM WebSocket 1회 유지 — sendMessage·status·connectionEpoch는 useChat()으로 소비.
import { createContext, useContext, useMemo, type ReactNode } from 'react';

import { useAuth } from '../../context/AuthContext.jsx';
import {
  useChatSocket,
  type ChatSocketError,
  type ChatSocketStatus,
} from '../../hooks/useChatSocket.js';

export interface ChatContextValue {
  sendMessage: (peerUserId: string, content: string) => boolean;
  status: ChatSocketStatus;
  lastError: ChatSocketError | null;
  /** 소켓이 열릴 때마다 증가 — 채팅방이 이 값을 보고 끊긴 구간을 DB에서 재동기한다. */
  connectionEpoch: number;
}

const ChatContext = createContext<ChatContextValue | null>(null);

export function ChatSocketProvider({ children }: { children: ReactNode }) {
  const { isLoggedIn, isRestored, clearUser, user } = useAuth();
  const enabled = Boolean(isRestored && isLoggedIn);
  const myId = user == null ? '' : String(user.userId ?? user.id ?? '').trim();
  const { sendMessage, status, lastError, connectionEpoch } = useChatSocket({
    enabled,
    myId,
    onAuthError: () => clearUser(),
  });
  const value = useMemo(
    () => ({ sendMessage, status, lastError, connectionEpoch }),
    [sendMessage, status, lastError, connectionEpoch],
  );
  return <ChatContext.Provider value={value}>{children}</ChatContext.Provider>;
}

export function useChat(): ChatContextValue {
  const ctx = useContext(ChatContext);
  if (!ctx) {
    throw new Error('useChat must be used within ChatSocketProvider');
  }
  return ctx;
}
