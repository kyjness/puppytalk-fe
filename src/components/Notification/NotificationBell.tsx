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

// 한 번에 보여주고 받아오는 크기. 커서 페이지네이션이라 상한을 둘 필요가 없다.
const PAGE_STEP = 6;

export function NotificationBell() {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);
  const [popoverStyle, setPopoverStyle] = useState<CSSProperties>({});
  const measuredRef = useRef<{ top: number; right: number; maxHeight: number } | null>(null);
  const [visibleCount, setVisibleCount] = useState(PAGE_STEP);

  const items = useNotificationStore((s) => s.items);
  const listCursor = useNotificationStore((s) => s.listCursor);
  const unreadCount = useNotificationStore((s) => s.unreadCount);
  const listLoading = useNotificationStore((s) => s.listLoading);
  const listError = useNotificationStore((s) => s.listError);
  const listHasMore = useNotificationStore((s) => s.listHasMore);
  const fetchNotifications = useNotificationStore((s) => s.fetchNotifications);
  const markRead = useNotificationStore((s) => s.markRead);
  const toasts = useNotificationStore((s) => s.toasts);
  const removeToast = useNotificationStore((s) => s.removeToast);

  // 위치만 계산한다. 스크롤 동작(overflow·체이닝 차단·막대 숨김)은 정적 CSS라
  // className에 둔다 — 측정 결과에 섞으면 스크롤할 때마다 재계산이 돌게 된다.
  // maxHeight만 뷰포트에서 나온다: "더보기"로 목록이 자라도 화면 밖으로 넘어가지 않게.
  const updatePopoverPosition = useCallback(() => {
    const el = wrapRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const margin = 8;
    const top = r.bottom + margin;
    const next = {
      top,
      right: Math.max(8, window.innerWidth - r.right),
      maxHeight: Math.max(180, window.innerHeight - top - margin),
    };
    // 스크롤 중 값이 그대로면 setState를 건너뛴다 — 새 객체를 넣으면 알림 목록 전체가
    // 매 스크롤 이벤트마다 다시 렌더된다.
    const prev = measuredRef.current;
    if (
      prev &&
      prev.top === next.top &&
      prev.right === next.right &&
      prev.maxHeight === next.maxHeight
    ) {
      return;
    }
    measuredRef.current = next;
    setPopoverStyle({ position: 'fixed', zIndex: POPOVER_Z, ...next });
  }, []);

  useLayoutEffect(() => {
    if (!open) return;
    updatePopoverPosition();
  }, [open, updatePopoverPosition]);

  useEffect(() => {
    if (!open) return;
    const onChange = () => updatePopoverPosition();
    window.addEventListener('resize', onChange);
    window.addEventListener('scroll', onChange, true);
    return () => {
      window.removeEventListener('resize', onChange);
      window.removeEventListener('scroll', onChange, true);
    };
  }, [open, updatePopoverPosition]);

  // 열 때 처음부터 다시 받는다(커서 없이). 이후 "더보기"는 커서로 이어 붙인다.
  useEffect(() => {
    if (!open) return;
    setVisibleCount(PAGE_STEP);
    void fetchNotifications(PAGE_STEP);
  }, [open, fetchNotifications]);

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
            className="min-w-[240px] overflow-y-auto overscroll-contain rounded-xl border border-stone-200/90 bg-white p-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
            style={popoverStyle}
            onClick={(e) => e.stopPropagation()}
            onPointerDown={(e) => e.stopPropagation()}
          >
            <NotificationList
              items={items}
              loading={listLoading}
              error={Boolean(listError)}
              listHasMore={listHasMore}
              visibleCount={visibleCount}
              onRequestMore={() => {
                // 이미 받아둔 게 남았으면 더 보여주고, 없으면 커서로 다음 페이지를 받는다.
                setVisibleCount((v) => v + PAGE_STEP);
                if (visibleCount + PAGE_STEP > items.length && listCursor) {
                  void fetchNotifications(PAGE_STEP, listCursor);
                }
              }}
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
