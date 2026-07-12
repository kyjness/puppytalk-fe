// 게시글 목록 페이지: usePostList 훅 + PostList 하위 컴포넌트 조합.
import { useNavigate } from 'react-router-dom';
import { useState, useEffect, useRef } from 'react';
import { Pencil, Search, X } from 'lucide-react';
import { Header } from '../components/Header.jsx';
import { DogProfileBanner } from '../components/DogProfileBanner.jsx';
import { TrendingHashtags } from '../components/TrendingHashtags.jsx';
import { TrendingPosts } from '../components/TrendingPosts.jsx';
import { usePostList } from '../hooks/usePostList.js';
import {
  PostListContent,
} from '../components/PostList';
import { useAuth } from '../context/AuthContext.jsx';
import { POST_CATEGORY_OPTIONS } from '../utils/postMeta.js';

const RAIL_ASIDE_LEFT_FIXED =
  'hidden lg:block fixed z-[25] isolate pt-1 [contain:inline-size] overflow-visible';

const RAIL_ASIDE_RIGHT_FIXED =
  'hidden lg:block fixed z-[25] isolate pt-1 [contain:inline-size] max-h-[calc(100dvh-var(--postlist-rail-top)-1rem)] overflow-y-auto overscroll-y-contain';

export function PostList() {
  const navigate = useNavigate();
  const { user, isLoggedIn } = useAuth();
  const [showScrollTop, setShowScrollTop] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const onScroll = () => setShowScrollTop(window.scrollY > 300);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const {
    posts,
    loading,
    loadingMore,
    error,
    searchHint,
    prefetchCategory,
    searchTerm,
    setSearchTerm,
    debouncedSearch,
    categoryId,
    setCategoryId,
    bottomRef,
  } = usePostList();

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [categoryId]);

  const handleWriteClick = () => {
    if (isLoggedIn) {
      navigate('/posts/new');
    } else {
      if (window.confirm('로그인이 필요한 서비스입니다. 로그인 페이지로 이동할까요?')) {
        navigate('/login');
      }
    }
  };

  const handleCardClick = (postId?: string) => {
    navigate(`/posts/${postId}`);
  };

  const showPopular =
    categoryId === 'all' && debouncedSearch.trim() === '' && !searchHint;

  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <Header showProfile={true}>
      <div className="mx-auto w-full max-w-[var(--content-max)] px-[16px]">
        <DogProfileBanner user={user} />
      </div>
      <main className="relative flex min-h-[calc(100dvh-5rem)] flex-1 items-stretch justify-center bg-[var(--app-bg)] px-[16px] pt-[8px] [overflow-anchor:none]">
        <div className="post-list-rail-anchor relative mx-auto w-full max-w-[var(--postlist-inner-w)]">
          <aside
            className={`${RAIL_ASIDE_LEFT_FIXED} top-[var(--postlist-rail-top)] w-[260px] lg:left-[var(--postlist-rail-left)]`}
            aria-label="카테고리"
          >
            <nav className="flex flex-col items-center gap-2 px-2 py-3" aria-label="게시글 카테고리">
              <button
                type="button"
                onClick={() => setCategoryId('all')}
                onMouseEnter={() => prefetchCategory('all')}
                aria-current={categoryId === 'all' ? 'page' : undefined}
                className={[
                  "w-full cursor-pointer border-0 bg-transparent px-2 py-2 text-center font-['Pretendard',sans-serif] text-[17px] font-bold leading-[1.25] tracking-[-0.02em] transition-colors duration-150 ease-out focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[rgba(15,23,42,0.45)] focus-visible:rounded-[10px]",
                  categoryId === 'all'
                    ? 'text-[#0f172a] font-extrabold'
                    : 'text-[rgba(15,23,42,0.28)] hover:text-[rgba(15,23,42,0.6)]',
                ].join(' ')}
              >
                전체
              </button>
              {POST_CATEGORY_OPTIONS.map((c) => {
                const v = String(c.id);
                const active = categoryId === v;
                return (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => setCategoryId(v)}
                    onMouseEnter={() => prefetchCategory(v)}
                    aria-current={active ? 'page' : undefined}
                    className={[
                      "w-full cursor-pointer border-0 bg-transparent px-2 py-2 text-center font-['Pretendard',sans-serif] text-[18px] font-bold leading-[1.25] tracking-[-0.02em] transition-colors duration-150 ease-out focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[rgba(15,23,42,0.45)] focus-visible:rounded-[10px]",
                      active
                        ? 'text-[#0f172a] font-extrabold'
                        : 'text-[rgba(15,23,42,0.28)] hover:text-[rgba(15,23,42,0.6)]',
                    ].join(' ')}
                  >
                    {c.label}
                  </button>
                );
              })}
            </nav>
            <div className="mt-2 px-0 pb-4">
              <TrendingHashtags />
            </div>
          </aside>

          <aside
            className={`${RAIL_ASIDE_RIGHT_FIXED} top-[var(--postlist-rail-top)] w-[220px] lg:right-[var(--postlist-rail-right)] px-1`}
            aria-label="게시글 검색"
          >
            <div className="relative w-full">
              <button
                type="button"
                className="absolute left-1 top-1/2 z-[1] flex h-7 w-7 -translate-y-1/2 cursor-pointer items-center justify-center rounded-lg border-0 bg-transparent text-[rgba(15,23,42,0.55)] transition-colors hover:bg-[rgba(15,23,42,0.06)] hover:text-[rgba(15,23,42,0.85)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-[rgba(15,23,42,0.35)]"
                aria-label="검색"
                onClick={() => searchInputRef.current?.focus()}
              >
                <Search size={18} aria-hidden />
              </button>
              <input
                ref={searchInputRef}
                type="text"
                placeholder="검색"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className={[
                  "h-9 w-full rounded-[12px] border border-[rgba(15,23,42,0.12)] bg-white py-0 pl-[38px] font-['Pretendard',sans-serif] text-[14px] outline-none focus:border-[rgba(15,23,42,0.28)] placeholder:text-[rgba(15,23,42,0.45)]",
                  searchTerm.trim().startsWith('#')
                    ? 'text-sky-700 font-semibold'
                    : 'text-[#0f172a] font-normal',
                  searchTerm.trim() !== '' ? 'pr-9' : 'pr-3',
                ].join(' ')}
                aria-label="게시글 검색"
              />
              {searchTerm.trim() !== '' && (
                <button
                  type="button"
                  className="absolute right-1 top-1/2 z-[1] flex h-7 w-7 -translate-y-1/2 cursor-pointer items-center justify-center rounded-lg border-0 bg-transparent text-[rgba(15,23,42,0.45)] transition-colors hover:bg-[rgba(15,23,42,0.06)] hover:text-[rgba(15,23,42,0.75)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-[rgba(15,23,42,0.35)]"
                  aria-label="검색어 지우기"
                  onClick={() => {
                    setSearchTerm('');
                    searchInputRef.current?.focus();
                  }}
                >
                  <X size={16} strokeWidth={2.25} aria-hidden />
                </button>
              )}
            </div>
          </aside>

          <div className="flex w-full items-start justify-center gap-2 lg:gap-0">
            <div className="hidden lg:block w-[260px] shrink-0" aria-hidden="true" />
            <div className="w-full max-w-[var(--postlist-feed-max)] flex-none shrink-0 self-stretch mx-auto lg:mx-0 lg:px-2">
              <div className="mx-auto flex w-full max-w-[var(--postlist-feed-max)] flex-col items-center justify-start">
                <div
                  className={[
                    'w-full min-h-[50vh] transition-opacity duration-200 ease-in-out',
                    loading ? 'opacity-50 pointer-events-none' : '',
                  ].join(' ')}
                >
                  {showPopular && <TrendingPosts />}
                  <PostListContent
                    loading={loading}
                    searchHint={searchHint}
                    error={error}
                    posts={posts}
                    loadingMore={loadingMore}
                    onCardClick={handleCardClick}
                  />
                </div>
                <div ref={bottomRef} style={{ height: '20px' }} aria-hidden="true" />
              </div>
            </div>
            <div className="hidden lg:block w-[220px] shrink-0" aria-hidden="true" />
          </div>
        </div>
      </main>
      <button
        type="button"
        className="fixed right-6 z-[95] flex h-[44px] w-[44px] cursor-pointer items-center justify-center rounded-[20px] border border-[rgba(255,255,255,0.42)] bg-[linear-gradient(135deg,rgba(129,140,248,0.95)_0%,rgba(168,85,247,0.95)_100%)] p-0 text-white shadow-[0_12px_24px_-6px_rgba(172,160,235,0.5)] backdrop-blur-[12px] transition-[transform,box-shadow,filter,border-color] duration-[180ms] ease-out hover:scale-110 hover:brightness-[1.02] hover:saturate-[1.08] hover:border-[rgba(255,255,255,0.6)] hover:shadow-[0_14px_30px_-6px_rgba(172,160,235,0.62)] active:scale-95"
        onClick={handleWriteClick}
        aria-label="게시글 작성"
        style={{
          bottom: showScrollTop ? 84 : 24,
        }}
      >
        <Pencil size={18} strokeWidth={2.2} color="#fff" aria-hidden="true" />
      </button>
      {showScrollTop && (
        <button
          type="button"
          className="fixed right-6 bottom-6 z-[90] flex h-[44px] w-[44px] cursor-pointer items-center justify-center rounded-[20px] border border-[rgba(255,255,255,0.42)] bg-[linear-gradient(135deg,rgba(96,165,250,0.92)_0%,rgba(129,140,248,0.92)_45%,rgba(168,85,247,0.92)_100%)] p-0 text-[18px] leading-none text-white shadow-[0_12px_24px_-6px_rgba(138,180,255,0.45)] backdrop-blur-[12px] transition-[transform,box-shadow,filter,border-color] duration-[180ms] ease-out hover:scale-110 hover:brightness-[1.02] hover:saturate-[1.08] hover:border-[rgba(255,255,255,0.6)] hover:shadow-[0_14px_30px_-6px_rgba(138,180,255,0.62)] active:scale-95"
          onClick={scrollToTop}
          aria-label="맨 위로"
        >
          ↑
        </button>
      )}
    </Header>
  );
}
