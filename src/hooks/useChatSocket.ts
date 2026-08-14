// DM WebSocket: /v1/ws/chat?token= — 수신 시 useChatStore.appendMessage, 백오프 재연결.
import { useQueryClient } from '@tanstack/react-query';
import { useCallback, useEffect, useRef, useState } from 'react';

import { getStoredAccessToken } from '../api/client.js';
import { BASE_URL } from '../config.js';
import { normalizeChatMessage, useChatStore } from '../store/useChatStore.js';
import { RECENT_CHAT_ROOMS_KEY } from './useRecentChatRooms';

const MIN_BACKOFF_MS = 1000;
const MAX_BACKOFF_MS = 30000;

// 서버 종료 코드(app/domain/chat/router.py와 짝). 1008은 인증·권한 실패 전용이고,
// 용량 사유는 4000~4999 애플리케이션 대역으로 갈라져 있다 — 사유마다 복구 동작이 다르다.
const WS_CLOSE_AUTH = 1008;
const WS_CLOSE_CONNECTION_LIMIT = 4001;
const WS_CLOSE_RATE_LIMIT = 4002;

// 상대 메시지 수신 → 인박스 미읽음 재조회. 대화가 몰아칠 때 프레임마다 REST를 때리지
// 않도록 묶는다(배지는 몇 초 늦어도 되지만 왕복은 즉시 비용이다).
const INBOX_REFRESH_DEBOUNCE_MS = 2000;

export type ChatSocketStatus = 'idle' | 'connecting' | 'open' | 'closed' | 'error';

/**
 * 소켓이 실패한 이유. 사유마다 복구 동작이 달라서 구분한다 —
 * `auth`는 재인증, `connection_limit`은 재연결 포기, `rate_limited`는 백오프 재연결.
 * 문자열 하나로 뭉치면 생산자와 소비자를 이어 주는 것이 오탈자뿐인 관례가 된다.
 */
export type ChatSocketErrorKind =
  | 'auth'
  | 'connection_limit'
  | 'rate_limited'
  | 'server'
  | 'transport';

export interface ChatSocketError {
  kind: ChatSocketErrorKind;
  /** 서버가 실어 보낸 사용자용 문구(있을 때만). */
  message?: string;
}

/** `BASE_URL`이 `/api/v1`일 때: `ws(s)://현재호스트/api/v1/ws/chat?token=`. 절대 URL(`VITE_API_BASE_URL`)이면 해당 호스트 사용. */
function buildChatWebSocketUrl(token: string | null | undefined): string | null {
  const t = token != null ? String(token).trim() : '';
  if (!t) return null;
  try {
    if (typeof window === 'undefined') return null;
    const baseRaw = String(BASE_URL ?? '/api/v1').replace(/\/+$/, '');
    if (baseRaw.startsWith('http://') || baseRaw.startsWith('https://')) {
      const httpUrl = new URL(baseRaw.endsWith('/') ? baseRaw : `${baseRaw}/`);
      const wsProto = httpUrl.protocol === 'https:' ? 'wss:' : 'ws:';
      const path = `${httpUrl.pathname.replace(/\/+$/, '')}/ws/chat`;
      return `${wsProto}//${httpUrl.host}${path}?token=${encodeURIComponent(t)}`;
    }
    if (!baseRaw.startsWith('/')) return null;
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const host = window.location.host;
    const wsUrl = `${protocol}//${host}${baseRaw}/ws/chat?token=${encodeURIComponent(t)}`;
    return wsUrl;
  } catch {
    return null;
  }
}

function parseIncomingPayload(
  raw: string,
): { type: 'message'; roomId: string; row: ReturnType<typeof normalizeChatMessage> } | { type: 'error'; code: string; message?: string } | null {
  try {
    const j = JSON.parse(raw) as Record<string, unknown>;
    const t = j.type;
    if (t === 'error') {
      return {
        type: 'error',
        code: String(j.code ?? 'error'),
        message: j.message != null ? String(j.message) : undefined,
      };
    }
    if (t === 'chat.message') {
      const row = normalizeChatMessage(j);
      if (!row.roomId) return null;
      return { type: 'message', roomId: row.roomId, row };
    }
  } catch {
    return null;
  }
  return null;
}

export interface UseChatSocketOptions {
  enabled: boolean;
  /** 내 공개 사용자 ID — 내 메시지 에코와 상대 메시지를 구분해 인박스 재조회를 아낀다. */
  myId?: string;
  /** close code 1008(인증 실패)일 때만 호출된다. 연결 상한·레이트리밋은 인증 문제가 아니다. */
  onAuthError?: () => void;
}

export interface UseChatSocketResult {
  status: ChatSocketStatus;
  lastError: ChatSocketError | null;
  sendMessage: (peerUserId: string, content: string) => boolean;
  /**
   * 소켓이 열릴 때마다 1씩 증가(최초 연결 = 1). 실시간은 at-most-once라 끊긴 구간의
   * 메시지는 되돌아오지 않는다 — 이 값이 바뀌면 구독자가 DB에서 재동기해야 한다.
   */
  connectionEpoch: number;
}

/**
 * `enabled===true`일 때만 연결. 언마운트·enabled false 시 소켓/재연결 타이머 정리(HMR 누수 방지).
 */
export function useChatSocket(options: UseChatSocketOptions): UseChatSocketResult {
  const { enabled, myId, onAuthError } = options;
  const appendMessage = useChatStore((s) => s.appendMessage);
  const appendSyncRef = useRef(appendMessage);
  appendSyncRef.current = appendMessage;

  const [status, setStatus] = useState<ChatSocketStatus>('idle');
  const [lastError, setLastError] = useState<ChatSocketError | null>(null);
  const [connectionEpoch, setConnectionEpoch] = useState(0);

  const wsRef = useRef<WebSocket | null>(null);
  const backoffMsRef = useRef(MIN_BACKOFF_MS);
  const closedByCleanupRef = useRef(false);
  const onAuthErrorRef = useRef(onAuthError);
  onAuthErrorRef.current = onAuthError;
  const myIdRef = useRef(myId);
  myIdRef.current = myId;

  const queryClient = useQueryClient();
  const inboxRefreshTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // 미읽음 배지는 인박스 쿼리(staleTime 15s)가 들고 있어, 무효화하지 않으면
  // 실시간으로 메시지가 도착해도 헤더 숫자가 그대로다.
  // 소켓 effect는 의존성이 [enabled]뿐이다(재연결 폭풍을 막으려 일부러 좁게 잡았다) —
  // 이 파일의 다른 핸들러처럼 ref로 최신 함수를 넘긴다.
  const scheduleInboxRefresh = useCallback(() => {
    if (inboxRefreshTimerRef.current != null) return;
    inboxRefreshTimerRef.current = setTimeout(() => {
      inboxRefreshTimerRef.current = null;
      void queryClient.invalidateQueries({ queryKey: RECENT_CHAT_ROOMS_KEY });
    }, INBOX_REFRESH_DEBOUNCE_MS);
  }, [queryClient]);
  const scheduleInboxRefreshRef = useRef(scheduleInboxRefresh);
  scheduleInboxRefreshRef.current = scheduleInboxRefresh;

  useEffect(
    () => () => {
      if (inboxRefreshTimerRef.current != null) clearTimeout(inboxRefreshTimerRef.current);
    },
    [],
  );

  const sendMessage = useCallback((peerUserId: string, content: string) => {
    const ws = wsRef.current;
    if (!ws || ws.readyState !== WebSocket.OPEN) return false;
    const trimmed = content.trim();
    if (!trimmed || !peerUserId.trim()) return false;
    const payload = {
      type: 'chat.send',
      peerUserId: peerUserId.trim(),
      content: trimmed,
    };
    try {
      ws.send(JSON.stringify(payload));
      return true;
    } catch {
      return false;
    }
  }, []);

  useEffect(() => {
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null;

    const clearTimer = () => {
      if (reconnectTimer != null) {
        clearTimeout(reconnectTimer);
        reconnectTimer = null;
      }
    };

    const scheduleReconnect = () => {
      clearTimer();
      const jitter = Math.floor(Math.random() * 400);
      const delay = Math.min(MAX_BACKOFF_MS, backoffMsRef.current) + jitter;
      reconnectTimer = window.setTimeout(() => {
        void openSocket();
      }, delay);
      backoffMsRef.current = Math.min(MAX_BACKOFF_MS, Math.floor(backoffMsRef.current * 1.8));
    };

    const openSocket = async () => {
      if (closedByCleanupRef.current || !enabled) return;
      const token = getStoredAccessToken();
      if (!token) {
        setStatus('closed');
        setLastError({ kind: 'transport', message: 'no_token' });
        return;
      }

      try {
        wsRef.current?.close();
      } catch {
        /* noop */
      }
      wsRef.current = null;

      setStatus('connecting');
      setLastError(null);

      const wsUrl = buildChatWebSocketUrl(token);
      if (!wsUrl) {
        setStatus('error');
        setLastError({ kind: 'transport', message: 'bad_ws_url' });
        scheduleReconnect();
        return;
      }

      let ws: WebSocket;
      try {
        ws = new WebSocket(wsUrl);
      } catch (e) {
        setStatus('error');
        setLastError({
          kind: 'transport',
          message: e instanceof Error ? e.message : 'websocket_construct_failed',
        });
        scheduleReconnect();
        return;
      }

      wsRef.current = ws;

      ws.onopen = () => {
        if (closedByCleanupRef.current) {
          try {
            ws.close();
          } catch {
            /* noop */
          }
          return;
        }
        backoffMsRef.current = MIN_BACKOFF_MS;
        setStatus('open');
        setConnectionEpoch((n) => n + 1);
      };

      ws.onmessage = (ev) => {
        if (typeof ev.data !== 'string') return;
        const parsed = parseIncomingPayload(ev.data);
        if (!parsed) return;
        if (parsed.type === 'error') {
          // 서버 message는 이미 사용자용 한국어 문구다(예: 레이트리밋 재시도 안내).
          setLastError({ kind: 'server', message: parsed.message || parsed.code });
          return;
        }
        appendSyncRef.current(parsed.roomId, parsed.row);
        // 내 메시지 에코까지 무효화하면 전송마다 REST 왕복이 붙는다 — 상대 메시지만 센다.
        const me = myIdRef.current;
        if (!me || parsed.row.senderId !== me) scheduleInboxRefreshRef.current();
      };

      ws.onerror = () => {
        setLastError({ kind: 'transport' });
        setStatus('error');
      };

      ws.onclose = (ev) => {
        wsRef.current = null;
        if (closedByCleanupRef.current) {
          setStatus('closed');
          return;
        }
        setStatus('closed');

        // 사유마다 복구 동작이 다르다 — 예전에는 셋 다 1008이라 연결 상한·레이트리밋에
        // 걸린 것뿐인데도 인증 실패로 오인해 로그인 세션을 폐기했다.
        if (ev.code === WS_CLOSE_AUTH) {
          setLastError({ kind: 'auth' });
          onAuthErrorRef.current?.();
          return;
        }
        if (ev.code === WS_CLOSE_CONNECTION_LIMIT) {
          // 재연결해도 상한은 그대로다 — 다시 두드리지 않는다.
          setLastError({ kind: 'connection_limit' });
          return;
        }
        if (ev.code === WS_CLOSE_RATE_LIMIT) {
          setLastError({ kind: 'rate_limited' });
        }
        if (enabled) {
          scheduleReconnect();
        }
      };
    };

    if (!enabled) {
      closedByCleanupRef.current = true;
      clearTimer();
      try {
        wsRef.current?.close();
      } catch {
        /* noop */
      }
      wsRef.current = null;
      setStatus('idle');
      return () => {
        clearTimer();
      };
    }

    closedByCleanupRef.current = false;

    void openSocket();

    return () => {
      closedByCleanupRef.current = true;
      clearTimer();
      try {
        wsRef.current?.close();
      } catch {
        /* noop */
      }
      wsRef.current = null;
      setStatus('closed');
    };
  }, [enabled]);

  return { status, lastError, sendMessage, connectionEpoch };
}
