import { useNavigate } from 'react-router-dom';
import { Heart, Zap } from 'lucide-react';
import { useTrendingPosts, type TrendingPostRow } from '../hooks/useTrendingPosts.js';
import { getTrendingPostCategoryLabel } from '../utils/postMeta.js';

const SKELETON_COUNT = 10;

const RANK_CLASS = 'text-[#7c3aed] font-extrabold';
const CATEGORY_BADGE_CLASS =
  'inline-flex shrink-0 items-center rounded-full bg-violet-100 px-1 py-0.5 text-[11px] font-semibold leading-[1.1] text-violet-800';
const TITLE_BUTTON_CLASS =
  "min-w-0 flex-1 cursor-pointer truncate border-0 bg-transparent p-0 text-left font-['Pretendard',sans-serif] text-[15px] font-medium leading-snug text-[#0f172a] transition-colors duration-150 hover:text-[#b91c1c] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[rgba(185,28,28,0.4)]";

function _rowPadClass(rank: number): string {
  return rank > 5 ? 'lg:pl-0' : '';
}

function TrendingRowSkeleton({ rank }: { rank: number }) {
  return (
    <li
      className={[
        'flex min-w-0 items-center gap-1 rounded-[10px] px-1 py-0.5',
        _rowPadClass(rank),
      ].join(' ')}
    >
      <span className={`w-4 shrink-0 text-center text-[15px] tabular-nums ${RANK_CLASS}`}>{rank}</span>
      <span className="h-[20px] w-10 shrink-0 rounded-full bg-violet-100 [animation:postlist-skeleton-shimmer_1.1s_ease-in-out_infinite]" />
      <span className="h-[18px] min-w-0 flex-1 rounded bg-[rgba(15,23,42,0.08)] [animation:postlist-skeleton-shimmer_1.1s_ease-in-out_infinite]" />
      <span className="h-[16px] w-8 shrink-0 rounded bg-[rgba(15,23,42,0.06)] [animation:postlist-skeleton-shimmer_1.1s_ease-in-out_infinite]" />
    </li>
  );
}

function TrendingRow({
  post,
  rank,
  onOpen,
}: {
  post: TrendingPostRow;
  rank: number;
  onOpen: (id: string | number) => void;
}) {
  const categoryLabel = getTrendingPostCategoryLabel(post.categoryId);
  // 랭킹 점수에서 가장 무거운 신호가 좋아요다 — 행에 그 수치를 보여 순위를 납득시킨다.
  const likeCount = Number.isFinite(post.likeCount) ? post.likeCount : 0;

  return (
    <li
      className={[
        'flex w-full min-w-0 items-center gap-1 px-1 py-0.5',
        _rowPadClass(rank),
      ].join(' ')}
    >
      <span className={`w-4 shrink-0 text-center text-[15px] tabular-nums ${RANK_CLASS}`}>{rank}</span>
      <span className={CATEGORY_BADGE_CLASS}>{categoryLabel}</span>
      <button
        type="button"
        className={TITLE_BUTTON_CLASS}
        onClick={() => onOpen(post.id)}
        aria-label={`${rank}위 ${post.title}`}
      >
        {post.title}
      </button>
      <span
        className="flex shrink-0 items-center gap-0.5 text-[14px] tabular-nums text-[#64748b]"
        aria-label={`좋아요 ${likeCount}개`}
      >
        <Heart size={15} strokeWidth={2} aria-hidden className="opacity-80" />
        {likeCount}
      </span>
    </li>
  );
}

export function TrendingPosts() {
  const navigate = useNavigate();
  const { data: posts = [], isPending, isError, error } = useTrendingPosts();

  const handleOpen = (id: string | number) => {
    if (id == null || id === '') return;
    navigate(`/posts/${id}`);
  };

  if (!isPending && isError) {
    if (import.meta.env?.DEV) {
      console.warn('[TrendingPosts] API failed:', error?.message ?? error);
    }
    return null;
  }

  if (!isPending && posts.length === 0) {
    return null;
  }

  const displayPosts = isPending ? [] : posts.slice(0, SKELETON_COUNT);

  return (
    <section
      className="mb-4 w-full rounded-[16px] border border-[rgba(15,23,42,0.08)] bg-white px-3 py-3 shadow-[0_2px_12px_rgba(15,23,42,0.04)]"
      aria-label="실시간 인기게시물"
    >
      <div className="mb-2 flex items-center gap-2">
        <Zap size={18} className="shrink-0 text-[#f97316]" fill="#f97316" aria-hidden />
        <h2 className="text-[18px] font-extrabold tracking-[-0.02em] text-[#0f172a]">실시간 인기게시물</h2>
      </div>

      <ul
        className="m-0 grid list-none grid-cols-1 gap-y-0.5 p-0 lg:grid-flow-col lg:grid-cols-2 lg:grid-rows-5 lg:gap-x-8 lg:gap-y-0.5"
        aria-busy={isPending}
      >
        {isPending
          ? Array.from({ length: SKELETON_COUNT }, (_, i) => (
              <TrendingRowSkeleton key={`sk-${i + 1}`} rank={i + 1} />
            ))
          : displayPosts.map((post, idx) => (
              <TrendingRow key={post.id} post={post} rank={idx + 1} onOpen={handleOpen} />
            ))}
      </ul>
    </section>
  );
}
