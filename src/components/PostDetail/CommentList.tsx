import React, {
  useState,
  useRef,
  useEffect,
  useCallback,
  useMemo,
  type Dispatch,
  type SetStateAction,
  type FormEvent,
} from 'react';
import { Heart, MoreHorizontal, UserX, AlertTriangle, MessageCircle } from 'lucide-react';
import { escapeHtml, formatDateTime, calculateDogAge, formatDogGenderLabel } from '../../utils/index.js';
import { DEFAULT_PROFILE_IMAGE } from '../../config.js';
import { useNavigateToDirectChat } from '../../hooks/useNavigateToDirectChat.js';
import type { CommentNode } from '../../hooks/usePostDetail.js';
import * as CC from './commentClasses.js';

interface RepresentativeDog {
  name?: string;
  gender?: string;
  breed?: string;
  birthDate?: string;
}

interface CommentEditState {
  editingId: string | null;
  content: string;
}

interface ReplyFormState {
  content: string;
  submitting: boolean;
}

interface CommentItemProps {
  c: CommentNode;
  currentUserId?: string | null;
  commentEdit: CommentEditState;
  setCommentEdit: Dispatch<SetStateAction<CommentEditState>>;
  onEditSave: (commentId: string, content: string) => void;
  onCommentLike: (commentId: string) => void;
  onDeleteOpen: (commentId: string) => void;
  onBlockUser?: (authorId: string) => void;
  onReportOpen?: (targetType: 'COMMENT', targetId: string) => void;
  replyToCommentId: string | null;
  setReplyToCommentId: Dispatch<SetStateAction<string | null>>;
  replyForm: ReplyFormState;
  setReplyForm: Dispatch<SetStateAction<ReplyFormState>>;
  onReplySubmit: (e: FormEvent, commentId: string) => void;
  onLoadMoreReplies: (commentId: string) => void;
  replyLoadingIds: ReadonlySet<string>;
  depth?: number;
}

interface CommentListProps {
  comments: CommentNode[];
  currentUserId?: string | null;
  commentSort: string;
  setCommentSort: (sort: string) => void;
  commentEdit: CommentEditState;
  setCommentEdit: Dispatch<SetStateAction<CommentEditState>>;
  onEditSave?: (commentId: string, content: string) => void;
  onCommentLike?: (commentId: string) => void;
  onDeleteOpen?: (commentId: string) => void;
  onBlockUser?: (authorId: string) => void;
  onReportOpen?: (targetType: 'COMMENT', targetId: string) => void;
  hasMoreComments: boolean;
  loadingMoreComments: boolean;
  onLoadMoreComments: () => void;
  onLoadMoreReplies: (commentId: string) => void;
  replyLoadingIds: ReadonlySet<string>;
  replyToCommentId: string | null;
  setReplyToCommentId: Dispatch<SetStateAction<string | null>>;
  replyForm: ReplyFormState;
  setReplyForm: Dispatch<SetStateAction<ReplyFormState>>;
  onReplySubmit?: (e: FormEvent, commentId: string) => void;
}

function didCommentChange(prevC: CommentNode, nextC: CommentNode) {
  if (prevC === nextC) return false;
  if (!prevC || !nextC) return true;
  if (prevC.id !== nextC.id) return true;
  // 핵심 렌더링 필드들만 비교 (불필요한 전체 객체 비교/깊은 비교 방지)
  if ((prevC.content ?? '') !== (nextC.content ?? '')) return true;
  if (prevC.isDeleted !== nextC.isDeleted) return true;
  if (prevC.isEdited !== nextC.isEdited) return true;
  if ((prevC.created_at ?? '') !== (nextC.created_at ?? '')) return true;
  if ((prevC.updated_at ?? '') !== (nextC.updated_at ?? '')) return true;
  if ((prevC.likeCount ?? 0) !== (nextC.likeCount ?? 0)) return true;
  if ((prevC.isLiked ?? false) !== (nextC.isLiked ?? false)) return true;
  if ((prevC.parentId ?? null) !== (nextC.parentId ?? null)) return true;
  const prevRepliesLen = Array.isArray(prevC.replies) ? prevC.replies.length : 0;
  const nextRepliesLen = Array.isArray(nextC.replies) ? nextC.replies.length : 0;
  if (prevRepliesLen !== nextRepliesLen) return true;
  // 대댓글 "더보기"의 표시 여부·문구가 이 둘에서 나온다.
  if ((prevC.replyCount ?? 0) !== (nextC.replyCount ?? 0)) return true;
  if ((prevC.hasMoreReplies ?? false) !== (nextC.hasMoreReplies ?? false)) return true;
  return false;
}

function arePropsEqual(prev: CommentItemProps, next: CommentItemProps) {
  // 해당 CommentItem의 데이터가 바뀌면 반드시 리렌더
  if (didCommentChange(prev.c, next.c)) return false;

  // 이 댓글의 답글 로딩 상태 변화(스피너/비활성)만 반영 — Set 레퍼런스 비교는 무의미하다.
  const cid = next.c?.id ?? '';
  if (prev.replyLoadingIds.has(cid) !== next.replyLoadingIds.has(cid)) return false;

  // 본인/타인 여부, 메뉴 노출 등에 영향
  if ((prev.currentUserId ?? null) !== (next.currentUserId ?? null)) return false;

  // 현재 댓글이 "답글 입력창 대상"이면 reply 관련 변화에 반응해야 함
  const prevReplyTarget = prev.replyToCommentId === prev.c?.id;
  const nextReplyTarget = next.replyToCommentId === next.c?.id;
  if (prevReplyTarget !== nextReplyTarget) return false;
  if (nextReplyTarget) {
    // 이 댓글의 답글 입력 내용/로딩 상태 변화만 반영
    if ((prev.replyForm?.content ?? '') !== (next.replyForm?.content ?? '')) return false;
    if ((prev.replyForm?.submitting ?? false) !== (next.replyForm?.submitting ?? false)) return false;
  }

  // 현재 댓글이 "수정 중"이면 edit 관련 변화에 반응해야 함
  const prevEditing = prev.commentEdit?.editingId === prev.c?.id;
  const nextEditing = next.commentEdit?.editingId === next.c?.id;
  if (prevEditing !== nextEditing) return false;
  if (nextEditing) {
    if ((prev.commentEdit?.content ?? '') !== (next.commentEdit?.content ?? '')) return false;
  }

  // 핸들러/세터 레퍼런스는 부모에서 안정화(useCallback)시키는 전제.
  return true;
}

const CommentItem = React.memo(function CommentItem({
  c,
  currentUserId,
  commentEdit,
  setCommentEdit,
  onEditSave,
  onCommentLike,
  onDeleteOpen,
  onBlockUser,
  onReportOpen,
  replyToCommentId,
  setReplyToCommentId,
  replyForm,
  setReplyForm,
  onReplySubmit,
  onLoadMoreReplies,
  replyLoadingIds,
  depth = 0,
}: CommentItemProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const [showMoreBtn, setShowMoreBtn] = useState(false);
  const contentRef = useRef<HTMLParagraphElement>(null);
  const replyTextareaRef = useRef<HTMLTextAreaElement>(null);
  const editTextareaRef = useRef<HTMLTextAreaElement>(null);
  const isReply = depth > 0;
  const isTopLevel = depth === 0;
  const cid = c.id ?? '';
  const isMyComment = c.isMine || (currentUserId != null && c.author_id === currentUserId);
  const repDog = c.author_representative_dog as RepresentativeDog | null;

  const { go: goToDirectChat, busy: dmBusy } = useNavigateToDirectChat();
  const showDmButton =
    currentUserId != null &&
    !isMyComment &&
    c.author_id != null &&
    String(c.author_id) !== String(currentUserId);
  const hasRepresentativeDog = Boolean(repDog?.name);

  const adjustReplyHeight = useCallback(() => {
    const el = replyTextareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    const next = Math.min(Math.max(el.scrollHeight, 36), 300);
    el.style.height = `${next}px`;
    el.style.overflowY = 'hidden';
  }, []);

  const adjustEditHeight = useCallback(() => {
    const el = editTextareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    const next = Math.min(Math.max(el.scrollHeight, 60), 300);
    el.style.height = `${next}px`;
    el.style.overflowY = 'hidden';
  }, []);

  useEffect(() => {
    if (replyToCommentId === c.id) adjustReplyHeight();
  }, [replyToCommentId, c.id, replyForm.content, adjustReplyHeight]);

  // 답글 입력창 열릴 때 즉시 포커스(체감 지연 감소)
  useEffect(() => {
    if (replyToCommentId !== c.id) return;
    const raf = window.requestAnimationFrame(() => {
      replyTextareaRef.current?.focus();
    });
    return () => window.cancelAnimationFrame(raf);
  }, [replyToCommentId, c.id]);

  useEffect(() => {
    if (commentEdit.editingId === c.id) adjustEditHeight();
  }, [commentEdit.editingId, c.id, commentEdit.content, adjustEditHeight]);

  // 3줄 초과 여부 측정(접힌 상태에서만): scrollHeight vs clientHeight
  useEffect(() => {
    const el = contentRef.current;
    if (!el) return;
    if (isExpanded) return;
    const raf = window.requestAnimationFrame(() => {
      const current = contentRef.current;
      if (!current) return;
      const overflow = current.scrollHeight > current.clientHeight + 1;
      setShowMoreBtn(overflow);
    });
    return () => window.cancelAnimationFrame(raf);
  }, [c?.content, c?.isDeleted, isExpanded]);

  return (
    <article
      key={c.id}
      className={CC.COMMENT_ITEM(isTopLevel, isReply)}
      data-comment-id={c.id}
    >
      <div className={CC.COMMENT_ITEM_AVATAR}>
        <img
          src={c.author_profile_image || DEFAULT_PROFILE_IMAGE}
          alt="댓글 작성자 프로필"
          className={CC.COMMENT_ITEM_AVATAR_IMG}
        />
      </div>
      <div className={CC.COMMENT_ITEM_BODY}>
        <div className={CC.COMMENT_ITEM_HEADER}>
          <div className={CC.COMMENT_ITEM_AUTHOR_WRAP}>
            {showDmButton && !hasRepresentativeDog ? (
              <div className="flex flex-wrap items-center gap-x-2 gap-y-[3px]">
                <span className={CC.COMMENT_ITEM_AUTHOR}>{escapeHtml(c.author_nickname ?? '')}</span>
                <button
                  type="button"
                  disabled={dmBusy}
                  aria-label="메시지 보내기"
                  className="inline-flex shrink-0 cursor-pointer items-center justify-center border-0 bg-transparent p-0.5 text-[#64748b] shadow-none outline-none transition-colors hover:text-blue-500 focus-visible:outline-none focus-visible:ring-0 disabled:cursor-not-allowed disabled:opacity-60"
                  onClick={() =>
                    goToDirectChat(
                      c.author_id,
                      c.author_nickname ?? '',
                      c.author_profile_image || DEFAULT_PROFILE_IMAGE,
                    )
                  }
                >
                  <MessageCircle
                    size={18}
                    strokeWidth={2}
                    className="block shrink-0 -translate-y-0.5"
                    aria-hidden
                  />
                </button>
              </div>
            ) : showDmButton && hasRepresentativeDog ? (
              <div className="relative min-w-0 max-w-full pr-8">
                <span className={CC.COMMENT_ITEM_AUTHOR}>{escapeHtml(c.author_nickname ?? '')}</span>
                <span className={CC.COMMENT_ITEM_DOG}>
                  {' '}
                  {(() => {
                    const d = repDog as RepresentativeDog;
                    const genderLabel = d.gender ? (
                      <span className="inline bg-transparent text-[1em] text-inherit">
                        {formatDogGenderLabel(d.gender)}
                      </span>
                    ) : null;
                    const parts = [
                      escapeHtml(d.name),
                      escapeHtml(d.breed || ''),
                      genderLabel,
                      calculateDogAge(d.birthDate),
                    ].filter(Boolean);
                    return parts.map((p, i) => (
                      <span key={i}>
                        {i > 0 && ' / '}
                        {p}
                      </span>
                    ));
                  })()}
                </span>
                <button
                  type="button"
                  disabled={dmBusy}
                  aria-label="메시지 보내기"
                  className="absolute top-0 right-0 inline-flex cursor-pointer items-center justify-center border-0 bg-transparent p-0.5 text-[#64748b] shadow-none outline-none transition-colors hover:text-blue-500 focus-visible:outline-none focus-visible:ring-0 disabled:cursor-not-allowed disabled:opacity-60"
                  onClick={() =>
                    goToDirectChat(
                      c.author_id,
                      c.author_nickname ?? '',
                      c.author_profile_image || DEFAULT_PROFILE_IMAGE,
                    )
                  }
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
              <>
                <span className={CC.COMMENT_ITEM_AUTHOR}>{escapeHtml(c.author_nickname ?? '')}</span>
                {repDog?.name && (
                  <span className={CC.COMMENT_ITEM_DOG}>
                    {' '}
                    {(() => {
                      const d = repDog as RepresentativeDog;
                      const genderLabel = d.gender ? (
                        <span className="inline bg-transparent text-[1em] text-inherit">
                          {formatDogGenderLabel(d.gender)}
                        </span>
                      ) : null;
                      const parts = [
                        escapeHtml(d.name),
                        escapeHtml(d.breed || ''),
                        genderLabel,
                        calculateDogAge(d.birthDate),
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
              </>
            )}
          </div>
          <div className={CC.COMMENT_ITEM_ACTIONS(isReply)}>
            {isMyComment && currentUserId != null ? (
              <div className="inline-flex items-center gap-3">
                <button
                  type="button"
                  className="h-auto min-w-0 cursor-pointer border-0 bg-transparent p-0 text-[11.5px] text-[#333] no-underline transition-colors duration-150 hover:text-[#111]"
                  onClick={() => setCommentEdit({ editingId: c.id ?? null, content: c.content ?? '' })}
                >
                  수정
                </button>
                <button
                  type="button"
                  className="h-auto min-w-0 cursor-pointer border-0 bg-transparent p-0 text-[11.5px] text-[#333] no-underline transition-colors duration-150 hover:text-[#111]"
                  onClick={() => onDeleteOpen(cid)}
                >
                  삭제
                </button>
              </div>
            ) : !isMyComment ? (
              <div className="relative">
                <button
                  type="button"
                  className={CC.COMMENT_ITEM_MENU_TRIGGER}
                  onClick={() => setMenuOpen((o) => !o)}
                  aria-label="메뉴"
                  aria-expanded={menuOpen}
                >
                  <MoreHorizontal size={18} aria-hidden />
                </button>
                {menuOpen && (
                  <>
                    <div
                      className={CC.COMMENT_ITEM_MENU_BACKDROP}
                      role="presentation"
                      aria-hidden="true"
                      onClick={() => setMenuOpen(false)}
                    />
                    <ul className={CC.COMMENT_ITEM_MENU}>
                      {currentUserId != null && c.author_id != null ? (
                        <li>
                          <button
                            type="button"
                            className={CC.MENU_ITEM_BTN_DANGER}
                            onClick={() => {
                              if (c.author_id != null) onBlockUser?.(String(c.author_id));
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
                          className={CC.MENU_ITEM_BTN_DANGER}
                          onClick={() => {
                            onReportOpen?.('COMMENT', cid);
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
            ) : (
              <div className={CC.COMMENT_ITEM_ACTIONS_SPACER} aria-hidden />
            )}
          </div>
        </div>
        {commentEdit.editingId === c.id ? (
          <form
            className={CC.COMMENT_EDIT_FORM}
            onSubmit={(e) => {
              e.preventDefault();
              onEditSave(cid, commentEdit.content);
            }}
          >
            <textarea
              ref={editTextareaRef}
              className={CC.COMMENT_EDIT_TEXTAREA}
              aria-label="댓글 수정"
              value={commentEdit.content}
              onChange={(e) => {
                const value = e.target.value;
                setCommentEdit((prev) => ({ ...prev, content: value }));
                // 같은 tick에서 DOM 값이 반영되므로 즉시 높이 재계산 가능
                adjustEditHeight();
              }}
            />
            <div className={CC.COMMENT_EDIT_ACTIONS}>
              <button type="submit" className="h-auto min-w-0 cursor-pointer border-0 bg-transparent p-0 text-[11.5px] text-[#333] no-underline transition-colors duration-150 hover:text-[#111]">
                저장
              </button>
              <button
                type="button"
                className="h-auto min-w-0 cursor-pointer border-0 bg-transparent p-0 text-[11.5px] text-[#333] no-underline transition-colors duration-150 hover:text-[#111]"
                onClick={() => setCommentEdit({ editingId: null, content: '' })}
              >
                취소
              </button>
            </div>
          </form>
        ) : (
          <div className={CC.COMMENT_ITEM_CONTENT_BLOCK}>
            <div className={CC.COMMENT_ITEM_CONTENT_ROW}>
              <div className={CC.COMMENT_ITEM_TEXT_WRAP}>
                <p
                  ref={contentRef}
                  className={CC.COMMENT_ITEM_CONTENT(
                    !isExpanded ? CC.COMMENT_ITEM_CONTENT_CLAMP : ''
                  )}
                >
                  {c.isDeleted ? '삭제된 댓글입니다.' : escapeHtml(c.content ?? '')}
                </p>
                {showMoreBtn && !c.isDeleted && (
                  <button
                    type="button"
                    className={CC.COMMENT_ITEM_READMORE_BTN}
                    onClick={() => setIsExpanded((v) => !v)}
                  >
                    {isExpanded ? '접기' : '더보기'}
                  </button>
                )}
              </div>
              {!isReply && onCommentLike && !c.isDeleted && (
                <div className={CC.COMMENT_ITEM_LIKE_COL}>
                  <div className={CC.COMMENT_ITEM_LIKE_ICON_WRAP}>
                    <button
                      type="button"
                      className={CC.commentItemLikeIconBtn(c.isLiked)}
                      onClick={() => onCommentLike(cid)}
                      aria-label={c.isLiked ? '좋아요 취소' : '좋아요'}
                    >
                      <Heart
                        size={16}
                        strokeWidth={2}
                        fill={c.isLiked ? 'currentColor' : 'none'}
                        aria-hidden
                      />
                    </button>
                  </div>
                  <div className={CC.COMMENT_ITEM_LIKE_COUNT}>
                    <span>{c.likeCount ?? 0}</span>
                  </div>
                </div>
              )}
            </div>
            <div className={CC.COMMENT_ITEM_META_ROW}>
              <div className={CC.COMMENT_ITEM_META}>
                <span>
                  {formatDateTime(c.created_at)}
                  {c.isEdited && <span className={CC.COMMENT_ITEM_EDITED}> (수정됨)</span>}
                </span>
                {currentUserId != null && !c.isDeleted && !c.parentId && (
                  <button
                    type="button"
                    className={CC.COMMENT_REPLY_BTN}
                    onClick={() => setReplyToCommentId(replyToCommentId === c.id ? null : cid)}
                  >
                    답글 쓰기
                  </button>
                )}
              </div>
            </div>
          </div>
        )}
        {currentUserId != null && replyToCommentId === c.id && (
          <form
            className={CC.COMMENT_REPLY_BOX}
            onSubmit={(e) => onReplySubmit(e, cid)}
          >
            <textarea
              ref={replyTextareaRef}
              rows={1}
              className={CC.COMMENT_REPLY_TEXTAREA}
              placeholder="댓글을 남겨보세요"
              value={replyForm.content}
              onChange={(e) => setReplyForm((prev) => ({ ...prev, content: e.target.value }))}
            />
            <div className={CC.COMMENT_REPLY_BOX_DIVIDER} />
            <div className={CC.COMMENT_REPLY_ACTIONS}>
              <button
                type="button"
                className={CC.COMMENT_REPLY_CANCEL}
                onClick={() => {
                  setReplyToCommentId(null);
                  setReplyForm((prev) => ({ ...prev, content: '' }));
                }}
              >
                취소
              </button>
              <button
                type="submit"
                className={CC.COMMENT_REPLY_SUBMIT}
                disabled={replyForm.submitting}
              >
                등록
              </button>
            </div>
          </form>
        )}
        {Array.isArray(c.replies) && c.replies.length > 0 && (
          <div className={CC.COMMENT_REPLIES}>
            {c.replies.map((r) => (
              <CommentItem
                key={r.id}
                c={r}
                currentUserId={currentUserId}
                commentEdit={commentEdit}
                setCommentEdit={setCommentEdit}
                onEditSave={onEditSave}
                onCommentLike={onCommentLike}
                onDeleteOpen={onDeleteOpen}
                onBlockUser={onBlockUser}
                onReportOpen={onReportOpen}
                replyToCommentId={replyToCommentId}
                setReplyToCommentId={setReplyToCommentId}
                replyForm={replyForm}
                setReplyForm={setReplyForm}
                onReplySubmit={onReplySubmit}
                onLoadMoreReplies={onLoadMoreReplies}
                replyLoadingIds={replyLoadingIds}
                depth={1}
              />
            ))}
            {/* 서버가 루트당 preview만 실어 보낸다 — 나머지는 눌러서 이어 받는다. */}
            {c.hasMoreReplies && (
              <button
                type="button"
                className={CC.COMMENT_REPLIES_TOGGLE}
                disabled={replyLoadingIds.has(cid)}
                onClick={() => onLoadMoreReplies(cid)}
              >
                {replyLoadingIds.has(cid)
                  ? '―― 답글 불러오는 중…'
                  : `―― 답글 ${Math.max(0, (c.replyCount ?? 0) - c.replies.length)}개 더보기`}
              </button>
            )}
          </div>
        )}
      </div>
    </article>
  );
}, arePropsEqual);

const COMMENT_SORTS = [
  { value: 'popular', label: '인기순' },
  { value: 'latest', label: '최신순' },
  { value: 'oldest', label: '등록순' },
];

export function CommentList({
  comments,
  currentUserId,
  commentSort,
  setCommentSort,
  commentEdit,
  setCommentEdit,
  onEditSave,
  onCommentLike,
  onDeleteOpen,
  onBlockUser,
  onReportOpen,
  hasMoreComments,
  loadingMoreComments,
  onLoadMoreComments,
  onLoadMoreReplies,
  replyLoadingIds,
  replyToCommentId,
  setReplyToCommentId,
  replyForm,
  setReplyForm,
  onReplySubmit,
}: CommentListProps) {
  // React.memo가 제대로 동작하도록 핸들러 레퍼런스 안정화
  const handleEditSave = useCallback(
    (commentId: string, content: string) => onEditSave?.(commentId, content),
    [onEditSave]
  );
  const handleCommentLike = useCallback(
    (commentId: string) => onCommentLike?.(commentId),
    [onCommentLike]
  );
  const handleDeleteOpen = useCallback(
    (commentId: string) => onDeleteOpen?.(commentId),
    [onDeleteOpen]
  );
  const handleBlockUser = useCallback(
    (authorId: string) => onBlockUser?.(authorId),
    [onBlockUser]
  );
  const handleReportOpen = useCallback(
    (targetType: 'COMMENT', targetId: string) => onReportOpen?.(targetType, targetId),
    [onReportOpen]
  );
  const handleReplySubmit = useCallback(
    (e: FormEvent, commentId: string) => onReplySubmit?.(e, commentId),
    [onReplySubmit]
  );

  const renderedComments = useMemo(
    () =>
      comments.map((c) => (
        <CommentItem
          key={c.id}
          c={c}
          currentUserId={currentUserId}
          commentEdit={commentEdit}
          setCommentEdit={setCommentEdit}
          onEditSave={handleEditSave}
          onCommentLike={handleCommentLike}
          onDeleteOpen={handleDeleteOpen}
          onBlockUser={handleBlockUser}
          onReportOpen={handleReportOpen}
          replyToCommentId={replyToCommentId}
          setReplyToCommentId={setReplyToCommentId}
          replyForm={replyForm}
          setReplyForm={setReplyForm}
          onReplySubmit={handleReplySubmit}
          onLoadMoreReplies={onLoadMoreReplies}
          replyLoadingIds={replyLoadingIds}
        />
      )),
    [
      comments,
      currentUserId,
      commentEdit,
      setCommentEdit,
      handleEditSave,
      handleCommentLike,
      handleDeleteOpen,
      handleBlockUser,
      handleReportOpen,
      replyToCommentId,
      setReplyToCommentId,
      replyForm,
      setReplyForm,
      handleReplySubmit,
      onLoadMoreReplies,
      replyLoadingIds,
    ]
  );

  return (
    <>
      <div className={CC.COMMENT_SORT_TABS} role="tablist" aria-label="댓글 정렬">
        {COMMENT_SORTS.map((s) => (
          <button
            key={s.value}
            type="button"
            role="tab"
            aria-selected={commentSort === s.value}
            className={CC.commentSortTabBtn(commentSort === s.value)}
            onClick={() => setCommentSort(s.value)}
          >
            {s.label}
          </button>
        ))}
      </div>
      <section id="comment-list" className={CC.COMMENT_LIST_SECTION}>
        {renderedComments}
      </section>
      {/* 서버가 keyset(cursor) 페이지네이션이라 전체 페이지 수를 알 수 없다 — 번호 대신 이어보기. */}
      {hasMoreComments && (
        <nav className={CC.COMMENT_PAGINATION} aria-label="댓글 더 보기">
          <button
            type="button"
            className={CC.commentPaginationBtn(false)}
            disabled={loadingMoreComments}
            onClick={onLoadMoreComments}
          >
            {loadingMoreComments ? '불러오는 중…' : '댓글 더 보기'}
          </button>
        </nav>
      )}
    </>
  );
}
