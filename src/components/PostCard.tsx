// 게시글 목록 카드: 제목·메타·작성자·강아지·클릭 시 상세 이동.
import { Eye, Heart, Image, MessageCircle } from 'lucide-react';
import {
  escapeAttr,
  escapeHtml,
  formatDateTime,
  getProfileImageUrl,
  safeImageUrl,
  calculateDogAge,
  formatDogGenderLabel,
} from '../utils/index.js';
import { getPostCategoryLabel } from '../utils/postMeta.js';
import { DEFAULT_PROFILE_IMAGE } from '../config.js';
import { useAuth } from '../context/AuthContext.jsx';

interface RepresentativeDog {
  name?: string;
  gender?: string;
  breed?: string;
  birthDate?: string;
}

interface PostAuthor {
  nickname?: string;
  userId?: string;
  id?: string;
  profileImageUrl?: string | null;
  representativeDog?: RepresentativeDog | null;
  [key: string]: unknown;
}

export interface PostCardPost {
  id?: string;
  title?: string;
  contentPreview?: string;
  content?: string;
  likeCount?: number;
  commentCount?: number;
  viewCount?: number;
  author?: PostAuthor | null;
  files?: Array<{ fileUrl?: string; file_url?: string } & Record<string, unknown>>;
  fileCount?: number;
  imageCount?: number;
  categoryId?: string | number | null;
  categoryid?: string | number | null;
  category_id?: string | number | null;
  hashtags?: unknown;
  createdAt?: string;
  created_at?: string;
  [key: string]: unknown;
}

interface PostCardProps {
  post: PostCardPost;
  onClick?: () => void;
}

function AuthorBadge({ author }: { author: PostAuthor }) {
  const dog = author?.representativeDog;
  const name = escapeHtml(author?.nickname || '알 수 없음');
  if (!dog?.name) return <>{name}</>;
  const genderLabel = dog.gender ? (
    <span className="inline bg-transparent text-[1em] text-inherit">
      {formatDogGenderLabel(dog.gender)}
    </span>
  ) : null;
  const parts = [
    escapeHtml(dog.name),
    escapeHtml(dog.breed || ''),
    genderLabel,
    calculateDogAge(dog.birthDate),
  ].filter(Boolean);
  return (
    <>
      {name}
      <span className="ml-[6px] whitespace-nowrap text-[12px] text-[#666]">
        {' '}
        {parts.map((p, i) => (
          <span key={i}>
            {i > 0 && ' / '}
            {p}
          </span>
        ))}
      </span>
    </>
  );
}

/** 목록용 본문 미리보기: 첫 줄만, 길면 말줄임 */
function getContentExcerpt(content: unknown, maxLength = 80): string {
  if (!content || typeof content !== 'string') return '';
  const firstLine = content.trim().split(/\r?\n/)[0] || '';
  if (firstLine.length <= maxLength) return firstLine;
  return firstLine.slice(0, maxLength).trim() + '...';
}

export function PostCard({ post, onClick }: PostCardProps) {
  const { user } = useAuth();
  const postId = post.id;
  const title = post.title || '제목 없음';
  const contentPreview =
    post.contentPreview ??
    getContentExcerpt(post.content ?? '', 80);
  const likeCount = post.likeCount ?? 0;
  const commentCount = post.commentCount ?? 0;
  const viewCount = post.viewCount ?? 0;
  const author = post.author ?? null;
  const isMine = !!(
    user &&
    author &&
    (author.userId === user.userId || author.id === user.userId)
  );
  const authorAvatar = getProfileImageUrl(user, author, isMine, DEFAULT_PROFILE_IMAGE);
  const imgSrc =
    (authorAvatar && String(authorAvatar).trim()) ? authorAvatar : DEFAULT_PROFILE_IMAGE;
  const hasImages =
    (Array.isArray(post.files) && post.files.length > 0) ||
    Number(post.fileCount) > 0 ||
    Number(post.imageCount) > 0;
  const firstFile =
    Array.isArray(post.files) && post.files.length > 0 ? post.files[0] : null;
  const firstImageUrl = firstFile
    ? safeImageUrl(firstFile.fileUrl, '') || ''
    : '';
  const showThumb = Boolean(firstImageUrl);
  const categoryId = post.categoryId ?? null;
  const categoryLabel = getPostCategoryLabel(categoryId);
  const tagList = Array.isArray(post.hashtags) ? post.hashtags.map((t) => String(t)) : [];
  const createdAt = post.createdAt ?? '';

  const metaHeaderRow = (
    <div className="flex items-start justify-between gap-2">
      <div
        className="-ml-[6px] flex min-w-0 flex-1 flex-wrap items-start gap-2"
        aria-label="카테고리 및 해시태그"
      >
        <span className="inline-flex items-center rounded-full bg-violet-100 px-1.5 py-1 text-[11px] font-semibold leading-[1.1] text-violet-800">
          {escapeHtml(categoryLabel)}
        </span>
        {tagList.map((t, i) => (
          <span
            key={`${postId}-tag-${i}`}
            className="inline-flex items-center text-xs font-semibold leading-[1.2] text-sky-700"
          >
            #{escapeHtml(t)}
          </span>
        ))}
      </div>
      {createdAt ? (
        <span className="shrink-0 pt-0.5 text-right text-[11px] leading-tight text-[#777] tabular-nums sm:text-[12px]">
          {formatDateTime(createdAt)}
        </span>
      ) : null}
    </div>
  );

  const titleRow = (
    <div className="flex min-w-0 flex-wrap items-start gap-[6px]">
      <span className="min-w-0 flex-1 text-[16px] font-bold leading-snug text-black break-words">
        {title}
      </span>
      {hasImages && !showThumb ? (
        <span
          className="inline-flex shrink-0 items-center justify-center text-[#94a3b8]"
          title="사진이 있는 게시글"
          aria-hidden
        >
          <Image size={18} strokeWidth={2} />
        </span>
      ) : null}
    </div>
  );

  const excerptBlock = contentPreview ? (
    <p className="text-[13px] leading-[1.45] text-[#555] break-words line-clamp-3" title={contentPreview}>
      {contentPreview}
    </p>
  ) : null;

  return (
    <article
      className="w-full cursor-pointer rounded-[16px] bg-white pt-3 px-5 pb-[9px] shadow-[0px_3px_10px_rgba(0,0,0,0.08)] transition-transform duration-100 hover:-translate-y-[3px]"
      data-id={postId}
      role="listitem"
      onClick={onClick}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onClick?.();
        }
      }}
      tabIndex={0}
    >
      <div className="flex flex-col gap-[5px]">
        {metaHeaderRow}
        {showThumb ? (
          <div className="flex gap-4 items-start">
            <div className="flex min-h-0 min-w-0 flex-1 flex-col gap-[5px]">
              {titleRow}
              {excerptBlock}
            </div>
            <div className="shrink-0 self-start py-2 pl-2 pr-0">
              <div className="aspect-square w-[min(36vw,120px)] max-w-[120px] overflow-hidden rounded-2xl bg-[#e5e7eb] sm:w-[132px] sm:max-w-[132px]">
                <img
                  src={escapeAttr(firstImageUrl)}
                  alt=""
                  className="block h-full w-full object-cover"
                  loading="lazy"
                  onError={(e) => {
                    e.currentTarget.style.visibility = 'hidden';
                  }}
                />
              </div>
            </div>
          </div>
        ) : (
          <>
            {titleRow}
            {excerptBlock}
          </>
        )}
      </div>
      <div className="mb-[5px] h-px w-full bg-[#e5e5e5]" />
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-[10px]">
          <div className="h-[34px] w-[34px] shrink-0 overflow-hidden rounded-full bg-[#e5e7eb]">
            <img
              src={imgSrc}
              alt="작성자 프로필"
              className="block h-full w-full rounded-full object-cover"
              onError={(e) => {
                if (e.currentTarget.src !== DEFAULT_PROFILE_IMAGE) {
                  e.currentTarget.src = DEFAULT_PROFILE_IMAGE;
                }
              }}
            />
          </div>
          <span className="text-[14px] font-medium text-black">
            <AuthorBadge author={author ?? { nickname: '탈퇴한 사용자' }} />
          </span>
        </div>

        <div className="flex gap-3 text-[12px] text-[#64748b]" aria-label="게시글 통계">
          <span className="inline-flex items-center gap-[6px] leading-none" title={`좋아요 ${likeCount}`}>
            <Heart size={14} aria-hidden="true" />
            <span className="tabular-nums">{likeCount}</span>
          </span>
          <span className="inline-flex items-center gap-[6px] leading-none" title={`조회수 ${viewCount}`}>
            <Eye size={14} aria-hidden="true" />
            <span className="tabular-nums">{viewCount}</span>
          </span>
          <span className="inline-flex items-center gap-[6px] leading-none" title={`댓글 ${commentCount}`}>
            <MessageCircle size={14} aria-hidden="true" />
            <span className="tabular-nums">{commentCount}</span>
          </span>
        </div>
      </div>
    </article>
  );
}
