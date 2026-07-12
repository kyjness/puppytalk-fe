// 라우터 하위 단일 마운트: 로그인·세션 복원 후 SSE 구독, 로그아웃 시 스토어 초기화.
import { useEffect } from 'react';
import { useAuth } from '../../context/AuthContext.jsx';
import { useNotificationStream } from '../../hooks/useNotificationStream.js';
import { useNotificationStore } from '../../store/useNotificationStore.js';

export function NotificationStreamHost() {
  const { isLoggedIn, isRestored } = useAuth();
  const reset = useNotificationStore((s) => s.reset);
  const fetchNotifications = useNotificationStore((s) => s.fetchNotifications);

  const enabled = Boolean(isRestored && isLoggedIn);
  useNotificationStream({ enabled });

  // 복원 전 isLoggedIn=false일 때 reset 하면 토스트·목록·seen이 날아가고 SSE·fetch와 엇갈림.
  useEffect(() => {
    if (!isRestored) return;
    if (!isLoggedIn) {
      reset();
    }
  }, [isRestored, isLoggedIn, reset]);

  useEffect(() => {
    if (isRestored && isLoggedIn) {
      void fetchNotifications(1, 30);
    }
  }, [isRestored, isLoggedIn, fetchNotifications]);

  return null;
}
