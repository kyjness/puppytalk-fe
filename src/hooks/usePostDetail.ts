// 게시글 상세: React Query(게시글·댓글) + 모달·댓글 CRUD.
import { useState, useCallback, useEffect, useRef, useMemo, type FormEvent } from 'react';
import { useQuery, useQueryClient, keepPreviousData } from '@tanstack/react-query';
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
  safeImageUrl,
} from '../utils/index.js';

const COMMENT_PAGE_SIZE = 10;
// 로딩 중에도 참조가 안 바뀌게 — 매번 새 []를 만들면 comments memo가 통째로 다시 돈다.
const EMPTY_COMMENTS: CommentNode[] = [];
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

/** 루트별 preview 뒤에 "더보기"로 받은 대댓글을 이어 붙인다(id 기준 dedupe). */
function mergeReplyExtras(
  roots: CommentNode[],
  extras: Record<string, { items: CommentNode[]; hasMore: boolean }>
): CommentNode[] {
  if (Object.keys(extras).length === 0) return roots;
  return roots.map((c) => {
    const extra = c.id ? extras[c.id] : undefined;
    // 빈 페이지(요청 사이에 대댓글이 삭제된 경우)여도 hasMore는 반영해야 한다 —
    // 안 그러면 서버 초기값(true)이 남아 눌러도 아무 일 없는 버튼이 계속 보인다.
    if (!extra) return c;
    return {
      ...c,
      replies: appendDedupedById(c.replies, extra.items),
      hasMoreReplies: extra.hasMore,
    };
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

/** 루트 목록은 total까지, 대댓글(커서)은 total 없이 — 같은 언랩을 공유한다. */
function unwrapCommentsPagePayload(res: unknown): {
  items: RawComment[];
  hasMore: boolean;
  total: number;
} {
  if (!res || typeof res !== 'object') return { items: [], hasMore: false, total: 0 };
  const o = res as { data?: unknown };
  const inner = (o.data !== undefined ? o.data : res) as {
    items?: unknown;
    hasMore?: boolean;
    total?: number;
  };
  const items = Array.isArray(inner?.items) ? (inner.items as RawComment[]) : [];
  return { items, hasMore: Boolean(inner?.hasMore), total: Number(inner?.total ?? 0) };
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

/** 루트 목록은 offset+total이다 — 인기순(변동 축)을 커서로 낼 수 없어서다. */
async function fetchCommentsPage(
  postId: string,
  commentSort: string,
  page: number,
  user: AuthUser | null
): Promise<{ comments: CommentNode[]; total: number }> {
  const res = await apiGet('/v1/posts/{post_id}/comments', {
    path: { post_id: postId },
    query: { page, size: COMMENT_PAGE_SIZE, sort: commentSort },
  });
  const { items: arr, total } = unwrapCommentsPagePayload(res);
  const mapped = arr.map((c) => normalizeComment(c, user));
  return { comments: nestFlatCommentsIfNeeded(mapped), total };
}

/** 한 루트의 대댓글 다음 페이지 — 목록 응답의 preview 뒤를 이어 받는다.
 *
 * 루트의 정렬(`commentSort`)을 넘기지 않는다 — 대댓글엔 좋아요 UI가 없어 인기순이 성립하지
 * 않고, 서버도 축을 `id`로 고정한다(ADR 0016). 생략이 곧 서버 기본값(최신순)이다.
 */
async function fetchRepliesPage(
  postId: string,
  commentId: string,
  cursor: string | null,
  user: AuthUser | null
): Promise<{ replies: CommentNode[]; hasMore: boolean }> {
  const res = await apiGet('/v1/posts/{post_id}/comments/{comment_id}/replies', {
    path: { post_id: postId, comment_id: commentId },
    query: { size: REPLY_PAGE_SIZE, cursor },
  });
  const { items, hasMore } = unwrapCommentsPagePayload(res);
  return { replies: items.map((r) => normalizeComment(r, user)), hasMore };
}

export function usePostDetail(postId: string, user: AuthUser | null, navigate: NavigateFunction) {
  const { isRestored } = useAuth();
  const queryClient = useQueryClient();
  // 기본 인기순 — 동점(좋아요 없음)은 서버 타이브레이커(id DESC)로 최신순이 된다(ADR 0016).
  const [commentSort, setCommentSortState] = useState('popular');
  const [commentPage, setCommentPageState] = useState(1);

  // 루트별로 "더보기"로 이어 받은 대댓글. 서버 preview 뒤에 이어 붙인다.
  const [replyExtras, setReplyExtras] = useState<
    Record<string, { items: CommentNode[]; hasMore: boolean }>
  >({});
  const [replyLoadingIds, setReplyLoadingIds] = useState<ReadonlySet<string>>(new Set());

  // 페이지 위치와 이어받은 대댓글은 "이 글의 이 페이지"에 매달린 상태다 — 대상이 바뀌면
  // 함께 버려야 한다. 정렬 변경·글 이동·페이지 이동이 같은 정리를 공유한다.
  const resetToFirstPage = useCallback(() => {
    setCommentPageState(1);
    // 이미 비어 있으면 새 객체를 만들지 않는다 — 마운트 시 이펙트가 한 번 더 렌더시키는 것 방지.
    setReplyExtras((prev) => (Object.keys(prev).length === 0 ? prev : {}));
  }, []);

  const setCommentSort = useCallback(
    (sort: string) => {
      setCommentSortState(sort);
      // 정렬이 바뀌면 순서 축 자체가 달라진다 — 1쪽부터 다시 본다.
      resetToFirstPage();
    },
    [resetToFirstPage]
  );

  const setCommentPage = useCallback(
    (page: number) => {
      // 같은 쪽이면 아무것도 하지 않는다. 빼면 setReplyExtras가 새 객체를 만들어,
      // 현재 쪽 번호를 눌러본 사용자는 펼쳐둔 답글이 전부 접히는 것만 보게 된다.
      if (page === commentPage) return;
      setCommentPageState(page);
      // 이어받은 대댓글은 이 페이지의 루트들에 매달린 것이다 — preview부터 다시.
      setReplyExtras({});
    },
    [commentPage]
  );

  // 글이 바뀌면 페이지도 1쪽으로. 라우터가 /posts/:id에 같은 element를 재사용하므로
  // 이 state는 글을 넘나들어도 살아남는다 — 3쪽을 보다 댓글 적은 글로 이동하면 빈 목록에
  // 페이지 nav까지 사라져 돌아올 길이 없어진다(커서 시절엔 위치가 쿼리 캐시 안에 있었다).
  useEffect(() => {
    resetToFirstPage();
  }, [postId, resetToFirstPage]);

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
  // 낙관적 갱신은 **id별 패치**로 둔다. 리스트를 통째로 덮으면 서버가 새로 준 페이지가
  // 그 스냅샷에 가려 화면이 얼어붙는다 — 좋아요 한 번에 목록 갱신이 죽던 원인.
  const [optimisticPatches, setOptimisticPatches] = useState<
    Record<string, Partial<CommentNode>>
  >({});

  const isLikingRef = useRef(false);
  const pendingCommentLikeIdsRef = useRef<Set<string>>(new Set());
  const inFlightRepliesRef = useRef<Set<string>>(new Set());

  const userKey = user?.userId ?? user?.id ?? null;

  const postQuery = useQuery({
    queryKey: ['post', postId, userKey],
    queryFn: () => fetchPostNormalized(postId, user),
    enabled: Boolean(postId && isRestored),
  });

  const commentsQuery = useQuery({
    queryKey: ['post', postId, 'comments', commentSort, commentPage, userKey],
    queryFn: () => fetchCommentsPage(postId, commentSort, commentPage, user),
    // 페이지를 넘기는 동안 목록이 빈 화면으로 깜빡이지 않게 직전 페이지를 유지한다.
    placeholderData: keepPreviousData,
    enabled: Boolean(postId && isRestored),
  });

  const post = postQuery.data ?? null;
  const loading = postQuery.isPending;
  const error = postQuery.isError
    ? getApiErrorMessage(getClientErrorCode(postQuery.error), '게시글을 불러오지 못했습니다.')
    : '';

  const fetchedComments = commentsQuery.data?.comments ?? EMPTY_COMMENTS;
  const commentTotalPages = Math.max(
    1,
    Math.ceil((commentsQuery.data?.total ?? 0) / COMMENT_PAGE_SIZE)
  );

  // 쪽수가 줄면(마지막 댓글 삭제 등) 현재 쪽이 범위를 벗어난다 — 그 상태로 두면 빈 목록에
  // 페이지 nav까지 사라져 돌아올 길이 없다. 응답을 받은 뒤에만 판단한다(로딩 중 0으로
  // 내려가는 순간에 끌려가지 않게).
  useEffect(() => {
    if (!commentsQuery.data) return;
    if (commentPage > commentTotalPages) setCommentPage(commentTotalPages);
  }, [commentsQuery.data, commentPage, commentTotalPages, setCommentPage]);

  // 서버 페이지 + 이어받은 대댓글 + 낙관적 패치를 **합성**한다. 셋 중 하나가 나머지를
  // 덮으면 안 된다 — 예전엔 낙관적 갱신이 리스트를 통째로 덮어 페이지 누적이 가려졌다.
  const comments = useMemo(() => {
    const merged = mergeReplyExtras(fetchedComments, replyExtras);
    return Object.entries(optimisticPatches).reduce(
      (acc, [id, patch]) => updateCommentInTree(acc, id, patch),
      merged
    );
  }, [fetchedComments, replyExtras, optimisticPatches]);

  // loadMoreReplies가 커서를 읽을 때 쓰는 최신 스냅샷 — 의존성으로 넣으면 콜백이 매 변경마다
  // 새로 만들어져 목록 전체가 다시 조립된다.
  const commentsRef = useRef(comments);
  useEffect(() => {
    commentsRef.current = comments;
  }, [comments]);

  const loadPost = useCallback(async () => {
    await queryClient.invalidateQueries({ queryKey: ['post', postId] });
  }, [queryClient, postId]);

  const loadComments = useCallback(
    async ({ refetch = true }: { refetch?: boolean } = {}) => {
      // replyExtras는 비우지 않는다 — 커서 축이 그대로라 유효하고, 비우면 새 댓글 하나에
      // 펼쳐둔 스레드가 전부 접힌다. 축이 바뀌는 정렬 변경에서만 비운다(setCommentSort).
      setOptimisticPatches({});
      // refetch=false는 "stale 표시만" — 이어서 페이지를 바꿔 스스로 페치를 유발할 때 쓴다.
      // 둘 다 페치하면 앞의 요청이 취소되며 왕복 하나가 통째로 낭비된다.
      await queryClient.invalidateQueries({
        queryKey: ['post', postId, 'comments'],
        ...(refetch ? {} : { refetchType: 'none' as const }),
      });
    },
    [queryClient, postId]
  );

  // "답글 접기" — 이어받은 것만 버리면 서버 preview와 서버가 준 hasMoreReplies로 자동 복귀한다
  // (mergeReplyExtras가 extra 없는 루트는 건드리지 않는다). 별도 접힘 상태를 두지 않는 이유다.
  const collapseReplies = useCallback((commentId: string) => {
    setReplyExtras((prev) => {
      if (!prev[commentId]) return prev;
      const { [commentId]: _dropped, ...rest } = prev;
      return rest;
    });
  }, []);

  const expandedReplyIds = useMemo<ReadonlySet<string>>(
    () =>
      new Set(
        Object.entries(replyExtras)
          .filter(([, extra]) => extra.items.length > 0)
          .map(([id]) => id)
      ),
    [replyExtras]
  );

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
        const { replies, hasMore } = await fetchRepliesPage(postId, commentId, cursor, user);
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
    [postId, user]
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
        // 새 루트 댓글은 1쪽에 달린다 — 3쪽에 머물면 "등록했는데 아무 일도 안 일어난"
        // 화면이 된다(누적 목록이던 시절엔 없던 문제다).
        // 페이지가 실제로 바뀔 때만 invalidate의 페치를 끈다 — 쿼리 키 변경이 이미 페치를
        // 유발하므로 둘 다 켜면 앞 요청이 취소되며 왕복 하나가 낭비된다. 이미 1쪽이면
        // 키가 그대로라 invalidate가 직접 가져와야 한다(끄면 새 댓글이 안 보인다).
        const movesToFirstPage = commentPage !== 1;
        await loadComments({ refetch: !movesToFirstPage });
        if (movesToFirstPage) setCommentPage(1);
      } catch (err) {
        setMessage(getApiErrorMessage(getClientErrorCode(err), '댓글 등록에 실패했습니다.'));
        setCommentForm((prev) => ({ ...prev, submitting: false }));
      }
    },
    [
      postId,
      user,
      commentForm.content,
      commentPage,
      navigate,
      loadComments,
      setCommentPage,
      queryClient,
      userKey,
    ]
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
        setOptimisticPatches((prev) => ({
          ...prev,
          [commentId]: { ...prev[commentId], content: newContent.trim(), isEdited: true },
        }));
      } catch (err) {
        setMessage(getApiErrorMessage(getClientErrorCode(err), '댓글 수정에 실패했습니다.'));
      }
    },
    [postId]
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
      const comment = commentsRef.current.find((c) => c.id === commentId);
      const isCurrentlyLiked = comment?.isLiked ?? false;
      const nextLiked = !isCurrentlyLiked;
      setOptimisticPatches((prev) => ({
        ...prev,
        [commentId]: {
          ...prev[commentId],
          isLiked: nextLiked,
          likeCount: Math.max(0, (comment?.likeCount ?? 0) + (nextLiked ? 1 : -1)),
        },
      }));

      try {
        const req = isCurrentlyLiked
          ? apiDelete('/v1/likes/comments/{comment_id}', { path: { comment_id: commentId } })
          : apiPost('/v1/likes/comments/{comment_id}', { path: { comment_id: commentId } });
        const res = await req;
        const data = (res?.data ?? res) as RawComment | undefined;
        if (data?.likeCount !== undefined || data?.isLiked !== undefined) {
          setOptimisticPatches((prev) => ({
            ...prev,
            [commentId]: {
              ...prev[commentId],
              ...(data.likeCount !== undefined ? { likeCount: data.likeCount } : {}),
              ...(data.isLiked !== undefined ? { isLiked: data.isLiked } : {}),
            },
          }));
        }
      } catch (err) {
        if ((err as { status?: number })?.status === 401) {
          if (!window.confirm('로그인이 필요한 서비스입니다. 로그인하시겠습니까?')) return;
          sessionStorage.setItem('login_return_path', `/posts/${postId}`);
          navigate('/login');
          return;
        }
        // 롤백 = 패치 제거. 직접 역연산하면 서버 확정분과 겹쳐 어긋난다.
        setOptimisticPatches((prev) => {
          const { [commentId]: _dropped, ...rest } = prev;
          return rest;
        });
        setMessage(
          getApiErrorMessage(getClientErrorCode(err), '댓글 좋아요 처리에 실패했습니다.')
        );
      } finally {
        pendingCommentLikeIdsRef.current.delete(commentId);
      }
    },
    [postId, user, navigate]
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
    commentPage,
    commentTotalPages,
    setCommentPage,
    loadMoreReplies,
    collapseReplies,
    expandedReplyIds,
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
