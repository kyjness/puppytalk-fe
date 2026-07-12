// 헤더 종 아이콘·미읽음 배지·알림 팝오버(포털)·토스트 스택.
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
} from 'react';
import { createPortal } from 'react-dom';
import { Bell } from 'lucide-react';
import { useNotificationStore } from '../../store/useNotificationStore.js';
import { NotificationList } from './NotificationList.jsx';

const POPOVER_Z = 10050;
const TOAST_Z = 10060;

interface ToastLineProps {
  message: string;
  toastId: string;
  removeToast: (id: string) => void;
}

function ToastLine({ message, toastId, removeToast }: ToastLineProps) {
  useEffect(() => {
    const id = window.setTimeout(() => removeToast(toastId), 4200);
    return () => clearTimeout(id);
  }, [toastId, removeToast]);
  return (
    <div
      className="pointer-events-auto rounded-lg border border-stone-200/90 bg-white px-3 py-2 text-[13px] text-stone-800"
      style={{ animation: 'notif-slide 0.35s ease-out' }}
    >
      {message}
    </div>
  );
}

export function NotificationBell() {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);
  const [popoverStyle, setPopoverStyle] = useState<CSSProperties>({});
  const [pageSize, setPageSize] = useState(6);

  const items = useNotificationStore((s) => s.items);
  const unreadCount = useNotificationStore((s) => s.unreadCount);
  const listLoading = useNotificationStore((s) => s.listLoading);
  const listError = useNotificationStore((s) => s.listError);
  const listTotal = useNotificationStore((s) => s.listTotal);
  const fetchNotifications = useNotificationStore((s) => s.fetchNotifications);
  const markRead = useNotificationStore((s) => s.markRead);
  const toasts = useNotificationStore((s) => s.toasts);
  const removeToast = useNotificationStore((s) => s.removeToast);

  const updatePopoverPosition = useCallback(() => {
    const el = wrapRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const margin = 8;
    setPopoverStyle({
      position: 'fixed',
      top: r.bottom + margin,
      right: Math.max(8, window.innerWidth - r.right),
      zIndex: POPOVER_Z,
      maxWidth: 'min(100vw - 2rem, 300px)',
    });
  }, []);

  useLayoutEffect(() => {
    if (!open) return;
    updatePopoverPosition();
  }, [open, updatePopoverPosition]);

  useEffect(() => {
    if (!open) return;
    const onResizeOrScroll = () => updatePopoverPosition();
    window.addEventListener('resize', onResizeOrScroll);
    window.addEventListener('scroll', onResizeOrScroll, true);
    return () => {
      window.removeEventListener('resize', onResizeOrScroll);
      window.removeEventListener('scroll', onResizeOrScroll, true);
    };
  }, [open, updatePopoverPosition]);

  useEffect(() => {
    if (!open) return;
    setPageSize(6);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    void fetchNotifications(1, pageSize);
  }, [open, pageSize, fetchNotifications]);

  // 같은 클릭 제스처로 연 직후 리스너가 붙으면 포털/레이아웃보다 먼저 바깥 클릭으로 닫히는 경우가 있어 1틱 지연.
  useEffect(() => {
    if (!open) return;
    let removeListener = () => {};
    const timer = window.setTimeout(() => {
      function handlePointerDown(e: PointerEvent) {
        const t = e.target;
        if (!(t instanceof Node)) return;
        if (wrapRef.current?.contains(t)) return;
        if (popoverRef.current?.contains(t)) return;
        setOpen(false);
      }
      document.addEventListener('pointerdown', handlePointerDown, true);
      removeListener = () =>
        document.removeEventListener('pointerdown', handlePointerDown, true);
    }, 0);
    return () => {
      clearTimeout(timer);
      removeListener();
    };
  }, [open]);

  const showBadge = unreadCount > 0;
  const badgeText = unreadCount > 99 ? '99+' : String(unreadCount);

  const toastPortal =
    typeof document !== 'undefined'
      ? createPortal(
          <div
            className="flex flex-col gap-2 max-w-[min(100vw-2rem,320px)] pointer-events-none"
            style={{ position: 'fixed', bottom: 16, right: 16, zIndex: TOAST_Z }}
            aria-live="polite"
          >
            {toasts.map((t) => (
              <ToastLine key={t.id} message={t.message} toastId={t.id} removeToast={removeToast} />
            ))}
          </div>,
          document.body
        )
      : null;

  const popoverPortal =
    open && typeof document !== 'undefined'
      ? createPortal(
          <div
            ref={popoverRef}
            role="dialog"
            aria-label="알림 목록"
            className="min-w-[240px] rounded-xl border border-stone-200/90 bg-white p-2"
            style={popoverStyle}
            onClick={(e) => e.stopPropagation()}
            onPointerDown={(e) => e.stopPropagation()}
          >
            <NotificationList
              items={items}
              loading={listLoading}
              error={Boolean(listError)}
              listTotal={listTotal}
              visibleCount={pageSize}
              onRequestMore={() => setPageSize((v) => Math.min(60, v + 12))}
              onMarkRead={(ids) => void markRead(ids)}
              onMarkAllRead={() => void markRead([])}
            />
          </div>,
          document.body
        )
      : null;

  return (
    <>
      <div className="notification-bell-wrap relative" ref={wrapRef}>
        <button
          type="button"
          className="notification-bell-btn relative flex h-10 w-10 cursor-pointer items-center justify-center rounded-full border-0 bg-transparent text-stone-800 shadow-none transition-opacity hover:opacity-80 focus-visible:outline focus-visible:outline-2 focus-visible:outline-black focus-visible:outline-offset-2"
          aria-label="알림"
          aria-expanded={open}
          onPointerDown={(e) => e.stopPropagation()}
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            setOpen((v) => !v);
          }}
        >
          <Bell className="h-[22px] w-[22px]" strokeWidth={1.75} aria-hidden />
          {showBadge && (
            <span className="notification-bell-badge absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 flex items-center justify-center rounded-full bg-rose-600 text-[10px] font-bold text-white leading-none">
              {badgeText}
            </span>
          )}
        </button>
      </div>
      {popoverPortal}
      {toastPortal}
      <style>{`
        @keyframes notif-slide {
          from { opacity: 0; transform: translateY(8px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </>
  );
}
