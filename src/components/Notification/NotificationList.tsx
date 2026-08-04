// 알림 드롭다운 본문: 로딩·목록·모두 읽음.
import { useMemo } from 'react';
import { NotificationItem } from './NotificationItem.jsx';
import type { NotificationItem as NotificationData } from '../../utils/notificationParse.js';

interface NotificationListProps {
  items: NotificationData[];
  loading: boolean;
  error: boolean;
  /** 서버에 다음 페이지가 남았는지. 서버는 총계를 주지 않으므로 이 불리언이 유일한 근거다. */
  listHasMore?: boolean;
  visibleCount?: number;
  onRequestMore?: () => void;
  onMarkRead?: (ids: string[]) => void;
  onMarkAllRead?: () => void;
}

export function NotificationList({
  items,
  loading,
  error,
  listHasMore = false,
  visibleCount = 6,
  onRequestMore,
  onMarkRead,
  onMarkAllRead,
}: NotificationListProps) {
  const visibleItems = useMemo(
    () => items.slice(0, Math.min(Math.max(0, visibleCount), items.length)),
    [items, visibleCount]
  );
  // 서버에 남았거나(listHasMore), 실시간 수신으로 화면에 안 보이는 게 쌓였을 때(로컬 잔여) 노출.
  const hasMore =
    !loading && !error && (listHasMore || items.length > visibleItems.length);
  return (
    <div className="notification-list flex flex-col gap-1 min-w-[240px] max-w-[min(100vw-2rem,300px)]">
      <div className="flex items-center justify-between gap-2 px-1 pb-2 border-b border-stone-200/80">
        <span className="text-xs font-semibold text-stone-700">알림</span>
        <button
          type="button"
          className="cursor-pointer rounded-md border border-stone-200 bg-stone-50 px-2.5 py-1 text-[11px] font-semibold text-stone-700 transition-colors hover:bg-stone-100 hover:text-stone-900 disabled:opacity-40"
          onClick={() => onMarkAllRead?.()}
          disabled={loading || items.length === 0}
        >
          모두 읽음
        </button>
      </div>
      {!loading && error && (
        <p className="text-xs text-red-600 py-4 text-center">알림을 불러오지 못했습니다.</p>
      )}
      {!loading && !error && items.length === 0 && (
        <p className="text-xs text-stone-500 py-6 text-center">받은 알림이 없습니다.</p>
      )}
      {!loading &&
        !error &&
        visibleItems.map((item) => (
          <NotificationItem key={item.id} item={item} onMarkRead={onMarkRead} />
        ))}
      {/* 총계 표기는 뺀다 — 서버가 커서 페이지네이션이라 전체 건수를 알 수 없다. */}
      {hasMore && (
        <button
          type="button"
          className="mt-1 cursor-pointer rounded-lg border border-stone-200 bg-stone-50 px-2.5 py-2 text-[12px] font-semibold text-stone-700 transition-colors hover:bg-stone-100 hover:text-stone-900 disabled:opacity-40"
          onClick={() => onRequestMore?.()}
        >
          더보기
        </button>
      )}
    </div>
  );
}
