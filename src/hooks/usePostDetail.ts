// 게시글 상세: React Query(게시글·댓글) + 모달·댓글 CRUD.
import { useState, useCallback, useRef, useMemo, type FormEvent } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import type { NavigateFunction } from 'react-router-dom';
import { api } from '../api/client.js';
import { DEFAULT_PROFILE_IMAGE } from '../config.js';
import { useAuth, type AuthUser } from '../context/AuthContext.jsx';
import {
  getApiErrorMessage,
  getClientErrorCode,
  getProfileImageUrl,
  safeImageUrl,
} from '../utils/index.js';

const COMMENT_PAGE_SIZE = 10;
const POST_EDIT_MERGE_KEY = (id: string | number) => `pt_post_edit_merge_${id}`;

// --- 서버 원시 응답 shape (camel/snake 혼재 방어) ---
interface RawAuthor {
  id?: string;
  userId?: string;
  nickname?: string;
  profileImageUrl?: string | null;
  representativeDog?: unknown;
  representative_dog?: unknown;
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
  categoryid?: string | number | null;
  category_id?: string | number | null;
  version?: number | string;
  Version?: number | string;
  isEdited?: boolean;
  isedited?: boolean;
  createdAt?: string;
  createdat?: string;
  files?: unknown;
  file?: unknown;
  likeCount?: number;
  like_count?: number;
  viewCount?: number;
  view_count?: number;
  commentCount?: number;
  comment_count?: number;
  isLiked?: boolean;
}

interface RawComment {
  id?: string;
  author?: RawAuthor | null;
  replies?: unknown;
  createdAt?: string;
  created_at?: string;
  updatedAt?: string;
  updated_at?: string;
  content?: string;
  likeCount?: number;
  like_count?: number;
  isLiked?: boolean;
  is_liked?: boolean;
  parentId?: string | null;
  parent_id?: string | null;
  isEdited?: boolean;
  is_edited?: boolean;
  isedited?: boolean;
  isDeleted?: boolean;
  is_deleted?: boolean;
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
  replies: CommentNode[];
  isEdited: boolean;
  isDeleted: boolean;
}

interface ModalState {
  postDeleteOpen: boolean;
  commentDeleteId: string | null;
  reportOpen: boolean;
  reportTargetType: string | null;
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
  const isMine = !!(
    currentUser &&
    (author?.id === currentUser.userId || author?.userId === currentUser.userId)
  );
  const hashtagsRaw = postData?.hashtags;
  const hashtags = Array.isArray(hashtagsRaw) ? hashtagsRaw.map((t) => String(t)) : [];
  const categoryId =
    postData?.categoryId ?? postData?.categoryid ?? postData?.category_id ?? null;

  const versionRaw = postData?.version ?? postData?.Version;
  const versionNum =
    typeof versionRaw === 'number'
      ? versionRaw
      : versionRaw != null && Number.isFinite(Number(versionRaw))
        ? Number(versionRaw)
        : null;
  const isEdited =
    postData?.isEdited === true ||
    postData?.isedited === true ||
    (versionNum !== null && versionNum > 1);

  const files = (postData?.files ?? (postData?.file ? [postData.file] : [])) as PostFile[];

  return {
    id: postData?.id,
    title: postData?.title ?? '',
    content: postData?.content ?? '',
    category_id: categoryId,
    hashtags,
    isEdited,
    author_nickname: author?.nickname ?? '탈퇴한 사용자',
    author_id: author?.id ?? author?.userId ?? null,
    author_profile_image: getProfileImageUrl(currentUser, author, isMine, DEFAULT_PROFILE_IMAGE),
    author_representative_dog: author?.representativeDog ?? null,
    created_at: postData?.createdAt ?? postData?.createdat ?? '',
    files,
    likes: postData?.likeCount ?? postData?.like_count ?? 0,
    views: postData?.viewCount ?? postData?.view_count ?? 0,
    commentCount: postData?.commentCount ?? postData?.comment_count ?? 0,
    isLiked: postData?.isLiked ?? false,
    isMine,
  };
}

function normalizeComment(c: RawComment, currentUser: AuthUser | null): CommentNode {
  const author = c?.author ?? null;
  const isMine = !!(
    currentUser &&
    (author?.id === currentUser.userId || author?.userId === currentUser.userId)
  );
  const repDog = author?.representativeDog ?? author?.representative_dog ?? null;
  const replies = Array.isArray(c?.replies)
    ? c.replies.map((r) => normalizeComment(r as RawComment, currentUser))
    : [];

  return {
    id: c?.id,
    author_nickname: author?.nickname ?? '탈퇴한 사용자',
    author_profile_image: getProfileImageUrl(currentUser, author, isMine, DEFAULT_PROFILE_IMAGE),
    author_representative_dog: repDog,
    author_id: author?.id ?? author?.userId ?? null,
    created_at: c?.createdAt ?? c?.created_at ?? '',
    updated_at: c?.updatedAt ?? c?.updated_at ?? '',
    content: c?.content ?? '',
    isMine,
    likeCount: c?.likeCount ?? c?.like_count ?? 0,
    isLiked: c?.isLiked ?? c?.is_liked ?? false,
    parentId: c?.parentId ?? c?.parent_id ?? null,
    replies,
    isEdited: c?.isEdited === true || c?.is_edited === true || c?.isedited === true,
    isDeleted: c?.isDeleted ?? c?.is_deleted ?? false,
  };
}

function unwrapCommentsPagePayload(res: unknown): { items: RawComment[]; totalCount: number } {
  if (!res || typeof res !== 'object') return { items: [], totalCount: 0 };
  const o = res as { data?: unknown };
  const inner = (o.data !== undefined ? o.data : res) as {
    items?: unknown;
    totalCount?: number;
    total_count?: number;
  };
  const items = Array.isArray(inner?.items) ? (inner.items as RawComment[]) : [];
  const totalCount = inner?.totalCount ?? inner?.total_count ?? 0;
  return { items, totalCount };
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
  const res = await api.get<{ data?: RawPost | null }>(`/posts/${postId}`);
  const data = res?.data ?? null;
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

async function fetchCommentsPage(
  postId: string,
  commentSort: string,
  page: number,
  user: AuthUser | null
): Promise<{ comments: CommentNode[]; totalCount: number; totalPages: number }> {
  const sortParam =
    commentSort && commentSort !== 'latest' ? `&sort=${encodeURIComponent(commentSort)}` : '';
  const res = await api.get(
    `/posts/${postId}/comments?page=${page}&size=${COMMENT_PAGE_SIZE}${sortParam}`
  );
  const { items: arr, totalCount } = unwrapCommentsPagePayload(res);
  const mapped = arr.map((c) => normalizeComment(c, user));
  return {
    comments: nestFlatCommentsIfNeeded(mapped),
    totalCount,
    totalPages: Math.max(1, Math.ceil(totalCount / COMMENT_PAGE_SIZE)),
  };
}

export function usePostDetail(postId: string, user: AuthUser | null, navigate: NavigateFunction) {
  const { isRestored } = useAuth();
  const queryClient = useQueryClient();
  const [commentSort, setCommentSortState] = useState('latest');
  const listIdentity = `${postId ?? ''}\0${commentSort}`;
  const [pagesByList, setPagesByList] = useState<Record<string, number>>({});
  const commentPage = pagesByList[listIdentity] ?? 1;

  const setCommentPage = useCallback(
    (page: number) => {
      setPagesByList((prev) => ({ ...prev, [listIdentity]: page }));
    },
    [listIdentity]
  );

  const setCommentSort = useCallback(
    (sort: string) => {
      setCommentSortState(sort);
      setPagesByList((prev) => ({ ...prev, [`${postId ?? ''}\0${sort}`]: 1 }));
    },
    [postId]
  );

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

  const userKey = user?.userId ?? user?.id ?? null;

  const postQuery = useQuery({
    queryKey: ['post', postId, userKey],
    queryFn: () => fetchPostNormalized(postId, user),
    enabled: Boolean(postId && isRestored),
  });

  const commentsQuery = useQuery({
    queryKey: ['post', postId, 'comments', commentSort, commentPage, userKey],
    queryFn: () => fetchCommentsPage(postId, commentSort, commentPage, user),
    enabled: Boolean(postId && isRestored),
  });

  const post = postQuery.data ?? null;
  const loading = postQuery.isPending;
  const error = postQuery.isError
    ? getApiErrorMessage(getClientErrorCode(postQuery.error), '게시글을 불러오지 못했습니다.')
    : '';

  const comments = commentsOverride ?? commentsQuery.data?.comments ?? [];
  const commentTotalCount = commentsQuery.data?.totalCount ?? 0;
  const commentTotalPages = commentsQuery.data?.totalPages ?? 1;

  const loadPost = useCallback(async () => {
    await queryClient.invalidateQueries({ queryKey: ['post', postId] });
  }, [queryClient, postId]);

  const loadComments = useCallback(
    async (page = 1) => {
      setCommentsOverride(null);
      setCommentPage(page);
      await queryClient.invalidateQueries({ queryKey: ['post', postId, 'comments'] });
    },
    [queryClient, postId, setCommentPage]
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
        ? await api.delete<{ data?: { likeCount?: number; isLiked?: boolean } }>(`/likes/posts/${postId}`)
        : await api.post<{ data?: { likeCount?: number; isLiked?: boolean } }>(`/likes/posts/${postId}`);
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
        await api.post(`/posts/${postId}/comments`, { content });
        setCommentForm((prev) => ({ ...prev, content: '', submitting: false }));
        queryClient.setQueryData<PostDetailData>(['post', postId, userKey], (prev) =>
          prev ? { ...prev, commentCount: (prev.commentCount ?? 0) + 1 } : prev
        );
        await loadComments(1);
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
        await api.post(`/posts/${postId}/comments`, { content, parentId });
        setReplyForm((prev) => ({ ...prev, content: '', submitting: false }));
        setReplyToCommentId(null);
        queryClient.setQueryData<PostDetailData>(['post', postId, userKey], (prev) =>
          prev ? { ...prev, commentCount: (prev.commentCount ?? 0) + 1 } : prev
        );
        await loadComments(1);
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
        await api.delete(`/posts/${postId}/comments/${commentId}`);
        setModalState((prev) => ({ ...prev, commentDeleteId: null }));
        queryClient.setQueryData<PostDetailData>(['post', postId, userKey], (prev) =>
          prev ? { ...prev, commentCount: Math.max(0, (prev.commentCount ?? 0) - 1) } : prev
        );
        await loadComments(commentPage);
      } catch (err) {
        setMessage(getApiErrorMessage(getClientErrorCode(err), '댓글 삭제에 실패했습니다.'));
      }
    },
    [postId, commentPage, loadComments, queryClient, userKey]
  );

  const handleCommentEdit = useCallback(
    async (commentId: string, newContent: string) => {
      if (!postId || !commentId || !newContent?.trim()) return;
      setMessage('');
      try {
        await api.patch(`/posts/${postId}/comments/${commentId}`, {
          content: newContent.trim(),
        });
        setCommentEdit({ editingId: null, content: '' });
        setCommentsOverride((prev) =>
          updateCommentInTree(prev ?? commentsQuery.data?.comments ?? [], commentId, {
            content: newContent.trim(),
            isEdited: true,
          })
        );
      } catch (err) {
        setMessage(getApiErrorMessage(getClientErrorCode(err), '댓글 수정에 실패했습니다.'));
      }
    },
    [postId, commentsQuery.data?.comments]
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
      const baseComments = commentsOverride ?? commentsQuery.data?.comments ?? [];
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
          ? api.delete<{ data?: RawComment }>(`/likes/comments/${commentId}`)
          : api.post<{ data?: RawComment }>(`/likes/comments/${commentId}`);
        const res = await req;
        const data = (res?.data ?? res) as RawComment | undefined;
        if (
          data?.likeCount !== undefined ||
          data?.like_count !== undefined ||
          data?.isLiked !== undefined ||
          data?.is_liked !== undefined
        ) {
          setCommentsOverride((prev) =>
            (prev ?? baseComments).map((c) =>
              c.id === commentId
                ? {
                    ...c,
                    likeCount: data.likeCount ?? data.like_count ?? c.likeCount,
                    isLiked: data.isLiked ?? data.is_liked ?? c.isLiked,
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
    [postId, user, navigate, commentsOverride, commentsQuery.data?.comments]
  );

  const handlePostDelete = useCallback(async () => {
    if (!postId) return;
    setMessage('');
    try {
      await api.delete(`/posts/${postId}`);
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
        await api.post(`/users/${targetUserId}/block`);
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
    commentTotalCount,
    commentSort,
    setCommentSort,
    message,
    modalState,
    setModalState,
    commentForm,
    setCommentForm,
    commentEdit,
    setCommentEdit,
    setCommentPage,
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
