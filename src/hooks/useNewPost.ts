// 게시글 작성 로직: 폼 상태, usePostImages·자동 textarea 리사이즈, POST /posts.
import {
  useState,
  useRef,
  useEffect,
  useCallback,
  type ChangeEvent,
  type FormEvent,
  type RefObject,
} from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api/client.js';
import { usePostImages } from './usePostImages.js';
import { getApiErrorMessage, validatePostTitle, validatePostContent } from '../utils/index.js';
import { parseHashtagsInput } from '../utils/postMeta.js';

const MAX_IMAGES = 5;

function useAutoResizeTextarea(value: string, minHeight = 260): RefObject<HTMLTextAreaElement | null> {
  const ref = useRef<HTMLTextAreaElement>(null);
  const resize = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    el.style.setProperty('overflow', 'hidden');
    el.style.setProperty('min-height', '0');
    el.style.setProperty('height', '1px');
    void el.offsetHeight;
    const h = Math.max(minHeight, el.scrollHeight);
    el.style.setProperty('min-height', `${minHeight}px`);
    el.style.setProperty('height', `${h}px`, 'important');
    el.style.removeProperty('overflow');
  }, [minHeight]);
  useEffect(() => {
    resize();
  }, [value, resize]);
  return ref;
}

export function useNewPost() {
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [categoryId, setCategoryId] = useState(1);
  const [hashtagsInput, setHashtagsInput] = useState('');
  const [titleError, setTitleError] = useState('');
  const [contentError, setContentError] = useState('');
  const [formError, setFormError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const { newImages, totalCount, addFiles, removeNew, uploadNewImages } = usePostImages(
    null,
    MAX_IMAGES
  );
  const contentRef = useAutoResizeTextarea(content);

  const handleFileChange = useCallback(
    (e: ChangeEvent<HTMLInputElement>) => {
      if (e.target.files?.length) addFiles(e.target.files);
      e.target.value = '';
    },
    [addFiles]
  );

  const handleRemovePreview = useCallback(
    async (type: string, index: number) => {
      if (type === 'new') await removeNew(index);
    },
    [removeNew]
  );

  const handleSubmit = useCallback(
    async (e?: FormEvent) => {
      e?.preventDefault?.();
      if (submitting) return;
      setFormError('');
      setTitleError('');
      setContentError('');

      const titleTrim = title.trim();
      const contentTrim = content.trim();
      const tCheck = validatePostTitle(titleTrim);
      const cCheck = validatePostContent(contentTrim);
      setTitleError(tCheck.ok ? '' : (tCheck.message ?? ''));
      setContentError(cCheck.ok ? '' : (cCheck.message ?? ''));
      if (!tCheck.ok || !cCheck.ok) return;

      setSubmitting(true);
      try {
        const uploaded = await uploadNewImages();
        const imageIds = uploaded.map((x) => x.imageId).filter((id): id is string => id != null);
        const hashtags = parseHashtagsInput(hashtagsInput);
        const res = await api.post<{ data?: { id?: string } }>('/posts', {
          title: titleTrim,
          content: contentTrim,
          imageIds: imageIds.length ? imageIds : undefined,
          categoryId,
          hashtags: hashtags.length ? hashtags : undefined,
        });
        const postId = res?.data?.id;
        alert('게시글이 작성되었습니다!');
        navigate(postId != null ? `/posts/${postId}` : '/posts');
      } catch (err) {
        const e = err as { code?: string; message?: string; status?: number; response?: { status?: number } };
        const code = e?.code ?? e?.message;
        const status = e?.status ?? e?.response?.status;
        if (typeof console !== 'undefined' && console.error) {
          console.error('[NewPost] 게시글 작성 실패:', { code, status, err });
        }
        const message = getApiErrorMessage(code, '게시글 작성에 실패했습니다.');
        setFormError(status === 401 ? `${message} (로그인 상태를 확인해주세요.)` : message);
      } finally {
        setSubmitting(false);
      }
    },
    [submitting, title, content, categoryId, hashtagsInput, uploadNewImages, navigate]
  );

  const handleTitleChange = useCallback((e: ChangeEvent<HTMLInputElement>) => {
    setTitle(e.target.value);
    setTitleError('');
  }, []);

  const handleContentChange = useCallback((e: ChangeEvent<HTMLTextAreaElement>) => {
    setContent(e.target.value);
    setContentError('');
  }, []);

  const handleCategoryChange = useCallback((e: ChangeEvent<HTMLSelectElement>) => {
    setCategoryId(Number(e.target.value));
  }, []);

  const handleHashtagsChange = useCallback((e: ChangeEvent<HTMLInputElement>) => {
    setHashtagsInput(e.target.value);
  }, []);

  return {
    title,
    content,
    categoryId,
    hashtagsInput,
    titleError,
    contentError,
    formError,
    submitting,
    fileInputRef,
    contentRef,
    newImages,
    totalCount,
    MAX_IMAGES,
    handleFileChange,
    handleRemovePreview,
    handleSubmit,
    handleTitleChange,
    handleContentChange,
    handleCategoryChange,
    handleHashtagsChange,
  };
}
