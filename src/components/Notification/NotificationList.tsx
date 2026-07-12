// 알림 드롭다운 본문: 로딩·목록·모두 읽음.
import { useMemo } from 'react';
import { NotificationItem } from './NotificationItem.jsx';
import type { NotificationItem as NotificationData } from '../../utils/notificationParse.js';

interface NotificationListProps {
  items: NotificationData[];
  loading: boolean;
  error: boolean;
  listTotal?: number;
  visibleCount?: number;
  onRequestMore?: () => void;
  onMarkRead?: (ids: string[]) => void;
  onMarkAllRead?: () => void;
}

export function NotificationList({
  items,
  loading,
  error,
  listTotal = 0,
  visibleCount = 6,
  onRequestMore,
  onMarkRead,
  onMarkAllRead,
}: NotificationListProps) {
  const visibleItems = useMemo(
    () => items.slice(0, Math.min(Math.max(0, visibleCount), items.length)),
    [items, visibleCount]
  );
  const hasMore = !loading && !error && listTotal > items.length;
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
      {!loading && !error && items.length === 0 && listTotal > 0 && (
        <p className="text-xs text-amber-800 py-4 text-center px-1">
          서버에는 알림이 {listTotal}건 있는데 화면에 표시하지 못했습니다. 새로고침 후 다시 시도해 주세요.
        </p>
      )}
      {!loading && !error && items.length === 0 && listTotal === 0 && (
        <p className="text-xs text-stone-500 py-6 text-center">받은 알림이 없습니다.</p>
      )}
      {!loading &&
        !error &&
        visibleItems.map((item) => (
          <NotificationItem key={item.id} item={item} onMarkRead={onMarkRead} />
        ))}
      {!loading && !error && visibleItems.length > 0 && listTotal > visibleItems.length && (
        <p className="px-1 pt-1 text-center text-[11px] text-stone-500">
          {visibleItems.length}/{listTotal} 표시 중
        </p>
      )}
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
