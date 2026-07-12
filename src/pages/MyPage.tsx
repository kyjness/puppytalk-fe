// 통합 마이페이지: 사이드바 네비게이션 + 탭별 컨텐츠.
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Header } from '../components/Header.jsx';
import {
  ProfileEdit,
  PasswordEdit,
  DogManagement,
  BlockManagement,
} from '../components/MyPage';

const TAB_KEY = 'tab';
const TABS = [
  { key: 'profile', label: '내 정보 수정' },
  { key: 'password', label: '비밀번호 수정' },
  { key: 'dogs', label: '반려견 관리' },
  { key: 'blocks', label: '차단 관리' },
];

const VALID_KEYS = new Set(TABS.map((t) => t.key));

function getValidTab(searchTab: string | null): string {
  return searchTab && VALID_KEYS.has(searchTab) ? searchTab : 'profile';
}

export function MyPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const activeTab = getValidTab(searchParams.get(TAB_KEY));
  const navRef = useRef<HTMLElement>(null);
  const [mobileNavHeight, setMobileNavHeight] = useState(200);

  const setTab = (key: string) => {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      next.set(TAB_KEY, key);
      return next;
    });
  };

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [activeTab]);

  useLayoutEffect(() => {
    const el = navRef.current;
    if (!el || typeof ResizeObserver === 'undefined') return;
    const update = () => setMobileNavHeight(el.offsetHeight);
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, [activeTab]);

  return (
    <Header showBackButton backHref="/posts">
      <main className="flex w-full flex-1 flex-col items-center justify-start bg-[var(--app-bg)] px-[16px] py-[8px] min-h-[calc(100dvh-5rem)]">
        <div className="flex w-full max-w-[1100px] flex-1 items-stretch justify-center max-md:flex-col max-md:px-4 max-md:items-start">
          <div className="flex flex-1 min-w-0 flex-col self-start justify-end pr-6 max-md:flex-none max-md:w-full max-md:justify-start max-md:pr-0 md:flex-row md:justify-end">
            <div
              className="hidden shrink-0 max-md:block md:hidden"
              style={{ height: mobileNavHeight }}
              aria-hidden
            />
            <nav
              ref={navRef}
              className="w-[160px] shrink-0 self-start text-left md:sticky md:top-[var(--header-sidebar-offset)] max-md:fixed max-md:left-0 max-md:right-0 max-md:top-[var(--header-sidebar-offset)] max-md:z-[25] max-md:w-full max-md:bg-[var(--app-bg)] max-md:px-8"
              aria-label="마이페이지 메뉴"
            >
              <ul className="m-0 flex list-none flex-col gap-1 p-0">
                {TABS.map(({ key, label }) => (
                  <li key={key}>
                    <button
                      type="button"
                      className={[
                        "block w-full rounded-[8px] border-0 px-4 py-3 text-left font-['Pretendard',sans-serif] text-[14px] transition-colors cursor-pointer",
                        activeTab === key
                          ? 'bg-[#1f2937] text-white font-semibold'
                          : 'bg-[#f3f4f6] text-[#374151] hover:bg-[#e5e7eb] hover:text-black',
                      ].join(' ')}
                      onClick={() => setTab(key)}
                      aria-current={activeTab === key ? 'page' : undefined}
                    >
                      {label}
                    </button>
                  </li>
                ))}
              </ul>
            </nav>
          </div>
          <div className="flex w-[600px] max-w-[92vw] shrink-0 self-stretch flex-col items-start justify-center px-4 py-6 text-left max-md:w-full max-md:max-w-full max-md:self-start max-md:justify-start max-md:px-0 max-md:py-6">
            {activeTab === 'profile' && <ProfileEdit />}
            {activeTab === 'password' && <PasswordEdit />}
            {activeTab === 'dogs' && <DogManagement />}
            {activeTab === 'blocks' && <BlockManagement />}
          </div>
          <div className="flex flex-1 min-w-0 max-md:hidden" aria-hidden="true" />
        </div>
      </main>
    </Header>
  );
}
