import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { useAuth } from '../../context/AuthContext.jsx';
import { useRecentChatRooms, type RecentChatRoom } from '../../hooks/useRecentChatRooms';
import { useChatUiStore } from '../../store/useChatUiStore';
import {
  calculateDogAge,
  escapeHtml,
  formatChatTime12h,
  formatDogGenderLabel,
  safeImageUrl,
} from '../../utils/index.js';
import { DEFAULT_PROFILE_IMAGE } from '../../config.js';

const POPOVER_CLASS =
  'absolute right-0 top-[51px] z-[220] w-[320px] rounded-xl border border-[#e5e7eb] bg-white';

function formatUpdatedAt(iso: string): string {
  if (!iso) return '';
  try {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return '';
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const startOfThatDay = new Date(d.getFullYear(), d.getMonth(), d.getDate());
    const dayDiff = Math.round((startOfToday.getTime() - startOfThatDay.getTime()) / 86_400_000);

    // 오늘: 시간만 — 말풍선 옆 시각과 같은 표기를 쓴다(한 화면에서 형식이 갈리지 않게).
    if (dayDiff === 0) return formatChatTime12h(d);

    // 어제: 라벨
    if (dayDiff === 1) return '어제';

    const isSameYear = d.getFullYear() === now.getFullYear();
    const y = d.getFullYear();
    const m = d.getMonth() + 1;
    const day = d.getDate();
    return isSameYear ? `${m}월 ${day}일` : `${y}년 ${m}월 ${day}일`;
  } catch {
    return '';
  }
}

/** 게시글·댓글 작성자 줄과 동일: 닉네임 오른쪽 대표견 텍스트(이름/견종/성별/나이). */
function PeerDogInlineMeta({ room }: { room: RecentChatRoom }) {
  const rawName = room.peerDogName != null ? String(room.peerDogName).trim() : '';
  if (!rawName) return null;

  const genderRaw = room.peerDogGender != null ? String(room.peerDogGender).trim() : '';
  const genderLabel =
    genderRaw !== '' ? (
      <span className="inline bg-transparent text-[1em] text-inherit">
        {formatDogGenderLabel(genderRaw)}
      </span>
    ) : null;

  const parts = [
    escapeHtml(rawName),
    escapeHtml(room.peerDogBreed != null ? String(room.peerDogBreed).trim() : ''),
    genderLabel,
    calculateDogAge(room.peerDogBirthDate != null ? String(room.peerDogBirthDate).trim() : ''),
  ].filter(Boolean);

  return (
    <span className="ml-[6px] inline whitespace-nowrap text-[12px] font-normal leading-[1.25] text-[#4b5563]">
      {' '}
      {parts.map((p, i) => (
        <span key={i}>
          {i > 0 && ' / '}
          {p}
        </span>
      ))}
    </span>
  );
}

export function ChatInboxPopover({ anchorRef }: { anchorRef: React.RefObject<HTMLElement | null> }) {
  const { isLoggedIn, isRestored } = useAuth();
  const enabled = Boolean(isLoggedIn && isRestored);
  const [showAll, setShowAll] = useState(false);
  // 기본(최근 5개) 화면에서도 "더 있음" 여부를 알기 위해 6개까지 가져온 뒤 5개만 렌더링
  const requestLimit = showAll ? 50 : 6;
  const { data, isLoading, isError, error } = useRecentChatRooms(enabled, requestLimit);

  const isOpen = useChatUiStore((s) => s.isChatInboxOpen);
  const close = useChatUiStore((s) => s.closeChatInbox);
  const openFloatingRoom = useChatUiStore((s) => s.openFloatingRoom);

  const popoverRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    setShowAll(false);
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') close();
    }
    function onDocClick(e: MouseEvent) {
      const t = e.target as Node | null;
      if (!t) return;
      if (popoverRef.current?.contains(t)) return;
      if (anchorRef.current?.contains(t)) return;
      close();
    }
    document.addEventListener('keydown', onKeyDown);
    document.addEventListener('click', onDocClick);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.removeEventListener('click', onDocClick);
    };
  }, [isOpen, close, anchorRef]);

  const rooms = useMemo(() => (Array.isArray(data) ? data : []), [data]);
  const canExpand = rooms.length > 5;
  const visibleRooms = useMemo(() => (showAll ? rooms : rooms.slice(0, 5)), [rooms, showAll]);

  const handleOpenRoom = useCallback(
    (r: RecentChatRoom) => {
      openFloatingRoom({
        roomId: r.roomId,
        peerUserId: r.peerUserId,
        title: r.title,
        peerProfileImageUrl: r.peerProfileImageUrl,
      });
    },
    [openFloatingRoom],
  );

  if (!isOpen) return null;

  return (
    <div ref={popoverRef} className={POPOVER_CLASS} role="dialog" aria-label="최근 대화 목록">
      <div className="flex items-center justify-between border-b border-[#f1f5f9] px-4 py-3">
        <h2 className="text-sm font-semibold text-[#111827]">DM 목록</h2>
        <button
          type="button"
          className="cursor-pointer rounded-md border-0 bg-transparent px-2 py-1 text-xs text-gray-500 hover:bg-gray-50"
          onClick={close}
          aria-label="닫기"
        >
          닫기
        </button>
      </div>

      <div className="max-h-[420px] overflow-y-auto p-2">
        {isLoading && (
          <p className="px-3 py-6 text-center text-sm text-gray-400" aria-live="polite">
            불러오는 중…
          </p>
        )}

        {!isLoading && !isError && rooms.length === 0 && (
          <div className="px-3 py-10 text-center">
            <p className="text-sm text-gray-400">아직 대화 내역이 없어요.</p>
            <p className="mt-2 text-xs text-gray-400">게시글에서 상대 프로필의 채팅으로 시작할 수 있어요.</p>
          </div>
        )}

        {isError && (
          <div className="px-3 py-8 text-center">
            <p className="text-sm text-red-600">대화 목록을 불러오지 못했습니다.</p>
            <p className="mt-2 text-xs text-gray-400">{error instanceof Error ? error.message : String(error ?? '')}</p>
          </div>
        )}

        {!isLoading && !isError && rooms.length > 0 && (
          <ul className="m-0 list-none flex flex-col gap-1 p-0">
            {visibleRooms.map((r) => (
              <li key={r.roomId}>
                <button
                  type="button"
                  className="flex w-full cursor-pointer items-start gap-3 rounded-lg border-0 bg-transparent px-3 py-2 text-left hover:bg-[#f8fafc] focus-visible:outline focus-visible:outline-2 focus-visible:outline-black focus-visible:outline-offset-2"
                  onClick={() => handleOpenRoom(r)}
                >
                  <div className="h-9 w-9 shrink-0 overflow-hidden rounded-full bg-[#e5e7eb]">
                    <img
                      src={safeImageUrl(r.peerProfileImageUrl, DEFAULT_PROFILE_IMAGE) || DEFAULT_PROFILE_IMAGE}
                      alt=""
                      className="h-full w-full object-cover"
                      loading="lazy"
                      decoding="async"
                      referrerPolicy="no-referrer"
                    />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex min-w-0 items-start justify-between gap-2">
                      <div className="inline-flex min-w-0 flex-1 flex-wrap items-baseline gap-x-1 gap-y-0.5 leading-[1.25]">
                        <span className="text-sm font-semibold text-[#111827]">{escapeHtml(r.title)}</span>
                        <PeerDogInlineMeta room={r} />
                      </div>
                      {r.unreadCount > 0 ? (
                        <span className="inline-flex h-5 shrink-0 min-w-5 items-center justify-center rounded-full bg-red-500 px-1.5 text-[11px] font-bold text-white">
                          {r.unreadCount > 99 ? '99+' : r.unreadCount}
                        </span>
                      ) : null}
                    </div>
                    <div className="mt-0.5 flex min-w-0 items-end justify-between gap-2">
                      <p className="min-w-0 flex-1 truncate text-left text-xs text-gray-500">
                        {r.lastMessagePreview || '최근 메시지가 없습니다.'}
                      </p>
                      {r.updatedAt ? (
                        <span className="shrink-0 self-end text-[11px] tabular-nums text-gray-400">
                          {formatUpdatedAt(r.updatedAt)}
                        </span>
                      ) : null}
                    </div>
                  </div>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {!isLoading && !isError && rooms.length > 0 && (canExpand || showAll) && (
        <div className="border-t border-[#f1f5f9] px-3 py-2">
          <button
            type="button"
            className="w-full cursor-pointer rounded-lg border border-[#e5e7eb] bg-white px-3 py-2 text-xs font-semibold text-[#111827] hover:bg-gray-50"
            onClick={() => setShowAll((v) => !v)}
            aria-label={showAll ? '접기' : '전체 보기'}
          >
            {showAll ? '접기' : '전체 보기'}
          </button>
        </div>
      )}
    </div>
  );
}

