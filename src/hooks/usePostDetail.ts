// 게시글 상세: React Query(게시글·댓글) + 모달·댓글 CRUD.
import { useState, useCallback, useEffect, useRef, useMemo, type FormEvent } from 'react';
import { useQuery, useInfiniteQuery, useQueryClient } from '@tanstack/react-query';
import type { NavigateFunction } from 'react-router-dom';
import { apiDelete, apiGet, apiPatch, apiPost } from '../api/typed.js';
import type { Schemas } from '../api/api-types.js';
import { DEFAULT_PROFILE_IMAGE } from '../config.js';
import { useAuth, type AuthUser } from '../context/AuthContext.jsx';
import {
  getApiErrorMessage,
  getClientErrorCode,
  appendDedupedById,
  getProfileImageUrl,
  nextCursorFromPage,
  safeImageUrl,
} from '../utils/index.js';

const COMMENT_PAGE_SIZE = 10;
// 루트당 대댓글은 서버가 preview(상수)만 실어 보낸다 — 나머지는 이 크기로 이어 받는다.
const REPLY_PAGE_SIZE = 10;
const POST_EDIT_MERGE_KEY = (id: string | number) => `pt_post_edit_merge_${id}`;

// --- 서버 원시 응답 shape (camel/snake 혼재 방어) ---
interface RawAuthor {
  id?: string;
  nickname?: string;
  profileImageUrl?: string | null;
  representativeDog?: unknown;
}

/** 게시글 첨부 파일 (런타임은 camelCase fileUrl). */
export interface PostFile {
  fileUrl?: string | null;
  imageId?: string | null;
  [key: string]: unknown;
}

interface RawPost {
  id?: string;
  title?: string;
  content?: string;
  author?: RawAuthor | null;
  hashtags?: unknown;
  categoryId?: string | number | null;
  version?: number | string;
  isEdited?: boolean;
  createdAt?: string;
  files?: unknown;
  likeCount?: number;
  viewCount?: number;
  commentCount?: number;
  isLiked?: boolean;
}

interface RawComment {
  id?: string;
  author?: RawAuthor | null;
  replies?: unknown;
  createdAt?: string;
  updatedAt?: string;
  content?: string;
  likeCount?: number;
  isLiked?: boolean;
  parentId?: string | null;
  isEdited?: boolean;
  isDeleted?: boolean;
  replyCount?: number;
  hasMoreReplies?: boolean;
}

// --- 정규화된 UI 도메인 타입 ---
export interface PostDetailData {
  id?: string;
  title: string;
  content: string;
  category_id: string | number | null;
  hashtags: string[];
  isEdited: boolean;
  author_nickname: string;
  author_id: string | null;
  author_profile_image: string;
  author_representative_dog: unknown;
  created_at: string;
  files: PostFile[];
  likes: number;
  views: number;
  commentCount: number;
  isLiked: boolean;
  isMine: boolean;
}

export interface CommentNode {
  id?: string;
  author_nickname: string;
  author_profile_image: string;
  author_representative_dog: unknown;
  author_id: string | null;
  created_at: string;
  updated_at: string;
  content: string;
  isMine: boolean;
  likeCount: number;
  isLiked: boolean;
  parentId: string | null;
  /** 서버가 실어 보낸 preview + "더보기"로 이어 받은 대댓글. 전량이 아닐 수 있다. */
  replies: CommentNode[];
  /** 표시 가능한 대댓글 총 개수(서버 집계). replies.length와 다를 수 있다. */
  replyCount: number;
  /** 아직 받지 않은 대댓글이 남았는지. */
  hasMoreReplies: boolean;
  isEdited: boolean;
  isDeleted: boolean;
}

interface ModalState {
  postDeleteOpen: boolean;
  commentDeleteId: string | null;
  reportOpen: boolean;
  /** 서버 enum(TargetType)과 일치 — 신고 모달이 그대로 전송한다. */
  reportTargetType: Schemas['TargetType'] | null;
  reportTargetId: string | null;
}

function updateCommentInTree(
  comments: CommentNode[],
  commentId: string,
  patch: Partial<CommentNode>
): CommentNode[] {
  return comments.map((c) => {
    if (c.id === commentId) return { ...c, ...patch };
    if (c.replies?.length) {
      const nextReplies = updateCommentInTree(c.replies, commentId, patch);
      const same =
        nextReplies.length === c.replies.length &&
        nextReplies.every((r, i) => r === c.replies[i]);
      return same ? c : { ...c, replies: nextReplies };
    }
    return c;
  });
}

function normalizePost(postData: RawPost, currentUser: AuthUser | null): PostDetailData {
  const author = postData?.author ?? null;
  const isMine = !!(currentUser && author?.id === currentUser.userId);
  const hashtagsRaw = postData?.hashtags;
  const hashtags = Array.isArray(hashtagsRaw) ? hashtagsRaw.map((t) => String(t)) : [];
  const categoryId =
    postData?.categoryId ?? null;

  const versionRaw = postData?.version;
  const versionNum =
    typeof versionRaw === 'number'
      ? versionRaw
      : versionRaw != null && Number.isFinite(Number(versionRaw))
        ? Number(versionRaw)
        : null;
  const isEdited = postData?.isEdited === true || (versionNum !== null && versionNum > 1);

  const files = (postData?.files ?? []) as PostFile[];

  return {
    id: postData?.id,
    title: postData?.title ?? '',
    content: postData?.content ?? '',
    category_id: categoryId,
    hashtags,
    isEdited,
    author_nickname: author?.nickname ?? '탈퇴한 사용자',
    author_id: author?.id ?? null,
    author_profile_image: getProfileImageUrl(currentUser, author, isMine, DEFAULT_PROFILE_IMAGE),
    author_representative_dog: author?.representativeDog ?? null,
    created_at: postData?.createdAt ?? '',
    files,
    likes: postData?.likeCount ?? 0,
    views: postData?.viewCount ?? 0,
    commentCount: postData?.commentCount ?? 0,
    isLiked: postData?.isLiked ?? false,
    isMine,
  };
}

function normalizeComment(c: RawComment, currentUser: AuthUser | null): CommentNode {
  const author = c?.author ?? null;
  const isMine = !!(currentUser && author?.id === currentUser.userId);
  const repDog = author?.representativeDog ?? null;
  const replies = Array.isArray(c?.replies)
    ? c.replies.map((r) => normalizeComment(r as RawComment, currentUser))
    : [];

  return {
    id: c?.id,
    author_nickname: author?.nickname ?? '탈퇴한 사용자',
    author_profile_image: getProfileImageUrl(currentUser, author, isMine, DEFAULT_PROFILE_IMAGE),
    author_representative_dog: repDog,
    author_id: author?.id ?? null,
    created_at: c?.createdAt ?? '',
    updated_at: c?.updatedAt ?? '',
    content: c?.content ?? '',
    isMine,
    likeCount: c?.likeCount ?? 0,
    isLiked: c?.isLiked ?? false,
    parentId: c?.parentId ?? null,
    replies,
    // 서버 집계가 없으면 preview 길이로 대체 — 그 경우 "더보기"는 뜨지 않는다.
    replyCount: c?.replyCount ?? replies.length,
    hasMoreReplies: c?.hasMoreReplies ?? false,
    isEdited: c?.isEdited === true,
    isDeleted: c?.isDeleted ?? false,
  };
}

function unwrapCommentsPagePayload(res: unknown): { items: RawComment[]; hasMore: boolean } {
  if (!res || typeof res !== 'object') return { items: [], hasMore: false };
  const o = res as { data?: unknown };
  const inner = (o.data !== undefined ? o.data : res) as {
    items?: unknown;
    hasMore?: boolean;
  };
  const items = Array.isArray(inner?.items) ? (inner.items as RawComment[]) : [];
  return { items, hasMore: Boolean(inner?.hasMore) };
}

function flattenCommentForest(items: CommentNode[]): CommentNode[] {
  const out: CommentNode[] = [];
  const seen = new Set<string>();
  const walk = (c: CommentNode) => {
    if (!c || c.id == null || seen.has(c.id)) return;
    seen.add(c.id);
    out.push(c);
    for (const r of Array.isArray(c.replies) ? c.replies : []) walk(r);
  };
  for (const c of items) walk(c);
  return out;
}

function nestFlatCommentsIfNeeded(normalizedRoots: CommentNode[]): CommentNode[] {
  if (!Array.isArray(normalizedRoots) || normalizedRoots.length === 0) return normalizedRoots;
  const flat = flattenCommentForest(normalizedRoots);
  const needsNest = flat.some((c) => c.parentId != null);
  if (!needsNest) return normalizedRoots;

  const byId = new Map<string, CommentNode>();
  for (const c of flat) {
    if (c.id != null) byId.set(c.id, { ...c, replies: [] });
  }
  const roots: CommentNode[] = [];
  for (const c of flat) {
    const node = c.id != null ? byId.get(c.id) : undefined;
    if (!node) continue;
    const pid = c.parentId;
    if (pid == null) {
      roots.push(node);
    } else {
      const parent = byId.get(pid);
      if (parent) parent.replies.push(node);
      else roots.push(node);
    }
  }
  return roots;
}

interface PostEditMerge {
  postId?: string;
  title?: string;
  content?: string;
  categoryId?: string | number | null;
  hashtags?: string[];
}

async function fetchPostNormalized(
  postId: string,
  user: AuthUser | null
): Promise<PostDetailData | null> {
  const res = await apiGet('/v1/posts/{post_id}', { path: { post_id: postId } });
  const data = (res?.data ?? null) as RawPost | null;
  if (!data) return null;

  let merge: PostEditMerge | null = null;
  try {
    const raw = sessionStorage.getItem(POST_EDIT_MERGE_KEY(postId));
    if (raw) {
      merge = JSON.parse(raw) as PostEditMerge;
      sessionStorage.removeItem(POST_EDIT_MERGE_KEY(postId));
    }
  } catch {
    /* ignore */
  }

  const normalized = normalizePost(data, user);
  if (merge && merge.postId === postId) {
    return {
      ...normalized,
      title: merge.title ?? normalized.title,
      content: merge.content ?? normalized.content,
      category_id: merge.categoryId ?? normalized.category_id,
      hashtags: Array.isArray(merge.hashtags) ? merge.hashtags : normalized.hashtags,
      isEdited: true,
    };
  }
  return normalized;
}

/** 서버는 keyset(cursor) 페이지네이션이다 — page 번호·total은 존재하지 않는다. */
async function fetchCommentsPage(
  postId: string,
  commentSort: string,
  cursor: string | undefined,
  user: AuthUser | null
): Promise<{ comments: CommentNode[]; hasMore: boolean }> {
  const res = await apiGet('/v1/posts/{post_id}/comments', {
    path: { post_id: postId },
    query: { size: COMMENT_PAGE_SIZE, sort: commentSort, cursor },
  });
  const { items: arr, hasMore } = unwrapCommentsPagePayload(res);
  const mapped = arr.map((c) => normalizeComment(c, user));
  return { comments: nestFlatCommentsIfNeeded(mapped), hasMore };
}

/** 한 루트의 대댓글 다음 페이지 — 목록 응답의 preview 뒤를 이어 받는다. */
async function fetchRepliesPage(
  postId: string,
  commentId: string,
  commentSort: string,
  cursor: string | null,
  user: AuthUser | null
): Promise<{ replies: CommentNode[]; hasMore: boolean }> {
  const res = await apiGet('/v1/posts/{post_id}/comments/{comment_id}/replies', {
    path: { post_id: postId, comment_id: commentId },
    query: { size: REPLY_PAGE_SIZE, sort: commentSort, cursor },
  });
  const { items, hasMore } = unwrapCommentsPagePayload(res);
  return { replies: items.map((r) => normalizeComment(r, user)), hasMore };
}

export function usePostDetail(postId: string, user: AuthUser | null, navigate: NavigateFunction) {
  const { isRestored } = useAuth();
  const queryClient = useQueryClient();
  const [commentSort, setCommentSortState] = useState('latest');

  // 루트별로 "더보기"로 이어 받은 대댓글. 서버 preview 뒤에 이어 붙인다.
  const [replyExtras, setReplyExtras] = useState<
    Record<string, { items: CommentNode[]; hasMore: boolean }>
  >({});
  const [replyLoadingIds, setReplyLoadingIds] = useState<ReadonlySet<string>>(new Set());

  const setCommentSort = useCallback((sort: string) => {
    setCommentSortState(sort);
    // 정렬이 바뀌면 대댓글 커서 축도 뒤집힌다 — 이어받은 것들을 버리고 preview부터 다시.
    setReplyExtras({});
  }, []);

  const [message, setMessage] = useState('');
  const [modalState, setModalState] = useState<ModalState>({
    postDeleteOpen: false,
    commentDeleteId: null,
    reportOpen: false,
    reportTargetType: null,
    reportTargetId: null,
  });
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [commentForm, setCommentForm] = useState({ content: '', submitting: false });
  const [commentEdit, setCommentEdit] = useState<{ editingId: string | null; content: string }>({
    editingId: null,
    content: '',
  });
  const [replyToCommentId, setReplyToCommentId] = useState<string | null>(null);
  const [replyForm, setReplyForm] = useState({ content: '', submitting: false });
  const [commentsOverride, setCommentsOverride] = useState<CommentNode[] | null>(null);

  const isLikingRef = useRef(false);
  const pendingCommentLikeIdsRef = useRef<Set<string>>(new Set());
  const inFlightRepliesRef = useRef<Set<string>>(new Set());

  const userKey = user?.userId ?? user?.id ?? null;

  const postQuery = useQuery({
    queryKey: ['post', postId, userKey],
    queryFn: () => fetchPostNormalized(postId, user),
    enabled: Boolean(postId && isRestored),
  });

  const commentsQuery = useInfiniteQuery({
    queryKey: ['post', postId, 'comments', commentSort, userKey],
    initialPageParam: undefined as string | undefined,
    queryFn: ({ pageParam }) => fetchCommentsPage(postId, commentSort, pageParam, user),
    // undefined = 다음 페이지 없음. 커서는 마지막 루트 댓글 id.
    getNextPageParam: (page) =>
      nextCursorFromPage(page.comments, page.hasMore) ?? undefined,
    enabled: Boolean(postId && isRestored),
  });

  const post = postQuery.data ?? null;
  const loading = postQuery.isPending;
  const error = postQuery.isError
    ? getApiErrorMessage(getClientErrorCode(postQuery.error), '게시글을 불러오지 못했습니다.')
    : '';

  const fetchedComments = useMemo(
    () => (commentsQuery.data?.pages ?? []).flatMap((p) => p.comments),
    [commentsQuery.data?.pages]
  );

  // preview + 이어받은 대댓글을 합쳐 내려보낸다. id 기준 dedupe — 낙관적 갱신이나
  // 재조회로 preview가 갱신될 때 같은 대댓글이 두 번 붙는 것을 막는다.
  const comments = useMemo(() => {
    const base = commentsOverride ?? fetchedComments;
    if (Object.keys(replyExtras).length === 0) return base;
    return base.map((c) => {
      const extra = c.id ? replyExtras[c.id] : undefined;
      // 빈 페이지(요청 사이에 대댓글이 삭제된 경우)여도 hasMore는 반영해야 한다 —
      // 안 그러면 서버 초기값(true)이 남아 눌러도 아무 일 없는 버튼이 계속 보인다.
      if (!extra) return c;
      return {
        ...c,
        replies: appendDedupedById(c.replies, extra.items),
        hasMoreReplies: extra.hasMore,
      };
    });
  }, [commentsOverride, fetchedComments, replyExtras]);

  // loadMoreReplies가 커서를 읽을 때 쓰는 최신 스냅샷 — 의존성으로 넣으면 콜백이 매 변경마다
  // 새로 만들어져 목록 전체가 다시 조립된다.
  const commentsRef = useRef(comments);
  useEffect(() => {
    commentsRef.current = comments;
  }, [comments]);

  const loadPost = useCallback(async () => {
    await queryClient.invalidateQueries({ queryKey: ['post', postId] });
  }, [queryClient, postId]);

  const loadComments = useCallback(async () => {
    setCommentsOverride(null);
    setReplyExtras({});
    await queryClient.invalidateQueries({ queryKey: ['post', postId, 'comments'] });
  }, [queryClient, postId]);

  const { hasNextPage, isFetchingNextPage, fetchNextPage } = commentsQuery;
  const loadMoreComments = useCallback(() => {
    if (hasNextPage && !isFetchingNextPage) void fetchNextPage();
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

  const loadMoreReplies = useCallback(
    async (commentId: string) => {
      if (!postId || !commentId) return;
      // 중복 요청 가드는 ref로 — state를 의존성에 넣으면 콜백이 매번 새로 만들어져
      // 렌더된 댓글 목록 전체가 다시 조립된다.
      if (inFlightRepliesRef.current.has(commentId)) return;
      // 커서는 "이미 화면에 있는 마지막 대댓글" — preview + 이어받은 것이 병합된 결과의
      // 끝이라 별도로 저장할 필요가 없다(저장하면 같은 값을 두 곳에서 관리하게 된다).
      const loaded = commentsRef.current.find((c) => c.id === commentId)?.replies ?? [];
      const cursor = loaded.length > 0 ? (loaded[loaded.length - 1].id ?? null) : null;

      inFlightRepliesRef.current.add(commentId);
      setReplyLoadingIds((prev) => new Set(prev).add(commentId));
      try {
        const { replies, hasMore } = await fetchRepliesPage(
          postId,
          commentId,
          commentSort,
          cursor,
          user
        );
        setReplyExtras((prev) => ({
          ...prev,
          [commentId]: {
            items: appendDedupedById(prev[commentId]?.items ?? [], replies),
            hasMore,
          },
        }));
      } catch (err) {
        setMessage(getApiErrorMessage(getClientErrorCode(err), '답글을 불러오지 못했습니다.'));
      } finally {
        inFlightRepliesRef.current.delete(commentId);
        setReplyLoadingIds((prev) => {
          const next = new Set(prev);
          next.delete(commentId);
          return next;
        });
      }
    },
    [postId, commentSort, user]
  );

  const handleLike = useCallback(async () => {
    if (!postId) return;
    if (isLikingRef.current) return;
    if (!user) {
      if (!window.confirm('로그인이 필요한 서비스입니다. 로그인하시겠습니까?')) return;
      sessionStorage.setItem('login_return_path', `/posts/${postId}`);
      navigate('/login');
      return;
    }
    setMessage('');
    isLikingRef.current = true;
    const currentlyLiked = post?.isLiked ?? false;
    try {
      const res = currentlyLiked
        ? await apiDelete('/v1/likes/posts/{post_id}', { path: { post_id: postId } })
        : await apiPost('/v1/likes/posts/{post_id}', { path: { post_id: postId } });
      const data = res?.data ?? null;
      const likeCount = data?.likeCount;
      const isLiked = data?.isLiked;
      if (likeCount !== undefined || isLiked !== undefined) {
        queryClient.setQueryData<PostDetailData>(['post', postId, userKey], (prev) =>
          prev
            ? {
                ...prev,
                likes: typeof likeCount === 'number' ? likeCount : prev.likes,
                isLiked: typeof isLiked === 'boolean' ? isLiked : prev.isLiked,
              }
            : prev
        );
      }
    } catch (err) {
      setMessage(getApiErrorMessage(getClientErrorCode(err), '좋아요 처리에 실패했습니다.'));
    } finally {
      isLikingRef.current = false;
    }
  }, [postId, user, navigate, post, queryClient, userKey]);

  const handleCommentSubmit = useCallback(
    async (e: FormEvent) => {
      e.preventDefault();
      if (!postId || !user) {
        if (!window.confirm('로그인이 필요한 서비스입니다. 로그인하시겠습니까?')) return;
        sessionStorage.setItem('login_return_path', `/posts/${postId}`);
        navigate('/login');
        return;
      }
      const content = commentForm.content.trim();
      if (!content) return;
      setMessage('');
      setCommentForm((prev) => ({ ...prev, submitting: true }));
      try {
        await apiPost('/v1/posts/{post_id}/comments', {
          path: { post_id: postId },
          body: { content },
        });
        setCommentForm((prev) => ({ ...prev, content: '', submitting: false }));
        queryClient.setQueryData<PostDetailData>(['post', postId, userKey], (prev) =>
          prev ? { ...prev, commentCount: (prev.commentCount ?? 0) + 1 } : prev
        );
        await loadComments();
      } catch (err) {
        setMessage(getApiErrorMessage(getClientErrorCode(err), '댓글 등록에 실패했습니다.'));
        setCommentForm((prev) => ({ ...prev, submitting: false }));
      }
    },
    [postId, user, commentForm.content, navigate, loadComments, queryClient, userKey]
  );

  const handleReplySubmit = useCallback(
    async (e: FormEvent, parentId: string) => {
      e.preventDefault();
      if (!postId || !user || !parentId) return;
      const content = replyForm.content.trim();
      if (!content) return;
      setMessage('');
      setReplyForm((prev) => ({ ...prev, submitting: true }));
      try {
        await apiPost('/v1/posts/{post_id}/comments', {
          path: { post_id: postId },
          body: { content, parentId },
        });
        setReplyForm((prev) => ({ ...prev, content: '', submitting: false }));
        setReplyToCommentId(null);
        queryClient.setQueryData<PostDetailData>(['post', postId, userKey], (prev) =>
          prev ? { ...prev, commentCount: (prev.commentCount ?? 0) + 1 } : prev
        );
        await loadComments();
      } catch (err) {
        setMessage(getApiErrorMessage(getClientErrorCode(err), '답글 등록에 실패했습니다.'));
        setReplyForm((prev) => ({ ...prev, submitting: false }));
      }
    },
    [postId, user, replyForm.content, loadComments, queryClient, userKey]
  );

  const handleCommentDelete = useCallback(
    async (commentId: string) => {
      if (!postId || !commentId) return;
      setMessage('');
      try {
        await apiDelete('/v1/posts/{post_id}/comments/{comment_id}', {
          path: { post_id: postId, comment_id: commentId },
        });
        setModalState((prev) => ({ ...prev, commentDeleteId: null }));
        queryClient.setQueryData<PostDetailData>(['post', postId, userKey], (prev) =>
          prev ? { ...prev, commentCount: Math.max(0, (prev.commentCount ?? 0) - 1) } : prev
        );
        await loadComments();
      } catch (err) {
        setMessage(getApiErrorMessage(getClientErrorCode(err), '댓글 삭제에 실패했습니다.'));
      }
    },
    [postId, loadComments, queryClient, userKey]
  );

  const handleCommentEdit = useCallback(
    async (commentId: string, newContent: string) => {
      if (!postId || !commentId || !newContent?.trim()) return;
      setMessage('');
      try {
        await apiPatch('/v1/posts/{post_id}/comments/{comment_id}', {
          path: { post_id: postId, comment_id: commentId },
          body: { content: newContent.trim() },
        });
        setCommentEdit({ editingId: null, content: '' });
        setCommentsOverride((prev) =>
          updateCommentInTree(prev ?? fetchedComments, commentId, {
            content: newContent.trim(),
            isEdited: true,
          })
        );
      } catch (err) {
        setMessage(getApiErrorMessage(getClientErrorCode(err), '댓글 수정에 실패했습니다.'));
      }
    },
    [postId, fetchedComments]
  );

  const handleCommentLike = useCallback(
    async (commentId: string) => {
      if (!postId || !commentId) return;
      if (pendingCommentLikeIdsRef.current.has(commentId)) return;
      if (!user) {
        if (!window.confirm('로그인이 필요한 서비스입니다. 로그인하시겠습니까?')) return;
        sessionStorage.setItem('login_return_path', `/posts/${postId}`);
        navigate('/login');
        return;
      }
      setMessage('');
      pendingCommentLikeIdsRef.current.add(commentId);
      const baseComments = commentsOverride ?? fetchedComments;
      const comment = baseComments.find((c) => c.id === commentId);
      const isCurrentlyLiked = comment?.isLiked ?? false;

      setCommentsOverride((prev) =>
        (prev ?? baseComments).map((c) => {
          if (c.id !== commentId) return c;
          const nextLiked = !c.isLiked;
          return {
            ...c,
            isLiked: nextLiked,
            likeCount: Math.max(0, (c.likeCount ?? 0) + (nextLiked ? 1 : -1)),
          };
        })
      );

      try {
        const req = isCurrentlyLiked
          ? apiDelete('/v1/likes/comments/{comment_id}', { path: { comment_id: commentId } })
          : apiPost('/v1/likes/comments/{comment_id}', { path: { comment_id: commentId } });
        const res = await req;
        const data = (res?.data ?? res) as RawComment | undefined;
        if (data?.likeCount !== undefined || data?.isLiked !== undefined) {
          setCommentsOverride((prev) =>
            (prev ?? baseComments).map((c) =>
              c.id === commentId
                ? {
                    ...c,
                    likeCount: data.likeCount ?? c.likeCount,
                    isLiked: data.isLiked ?? c.isLiked,
                  }
                : c
            )
          );
        }
      } catch (err) {
        if ((err as { status?: number })?.status === 401) {
          if (!window.confirm('로그인이 필요한 서비스입니다. 로그인하시겠습니까?')) return;
          sessionStorage.setItem('login_return_path', `/posts/${postId}`);
          navigate('/login');
          return;
        }
        setCommentsOverride((prev) =>
          (prev ?? baseComments).map((c) => {
            if (c.id !== commentId) return c;
            return {
              ...c,
              isLiked: c.isLiked ?? false,
              likeCount: Math.max(0, (c.likeCount ?? 0) + (c.isLiked ? -1 : 1)),
            };
          })
        );
        setMessage(
          getApiErrorMessage(getClientErrorCode(err), '댓글 좋아요 처리에 실패했습니다.')
        );
      } finally {
        pendingCommentLikeIdsRef.current.delete(commentId);
      }
    },
    [postId, user, navigate, commentsOverride, fetchedComments]
  );

  const handlePostDelete = useCallback(async () => {
    if (!postId) return;
    setMessage('');
    try {
      await apiDelete('/v1/posts/{post_id}', { path: { post_id: postId } });
      setModalState((prev) => ({ ...prev, postDeleteOpen: false }));
      navigate('/posts');
    } catch (err) {
      setMessage(getApiErrorMessage(getClientErrorCode(err), '게시글 삭제에 실패했습니다.'));
    }
  }, [postId, navigate]);

  const handleBlockUser = useCallback(
    async (targetUserId: string) => {
      const meId = user?.userId ?? user?.id;
      if (!targetUserId || !meId) return;
      if (
        !window.confirm(
          '이 사용자를 차단하시겠습니까? 차단한 사용자의 게시글과 댓글이 보이지 않습니다.'
        )
      ) {
        return;
      }
      setMessage('');
      try {
        await apiPost('/v1/users/{target_user_id}/block', {
          path: { target_user_id: targetUserId },
        });
        window.location.reload();
      } catch (err) {
        setMessage(getApiErrorMessage(getClientErrorCode(err), '차단 처리에 실패했습니다.'));
      }
    },
    [user?.userId, user?.id]
  );

  const uniqueFiles = useMemo(() => {
    const files = (post?.files ?? []).filter((f) => safeImageUrl(f.fileUrl, ''));
    const seen = new Set<string>();
    return files.filter((f) => {
      const url = safeImageUrl(f.fileUrl, '');
      if (seen.has(url)) return false;
      seen.add(url);
      return true;
    });
  }, [post?.files]);

  return {
    loading,
    error,
    post,
    comments,
    hasMoreComments: Boolean(commentsQuery.hasNextPage),
    loadingMoreComments: commentsQuery.isFetchingNextPage,
    loadMoreComments,
    loadMoreReplies,
    replyLoadingIds,
    commentSort,
    setCommentSort,
    message,
    modalState,
    setModalState,
    commentForm,
    setCommentForm,
    commentEdit,
    setCommentEdit,
    replyToCommentId,
    setReplyToCommentId,
    replyForm,
    setReplyForm,
    loadPost,
    loadComments,
    handleLike,
    handleCommentLike,
    handleCommentSubmit,
    handleReplySubmit,
    handleCommentDelete,
    handleCommentEdit,
    handlePostDelete,
    handleBlockUser,
    toastMessage,
    setToastMessage,
    uniqueFiles,
  };
}
