// 공통 헤더: 제목, 뒤로가기, 프로필 드롭다운(로그아웃·회원정보/비밀번호 수정).

import {
  useState,
  useRef,
  useEffect,
  useMemo,
  type ReactNode,
  type SyntheticEvent,
} from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { api } from '../api/client.js';
import { safeImageUrl } from '../utils/index.js';
import { DEFAULT_PROFILE_IMAGE, HEADER_TITLE } from '../config.js';
import { NotificationBell } from './Notification/NotificationBell.jsx';
import { MessageCircle } from 'lucide-react';
import { useRecentChatRooms } from '../hooks/useRecentChatRooms';
import { useChatUiStore } from '../store/useChatUiStore';
import { ChatInboxPopover } from './Chat/ChatInboxPopover';

/** @see former mypage.css — 헤더 우측(알림+프로필+드롭다운) */
const HEADER_ACTIONS_CLASS =
  'absolute right-[25%] top-1/2 z-[215] flex -translate-y-1/2 flex-row items-center gap-[9px] max-md:right-4';

const HEADER_PROFILE_CLASS =
  'relative right-auto top-auto h-[38px] w-[38px] shrink-0 translate-y-0 cursor-pointer';

/* DM·알림 팝오버와 동일 톤(rounded-xl, slate border, 화이트·행 호버) */
const PROFILE_DROPDOWN_CLASS =
  'absolute right-0 top-[51px] z-[220] flex w-[116px] flex-col overflow-hidden rounded-xl border border-[#e5e7eb] bg-white p-0.5 max-md:right-4';

const PROFILE_DROPDOWN_BTN_CLASS =
  "flex min-h-[36px] w-full cursor-pointer items-center justify-center rounded-lg border-0 bg-transparent px-2 py-2 text-center font-['Pretendard',sans-serif] text-[12px] font-medium leading-snug text-[#111827] outline-none hover:bg-[#f8fafc] focus-visible:outline focus-visible:outline-2 focus-visible:outline-black focus-visible:outline-offset-1";
interface HeaderProps {
  children?: ReactNode;
  showBackButton?: boolean;
  backHref?: string;
  showProfile?: boolean;
}

export function Header({
  children,
  showBackButton = false,
  backHref = '/posts',
  showProfile = true,
}: HeaderProps) {
  const { user, isLoggedIn, clearUser } = useAuth();
  const navigate = useNavigate();
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const dropdownOpenRef = useRef(dropdownOpen);
  dropdownOpenRef.current = dropdownOpen;
  const chatAnchorRef = useRef<HTMLDivElement>(null);

  const toggleChatInbox = useChatUiStore((s) => s.toggleChatInbox);
  const closeChatInbox = useChatUiStore((s) => s.closeChatInbox);
  const isChatInboxOpen = useChatUiStore((s) => s.isChatInboxOpen);

  const { isRestored } = useAuth();
  // 뱃지는 전체 미읽음 합계를 보여주기 위해 넉넉한 limit로 조회(팝오버는 5/50 토글).
  const { unreadTotal } = useRecentChatRooms(Boolean(showProfile && isLoggedIn && isRestored), 50);
  const badgeText = useMemo(() => {
    const n = Number.isFinite(unreadTotal) ? unreadTotal : 0;
    if (n <= 0) return '';
    return n > 99 ? '99+' : String(n);
  }, [unreadTotal]);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (
        dropdownOpenRef.current &&
        dropdownRef.current &&
        !dropdownRef.current.contains(e.target as Node)
      ) {
        setDropdownOpen(false);
      }
    }
    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, []);

  useEffect(() => {
    if (!dropdownOpen) return;
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') setDropdownOpen(false);
    }
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [dropdownOpen]);

  const handleLogout = async () => {
    setDropdownOpen(false);
    try {
      await api.post('/auth/logout');
    } catch (_) {}
    clearUser();
    navigate('/login');
  };

  const profileImage = safeImageUrl(user?.profileImageUrl, DEFAULT_PROFILE_IMAGE) || DEFAULT_PROFILE_IMAGE;

  const handleProfileImgError = (e: SyntheticEvent<HTMLImageElement>) => {
    if (e.currentTarget.src !== DEFAULT_PROFILE_IMAGE) e.currentTarget.src = DEFAULT_PROFILE_IMAGE;
  };

  return (
    <>
      <header className="sticky top-0 z-[210] relative isolate w-full border-b border-[rgba(15,23,42,0.06)] bg-white py-4 shadow-[0_2px_6px_rgba(0,0,0,0.06)]">
        {showBackButton && (
          <button
            type="button"
            className="absolute left-[25%] top-1/2 z-10 inline-flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-[8px] border-0 bg-transparent p-0 cursor-pointer focus-visible:outline focus-visible:outline-2 focus-visible:outline-black focus-visible:outline-offset-2 max-md:left-4"
            id="header-back-btn"
            aria-label="뒤로 가기"
            onClick={() => navigate(backHref)}
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              className="h-[22px] w-[22px] text-[#1C1B1F]"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
        )}
        <h1 className="mx-auto mb-0 flex cursor-default justify-center px-14 text-center font-['Pretendard',sans-serif] text-[19px] font-normal leading-tight text-black max-md:px-11 [&_span]:leading-[inherit]">
          <Link
            to="/posts"
            id="header-title-link"
            className="inline-flex cursor-pointer items-center justify-center gap-0 text-black no-underline hover:text-black"
          >
            <span className="inline-flex items-center gap-2 [&>svg]:shrink-0">
              <svg
                className="text-[#111827] drop-shadow-[0_1px_0_rgba(255,255,255,0.55)]"
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
                aria-hidden="true"
                focusable="false"
              >
                <path
                  d="M7.2 10.1c1 0 1.8-.95 1.8-2.12S8.2 5.86 7.2 5.86 5.4 6.8 5.4 7.98 6.2 10.1 7.2 10.1Zm9.6 0c1 0 1.8-.95 1.8-2.12s-.8-2.12-1.8-2.12-1.8.95-1.8 2.12.8 2.12 1.8 2.12ZM11.1 8.9c.95 0 1.7-.88 1.7-1.97S12.05 5 11.1 5 9.4 5.88 9.4 6.93s.75 1.97 1.7 1.97Zm1.8 0c.95 0 1.7-.88 1.7-1.97S13.85 5 12.9 5s-1.7.88-1.7 1.97.75 1.97 1.7 1.97Z"
                  fill="currentColor"
                  opacity="0.9"
                />
                <path
                  d="M12 11.2c-3 0-5.6 2.05-5.6 4.6 0 1.7 1.5 3.1 3.4 3.1.95 0 1.65-.2 2.2-.55.55.35 1.25.55 2.2.55 1.9 0 3.4-1.4 3.4-3.1 0-2.55-2.6-4.6-5.6-4.6Z"
                  fill="currentColor"
                />
              </svg>
              <span>{HEADER_TITLE}</span>
            </span>
          </Link>
        </h1>
        {showProfile && isLoggedIn && (
          <div className={HEADER_ACTIONS_CLASS} ref={dropdownRef}>
            <NotificationBell />
            <div
              className={HEADER_PROFILE_CLASS}
              id="header-profile-btn"
              role="button"
              tabIndex={0}
              onClick={() => setDropdownOpen((v) => !v)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  setDropdownOpen((v) => !v);
                }
              }}
            >
              <div className="h-[38px] w-[38px] overflow-hidden rounded-full">
                <img
                  src={profileImage}
                  alt="프로필"
                  className="h-full w-full object-cover"
                  onError={handleProfileImgError}
                />
              </div>
            </div>
            <div
              className={`${PROFILE_DROPDOWN_CLASS} ${dropdownOpen ? 'flex' : 'hidden'}`}
              id="profile-dropdown"
            >
              <button
                type="button"
                className={PROFILE_DROPDOWN_BTN_CLASS}
                onClick={() => {
                  setDropdownOpen(false);
                  navigate('/mypage');
                }}
              >
                마이페이지
              </button>
              {user?.role === 'ADMIN' && (
                <button
                  type="button"
                  className={PROFILE_DROPDOWN_BTN_CLASS}
                  onClick={() => {
                    setDropdownOpen(false);
                    navigate('/admin/dashboard');
                  }}
                >
                  관리자 페이지
                </button>
              )}
              <button type="button" className={PROFILE_DROPDOWN_BTN_CLASS} onClick={handleLogout}>
                로그아웃
              </button>
            </div>

            {/* 프로필 드롭다운 버튼의 "오른쪽"에 배치 */}
            <div className="relative" ref={chatAnchorRef}>
              <button
                type="button"
                className={[
                  'relative inline-flex h-10 w-10 cursor-pointer items-center justify-center rounded-full border-0 bg-transparent text-stone-800 shadow-none',
                  'transition-opacity hover:opacity-80',
                  'focus-visible:outline focus-visible:outline-2 focus-visible:outline-black focus-visible:outline-offset-2',
                ].join(' ')}
                aria-label="채팅"
                aria-expanded={isChatInboxOpen}
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  toggleChatInbox();
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Escape') closeChatInbox();
                }}
              >
                <MessageCircle className="h-[22px] w-[22px]" strokeWidth={1.75} aria-hidden />
                {badgeText && (
                  <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 flex items-center justify-center rounded-full bg-rose-600 text-[10px] font-bold text-white leading-none">
                    {badgeText}
                  </span>
                )}
              </button>
              <ChatInboxPopover anchorRef={chatAnchorRef} />
            </div>
          </div>
        )}
        {showProfile && !isLoggedIn && (
          <button
            type="button"
            className="absolute right-[25%] top-1/2 inline-block -translate-y-1/2 rounded-[20px] border-0 bg-[var(--primary)] px-5 py-[6px] font-['Pretendard',sans-serif] text-[12px] font-bold leading-[12px] text-white cursor-pointer hover:bg-[var(--primary-hover)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[rgba(0,0,0,0.65)] focus-visible:outline-offset-2 focus-visible:rounded-[8px] max-md:right-4"
            onClick={() => navigate('/login')}
          >
            로그인
          </button>
        )}
      </header>
      {children}
    </>
  );
}
