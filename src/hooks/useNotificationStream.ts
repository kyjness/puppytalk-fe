// 알림 SSE: EventSourcePolyfill(withCredentials + Bearer)·백오프 재연결·ApiResponse 형식 파싱.
import { useEffect, useRef } from 'react';
import { EventSourcePolyfill } from 'event-source-polyfill';
import { BASE_URL } from '../config.js';
import { getStoredAccessToken } from '../api/client.js';
import { apiGet } from '../api/typed.js';
import { useNotificationStore } from '../store/useNotificationStore.js';

const STREAM_PATH = '/notifications/stream';
const MIN_BACKOFF_MS = 1000;
const MAX_BACKOFF_MS = 30000;

function buildNotificationStreamUrl(): string {
  const base = String(BASE_URL).replace(/\/+$/, '');
  const combined = `${base}${STREAM_PATH}`;
  if (/^https?:\/\//i.test(combined)) return combined;
  if (typeof window === 'undefined') return combined;
  const path = combined.startsWith('/') ? combined : `/${combined}`;
  return new URL(path, window.location.origin).href;
}

export function useNotificationStream({ enabled }: { enabled: boolean }): void {
  const ingestFromStream = useNotificationStore((s) => s.ingestFromStream);
  const setStreamConnected = useNotificationStore((s) => s.setStreamConnected);
  const enabledRef = useRef(enabled);
  const ingestRef = useRef(ingestFromStream);

  useEffect(() => {
    enabledRef.current = enabled;
    ingestRef.current = ingestFromStream;

    let es: EventSourcePolyfill | null = null;
    let reconnectTimer = 0;
    let backoffMs = MIN_BACKOFF_MS;
    let failCount = 0;
    let closed = false;

    const clearTimer = () => {
      if (reconnectTimer) {
        clearTimeout(reconnectTimer);
        reconnectTimer = 0;
      }
    };

    const scheduleReconnect = () => {
      clearTimer();
      const jitter = Math.floor(Math.random() * 400);
      reconnectTimer = window.setTimeout(() => {
        void attemptConnect();
      }, backoffMs + jitter);
      backoffMs = Math.min(MAX_BACKOFF_MS, Math.floor(backoffMs * 1.8));
    };

    const parseAndDispatch = (rawData: unknown) => {
      if (rawData == null || typeof rawData !== 'string') return;
      const trimmed = rawData.trim();
      if (!trimmed) return;
      try {
        const payload = JSON.parse(trimmed) as unknown;
        if (payload && typeof payload === 'object') {
          const obj = payload as Record<string, unknown>;
          if ('data' in obj && (obj.code != null || obj.message != null)) {
            const inner = obj.data;
            if (inner != null && typeof inner === 'object') {
              ingestRef.current(inner);
              return;
            }
          }
          ingestRef.current(payload);
        }
      } catch {
        // ping 또는 비JSON 라인 무시
      }
    };

    const attemptConnect = async () => {
      if (closed || !enabledRef.current) return;
      const token = getStoredAccessToken();
      if (!token) {
        setStreamConnected(false);
        return;
      }

      if (failCount >= 2) {
        try {
          // 인증 생존 확인용 probe — 본문은 쓰지 않는다. 서버가 무시하는 page는 보내지 않는다.
          await apiGet('/v1/notifications', { query: { size: 1 } });
        } catch (err) {
          const status = (err as { status?: number })?.status;
          if (status === 401) {
            setStreamConnected(false);
            return;
          }
        }
      }

      const url = buildNotificationStreamUrl();

      try {
        es?.close();
        es = new EventSourcePolyfill(url, {
          withCredentials: true,
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        es.addEventListener('open', () => {
          failCount = 0;
          backoffMs = MIN_BACKOFF_MS;
          setStreamConnected(true);
        });

        es.addEventListener('message', (ev: MessageEvent) => {
          parseAndDispatch(ev?.data);
        });

        es.addEventListener('error', () => {
          setStreamConnected(false);
          failCount += 1;
          try {
            es?.close();
          } catch {
            //
          }
          es = null;
          if (!closed && enabledRef.current && getStoredAccessToken()) {
            scheduleReconnect();
          }
        });
      } catch {
        setStreamConnected(false);
        if (!closed && enabledRef.current && getStoredAccessToken()) {
          scheduleReconnect();
        }
      }
    };

    if (enabled) {
      void attemptConnect();
    } else {
      setStreamConnected(false);
    }

    return () => {
      closed = true;
      clearTimer();
      try {
        es?.close();
      } catch {
        //
      }
      es = null;
      setStreamConnected(false);
    };
  }, [enabled, ingestFromStream, setStreamConnected]);
}
