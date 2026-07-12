// 강아지 미등록 유저 배너: 노출 시 회원정보 수정 유도, X 클릭 시 7일간 숨김.
import { useState, useEffect, type MouseEvent as ReactMouseEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import type { AuthUser } from '../context/AuthContext.jsx';

const BANNER_DISMISSED_KEY = 'dogProfileBannerDismissed';
const DISMISS_DAYS = 7;
const DISMISS_MS = DISMISS_DAYS * 24 * 60 * 60 * 1000;

function isDismissedWithinPeriod() {
  try {
    const raw = localStorage.getItem(BANNER_DISMISSED_KEY);
    if (raw == null) return false;
    const ts = Number(raw);
    if (Number.isNaN(ts)) return false;
    return Date.now() - ts < DISMISS_MS;
  } catch {
    return false;
  }
}

export function DogProfileBanner({ user }: { user: AuthUser | null }) {
  const navigate = useNavigate();
  const [dismissed, setDismissed] = useState(isDismissedWithinPeriod);

  const hasNoDogs = user && (!user.dogs || user.dogs.length === 0);
  const hasDogs = user && Array.isArray(user.dogs) && user.dogs.length > 0;
  const show = hasNoDogs && !dismissed;

  // 강아지 없을 때만: 마운트/유저 로드 시 localStorage 기준으로 다시 계산 (다른 탭·새로고침 대응)
  useEffect(() => {
    if (hasNoDogs) {
      setDismissed(isDismissedWithinPeriod());
    }
  }, [hasNoDogs]);

  // 강아지를 실제로 등록한 경우에만 배너 숨김 상태 초기화 (user가 null이면 초기화하지 않음)
  useEffect(() => {
    if (hasDogs) {
      try {
        localStorage.removeItem(BANNER_DISMISSED_KEY);
      } catch (_) {}
      setDismissed(false);
    }
  }, [hasDogs]);

  const handleDismiss = (e: ReactMouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    try {
      localStorage.setItem(BANNER_DISMISSED_KEY, String(Date.now()));
    } catch (_) {}
    setDismissed(true);
  };

  if (!show) return null;

  return (
    <div
      className="relative w-full my-2 mb-[10px] cursor-pointer rounded-[10px] border border-[rgba(245,158,11,0.25)] bg-[linear-gradient(135deg,#fffbeb_0%,#fef3c7_100%)] px-4 py-2 pr-[44px] shadow-[0_1px_8px_rgba(245,158,11,0.06)] transition-[box-shadow,border-color,background] duration-200 hover:border-[rgba(245,158,11,0.4)] hover:bg-[linear-gradient(135deg,#fef3c7_0%,#fde68a_100%)]"
      role="button"
      tabIndex={0}
      onClick={() => navigate('/mypage?tab=dogs')}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          navigate('/mypage?tab=dogs');
        }
      }}
    >
      <span className="block text-center text-[14px] leading-[1.4] text-[#78350f]">
        아직 우리 아이를 등록하지 않으셨나요?
        <span className="ml-1 font-semibold text-[#b45309]">🐶 등록하러 가기</span>
      </span>
      <button
        type="button"
        className="absolute right-2 top-1/2 flex h-[26px] w-[26px] -translate-y-1/2 items-center justify-center rounded-[6px] border-0 bg-transparent p-0 text-[18px] leading-none text-[#a16207] cursor-pointer transition-[color,background-color] duration-150 hover:bg-[rgba(245,158,11,0.15)] hover:text-[#78350f]"
        aria-label="배너 닫기"
        onClick={handleDismiss}
      >
        ×
      </button>
    </div>
  );
}
