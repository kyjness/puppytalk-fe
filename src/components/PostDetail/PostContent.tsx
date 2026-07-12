import { useState, type ReactNode } from 'react';
import { MoreHorizontal, UserX, AlertTriangle, MessageCircle } from 'lucide-react';
import { DEFAULT_PROFILE_IMAGE } from '../../config.js';
import {
  escapeHtml,
  escapeAttr,
  safeImageUrl,
  formatDateTime,
  calculateDogAge,
  formatDogGenderLabel,
} from '../../utils/index.js';
import { getPostCategoryLabel } from '../../utils/postMeta.js';
import {
  COMMENT_ITEM_MENU_BACKDROP,
  COMMENT_ITEM_MENU_POST_DETAIL,
  COMMENT_ITEM_MENU_TRIGGER,
  MENU_ITEM_BTN_DANGER,
  COMMENT_ITEM_EDITED,
} from './commentClasses.js';
import { useNavigateToDirectChat } from '../../hooks/useNavigateToDirectChat.js';

interface RepresentativeDog {
  name?: string;
  gender?: string;
  breed?: string;
  birthDate?: string;
  birth_date?: string;
}

interface PostContentPost {
  title?: string;
  content?: string;
  category_id?: string | number | null;
  hashtags?: unknown;
  isEdited?: boolean;
  isMine?: boolean;
  author_id?: string | null;
  authorId?: string | null;
  author_nickname?: string;
  authorNickname?: string;
  author_profile_image?: string;
  author_representative_dog?: unknown;
  created_at?: string;
  likes?: number;
  views?: number;
  commentCount?: number;
}

interface PostContentProps {
  post: PostContentPost | null;
  postId: string;
  message: string;
  uniqueFiles: { fileUrl?: string | null }[];
  commentTotalCount: number;
  onLike: () => void;
  onEdit: (path: string) => void;
  onDeleteOpen: () => void;
  onBlockUser?: (authorId: string) => void;
  onReportOpen?: () => void;
  currentUserId?: string | null;
  children?: ReactNode;
}

export function PostContent({
  post,
  postId,
  message,
  uniqueFiles,
  commentTotalCount,
  onLike,
  onEdit,
  onDeleteOpen,
  onBlockUser,
  onReportOpen,
  currentUserId,
  children,
}: PostContentProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const { go: goToDirectChat, busy: dmBusy } = useNavigateToDirectChat();
  if (!post) return null;

  const authorId = post.authorId ?? post.author_id;
  const nickname = post.authorNickname ?? post.author_nickname ?? '';
  const authorProfileImage = post?.author_profile_image || DEFAULT_PROFILE_IMAGE;

  // 타인 글이면(작성자 탈퇴/파기 포함) 신고 노출. 차단은 로그인 + author_id 존재 시에만.
  const showPostReport = Boolean(!post.isMine);
  const showBlockInPostMenu =
    currentUserId != null &&
    authorId != null &&
    String(authorId) !== String(currentUserId) &&
    !post.isMine;
  const showDmButton =
    currentUserId != null &&
    !post.isMine &&
    authorId != null &&
    String(authorId) !== String(currentUserId);

  const categoryLabel = getPostCategoryLabel(post?.category_id);
  const tagList = Array.isArray(post?.hashtags) ? post.hashtags : [];
  const representativeDog = (post?.author_representative_dog ?? null) as RepresentativeDog | null;
  const hasRepresentativeDog = Boolean(representativeDog?.name);

  return (
    <section className="w-full">
      <div className="mb-[5px] flex flex-wrap items-center gap-2">
        <span
          className="post-category-chip inline-flex items-center rounded-full bg-violet-100 px-1.5 py-1 text-[11px] leading-[1.1] font-semibold text-violet-800 ring-1 ring-inset ring-violet-200"
          title="카테고리"
        >
          {escapeHtml(categoryLabel)}
        </span>
      </div>
      <h2 className="mb-[5px] text-[20px] font-bold leading-[1.35] text-black">
        {escapeHtml(post?.title ?? '')}
      </h2>
      <div className="mb-[5px] flex items-end justify-between">
        <div className="flex items-start gap-3">
          <div className="h-9 w-9 shrink-0 overflow-hidden rounded-full bg-[#e5e7eb]">
            <img
              src={post?.author_profile_image || DEFAULT_PROFILE_IMAGE}
              alt="작성자 프로필"
              className="w-full h-full object-cover rounded-full block"
            />
          </div>
          <div className="flex flex-col gap-[6px]">
            {showDmButton && !hasRepresentativeDog ? (
              <div className="flex flex-wrap items-center gap-x-2">
                <span className="text-[13px] font-semibold leading-[1.25] text-black">
                  {escapeHtml(nickname || '작성자')}
                </span>
                <button
                  type="button"
                  disabled={dmBusy}
                  aria-label="메시지 보내기"
                  className="inline-flex shrink-0 cursor-pointer items-center justify-center border-0 bg-transparent p-0.5 text-[#64748b] shadow-none outline-none transition-colors hover:text-blue-500 focus-visible:outline-none focus-visible:ring-0 disabled:cursor-not-allowed disabled:opacity-60"
                  onClick={() => goToDirectChat(authorId, nickname, authorProfileImage)}
                >
                  <MessageCircle
                    size={18}
                    strokeWidth={2}
                    className="block shrink-0 -translate-y-0.5"
                    aria-hidden
                  />
                </button>
              </div>
            ) : (
              <div className={showDmButton && hasRepresentativeDog ? 'relative pr-8' : ''}>
                <span className="text-[13px] font-semibold leading-[1.25] text-black">
                  {escapeHtml(nickname || '작성자')}
                  {hasRepresentativeDog && (
                    <span className="ml-[6px] whitespace-nowrap text-[12px] font-normal text-[#4b5563]">
                      {' '}
                      {(() => {
                        const d = representativeDog as RepresentativeDog;
                        const genderLabel = d.gender ? (
                          <span className="inline bg-transparent text-[1em] text-inherit">
                            {formatDogGenderLabel(d.gender)}
                          </span>
                        ) : null;
                        const parts = [
                          escapeHtml(d.name),
                          escapeHtml(d.breed || ''),
                          genderLabel,
                          calculateDogAge(d.birthDate ?? d.birth_date),
                        ].filter(Boolean);
                        return parts.map((p, i) => (
                          <span key={i}>
                            {i > 0 && ' / '}
                            {p}
                          </span>
                        ));
                      })()}
                    </span>
                  )}
                </span>
                {showDmButton && hasRepresentativeDog ? (
                  <button
                    type="button"
                    disabled={dmBusy}
                    aria-label="메시지 보내기"
                    className="absolute top-0 right-0 inline-flex cursor-pointer items-center justify-center border-0 bg-transparent p-0.5 text-[#64748b] shadow-none outline-none transition-colors hover:text-blue-500 focus-visible:outline-none focus-visible:ring-0 disabled:cursor-not-allowed disabled:opacity-60"
                    onClick={() => goToDirectChat(authorId, nickname, authorProfileImage)}
                  >
                    <MessageCircle
                      size={18}
                      strokeWidth={2}
                      className="block shrink-0 -translate-y-0.5"
                      aria-hidden
                    />
                  </button>
                ) : null}
              </div>
            )}
            <span className="text-[12px] text-[#64748b]">
              {formatDateTime(post?.created_at)}
              {post?.isEdited ? <span className={COMMENT_ITEM_EDITED}> (수정됨)</span> : null}
            </span>
          </div>
        </div>
        {(post?.isMine || showPostReport) && (
          <div className="flex shrink-0 items-center gap-2 ml-3">
            {post?.isMine && (
              <div className="inline-flex items-center gap-3">
                <button
                  type="button"
                  className="h-auto min-w-0 cursor-pointer border-0 bg-transparent p-0 text-[11.5px] text-[#333] no-underline transition-colors duration-150 hover:text-[#111]"
                  onClick={() => onEdit(`/posts/${postId}/edit`)}
                >
                  수정
                </button>
                <button
                  type="button"
                  className="h-auto min-w-0 cursor-pointer border-0 bg-transparent p-0 text-[11.5px] text-[#333] no-underline transition-colors duration-150 hover:text-[#111]"
                  onClick={onDeleteOpen}
                >
                  삭제
                </button>
              </div>
            )}
            {showPostReport && (
              <div className="relative">
                <button
                  type="button"
                  className={COMMENT_ITEM_MENU_TRIGGER}
                  onClick={() => setMenuOpen((o) => !o)}
                  aria-label="메뉴"
                  aria-expanded={menuOpen}
                >
                  <MoreHorizontal size={18} aria-hidden />
                </button>
                {menuOpen && (
                  <>
                    <div
                      className={COMMENT_ITEM_MENU_BACKDROP}
                      role="presentation"
                      aria-hidden="true"
                      onClick={() => setMenuOpen(false)}
                    />
                    <ul className={COMMENT_ITEM_MENU_POST_DETAIL}>
                      {showBlockInPostMenu ? (
                        <li>
                          <button
                            type="button"
                            className={MENU_ITEM_BTN_DANGER}
                            onClick={() => {
                              if (authorId != null) onBlockUser?.(String(authorId));
                              setMenuOpen(false);
                            }}
                          >
                            <UserX size={15} aria-hidden className="block shrink-0" />
                            차단
                          </button>
                        </li>
                      ) : null}
                      <li>
                        <button
                          type="button"
                          className={MENU_ITEM_BTN_DANGER}
                          onClick={() => {
                            onReportOpen?.();
                            setMenuOpen(false);
                          }}
                        >
                          <AlertTriangle size={15} aria-hidden className="block shrink-0" />
                          신고
                        </button>
                      </li>
                    </ul>
                  </>
                )}
              </div>
            )}
          </div>
        )}
      </div>
      <div className="my-[5px] h-px w-full bg-[rgba(15,23,42,0.08)]" />
      {uniqueFiles.length > 0 && (
        <div className="my-5 flex flex-wrap justify-center gap-3">
          {uniqueFiles.map((f, i) => {
            const url = safeImageUrl(f.fileUrl, '');
            return url ? (
              <div key={i} className="w-full max-w-[300px] h-[260px] rounded-xl bg-gray-300 overflow-hidden flex items-center justify-center flex-1 min-w-[200px]">
                <img
                  src={escapeAttr(url)}
                  alt="게시글 이미지"
                  className="w-full h-full object-cover object-center"
                />
              </div>
            ) : null;
          })}
      </div>
      )}
      <p className="my-5 whitespace-pre-line text-[14px] leading-[1.6] text-[#1f2937]">
        {escapeHtml(String(post?.content || '내용이 없습니다.').trim())}
      </p>
      {tagList.length > 0 ? (
        <div className="my-[5px] flex flex-wrap gap-2" aria-label="해시태그">
          {tagList.map((t, i) => (
            <span
              key={`${t}-${i}`}
              className="inline-flex items-center bg-transparent p-0 text-[13px] font-semibold leading-[1.2] text-sky-700"
            >
              #{escapeHtml(String(t))}
            </span>
          ))}
        </div>
      ) : null}
      <div className="my-[5px] flex justify-center gap-3">
        <div
          className="w-20 h-14 rounded-xl bg-gray-300 flex flex-col items-center justify-center cursor-pointer"
          id="like-stat-box"
          onClick={onLike}
        >
          <span className="text-[15px] font-bold mb-1 text-black">{post?.likes ?? 0}</span>
          <span className="text-[10px] font-bold text-black">좋아요수</span>
        </div>
        <div className="w-20 h-14 rounded-xl bg-gray-300 flex flex-col items-center justify-center">
          <span className="text-[15px] font-bold mb-1 text-black">{post?.views ?? 0}</span>
          <span className="text-[10px] font-bold text-black">조회수</span>
        </div>
        <div className="w-20 h-14 rounded-xl bg-gray-300 flex flex-col items-center justify-center">
          <span className="text-[15px] font-bold mb-1 text-black">
            {post?.commentCount ?? commentTotalCount ?? 0}
          </span>
          <span className="text-[10px] font-bold text-black">댓글</span>
        </div>
      </div>
      <div className="my-[5px] h-px w-full bg-[rgba(15,23,42,0.08)]" />
      {message && (
        <span
          className="mt-[2px] block min-h-[14px] font-['Pretendard',sans-serif] text-[12px] font-normal leading-[12px] text-[#FF0000]"
          id="post-detail-message"
        >
          * {message}
        </span>
      )}
      {children}
    </section>
  );
}
