// 게시글 목록 본문: 로딩·에러·빈 목록·카드 리스트·loadingMore.
import type { ReactNode } from 'react';
import { PostCard, type PostCardPost } from '../PostCard.jsx';

interface PostListContentProps {
  loading: boolean;
  searchHint: string | null;
  error: string | null;
  posts: PostCardPost[];
  loadingMore: boolean;
  onCardClick: (id?: string) => void;
}

function FeedCenterMessage({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-[50vh] w-full flex-col items-center justify-center px-4">
      <p className="max-w-md text-center text-[16px] leading-relaxed text-black">{children}</p>
    </div>
  );
}

export function PostListContent({
  loading,
  searchHint,
  error,
  posts,
  loadingMore,
  onCardClick,
}: PostListContentProps) {
  const hasPosts = Array.isArray(posts) && posts.length > 0;
  const showInitialSkeleton = !hasPosts && loading;
  const blocked = Boolean(searchHint || error);
  return (
    <>
      {searchHint && <FeedCenterMessage>{searchHint}</FeedCenterMessage>}

      {!loading && error && !searchHint && <FeedCenterMessage>{error}</FeedCenterMessage>}

      {showInitialSkeleton && !blocked && (
        <div className="flex w-full flex-col gap-6 pb-10" aria-label="게시글 로딩">
          {Array.from({ length: 6 }).map((_, i) => (
            <div
              key={i}
              className="h-[150px] w-full rounded-[16px] bg-[linear-gradient(90deg,rgba(15,23,42,0.06)_0%,rgba(15,23,42,0.1)_30%,rgba(15,23,42,0.06)_60%)] bg-[length:240%_100%] [animation:postlist-skeleton-shimmer_1.1s_ease-in-out_infinite]"
            />
          ))}
        </div>
      )}

      {!loading && !blocked && !hasPosts && (
        <FeedCenterMessage>게시글이 없습니다.</FeedCenterMessage>
      )}

      {hasPosts && (
        <div className="flex w-full flex-col gap-4 pb-10" role="list">
          {(posts ?? []).map((post, index) => (
            <PostCard
              key={post?.id ?? index}
              post={post}
              onClick={() => onCardClick(post?.id)}
            />
          ))}
        </div>
      )}

      {loadingMore && (
        <div className="flex w-full justify-center py-6" aria-live="polite" aria-label="추가 게시글 로딩 중">
          <div className="app-skeleton-bar w-[min(280px,80%)]" />
        </div>
      )}
    </>
  );
}
