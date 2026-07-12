// 단일 알림 행: 종류 라벨·시간·읽음 처리·게시글 이동.
import { useNavigate } from 'react-router-dom';
import type { NotificationItem as NotificationData } from '../../utils/notificationParse.js';

interface NotificationItemProps {
  item: NotificationData;
  onMarkRead?: (ids: string[]) => void;
}

function formatTime(iso: string | null | undefined) {
  if (!iso) return '';
  try {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return '';
    const now = new Date();
    const diff = (now.getTime() - d.getTime()) / 1000;
    if (diff < 60) return '방금 전';
    if (diff < 3600) return `${Math.floor(diff / 60)}분 전`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}시간 전`;
    return d.toLocaleDateString('ko-KR', { month: 'short', day: 'numeric' });
  } catch {
    return '';
  }
}

function kindLabel(kind: string) {
  switch (kind) {
    case 'COMMENT_ON_POST':
      return '댓글';
    case 'LIKE_POST':
      return '게시글 좋아요';
    case 'LIKE_COMMENT':
      return '댓글 좋아요';
    default:
      return '알림';
  }
}

export function NotificationItem({ item, onMarkRead }: NotificationItemProps) {
  const navigate = useNavigate();
  const unread = item.readAt == null;
  const label = kindLabel(item.kind);
  const time = formatTime(item.createdAt);

  const handleActivate = () => {
    if (unread) {
      onMarkRead?.([item.id]);
    }
    if (item.postId) {
      navigate(`/posts/${item.postId}`);
    }
  };

  return (
    <div
      role="button"
      tabIndex={0}
      className={[
        'notification-item w-full cursor-pointer text-left px-3 py-2.5 rounded-lg border transition-colors',
        unread
          ? 'bg-amber-50/90 border-amber-200/80'
          : 'bg-white/80 border-stone-200/60',
      ].join(' ')}
      onClick={handleActivate}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          handleActivate();
        }
      }}
    >
      <div className="flex items-start justify-between gap-2">
        <p className="text-[13px] font-medium text-stone-900 leading-snug">{label}</p>
        {time && (
          <span className="text-[11px] text-stone-500 shrink-0 tabular-nums">{time}</span>
        )}
      </div>
      {unread && (
        <span className="mt-1 inline-block text-[10px] font-semibold uppercase tracking-wide text-amber-700">
          미읽음
        </span>
      )}
    </div>
  );
}
