// 게시글 수정 Zustand 스토어: 이미지·폼 필드·API·Object URL 해제.
import { create } from 'zustand';
import type {
  ApiResponse,
  ExistingImageItem,
  FileInfo,
  NewImageItem,
  PostResponse,
} from '../api/api-types.js';
import { apiDelete, apiGet, apiPatch } from '../api/typed.js';
import { uploadImageFile } from '../api/media.js';
import {
  getApiErrorMessage,
  revokeObjectUrlSafely,
  validatePostTitle,
  validatePostContent,
} from '../utils/index.js';
import { parseHashtagsInput } from '../utils/postMeta.js';

const MAX_IMAGES = 5;

export interface PostEditState {
  postId: string | null;
  title: string;
  content: string;
  categoryId: number;
  hashtagsInput: string;
  /** GET 시점 버전(백엔드가 내려줄 때만 PATCH에 포함) */
  postVersion: number | null;
  loading: boolean;
  formError: string;
  titleError: string;
  contentError: string;
  submitting: boolean;
  /** 초기 기존 이미지 적용 여부 (한 번만 적용) */
  _initialApplied: boolean;
  existingIds: string[];
  existingUrls: ExistingImageItem[];
  newImages: NewImageItem[];
}

export interface PostEditActions {
  setTitle: (v: string) => void;
  setContent: (v: string) => void;
  setCategoryId: (v: number) => void;
  setHashtagsInput: (v: string) => void;
  setFormError: (v: string) => void;
  loadPost: (postId: string) => Promise<void>;
  addFiles: (files: FileList | File[]) => void;
  removeExisting: (index: number) => void;
  removeNew: (index: number) => Promise<void>;
  uploadNewImages: () => Promise<NewImageItem[]>;
  submit: (postId: string, onSuccess: () => void) => Promise<void>;
  reset: () => void;
}

const getInitialState = (): PostEditState => ({
  postId: null,
  title: '',
  content: '',
  categoryId: 1,
  hashtagsInput: '',
  postVersion: null,
  loading: false,
  formError: '',
  titleError: '',
  contentError: '',
  submitting: false,
  _initialApplied: false,
  existingIds: [],
  existingUrls: [],
  newImages: [],
});

export const usePostStore = create<PostEditState & PostEditActions>((set, get) => ({
  ...getInitialState(),

  setTitle: (v: string) => set({ title: v, titleError: '' }),
  setContent: (v: string) => set({ content: v, contentError: '' }),
  setCategoryId: (v: number) => set({ categoryId: v }),
  setHashtagsInput: (v: string) => set({ hashtagsInput: v }),
  setFormError: (v: string) => set({ formError: v }),

  loadPost: async (postId: string) => {
    set({ loading: true, formError: '', titleError: '', contentError: '', postId });
    try {
      const res = (await apiGet('/v1/posts/{post_id}', {
        path: { post_id: postId },
      })) as ApiResponse<PostResponse>;
      const data = res.data ?? (res as unknown as PostResponse);
      const raw = data as PostResponse & Record<string, unknown>;
      const cidRaw = raw.categoryId ?? raw.categoryid;
      const categoryId =
        cidRaw != null && Number.isFinite(Number(cidRaw)) ? Number(cidRaw) : 1;
      const tagList = Array.isArray(raw.hashtags)
        ? raw.hashtags.map((t: unknown) => String(t))
        : [];
      const hashtagsInput = tagList.join(', ');
      let postVersion: number | null = null;
      const ver = raw.version;
      if (typeof ver === 'number' && Number.isFinite(ver)) postVersion = ver;
      else if (ver != null) {
        const n = Number(ver);
        if (Number.isFinite(n)) postVersion = n;
      }
      const files: FileInfo[] = data.files ?? [];
      const fileRow = (f: FileInfo) => {
        const iid = f.imageId ?? f.id;
        const url = f.fileUrl ?? '';
        return { iid, url };
      };
      const ids = files
        .map(fileRow)
        .map(({ iid }) => iid)
        .filter((id): id is string => typeof id === 'string' && id.length > 0);
      const urls: ExistingImageItem[] = files
        .map(fileRow)
        .filter(({ iid, url }) => Boolean(iid) && url.length > 0)
        .map(({ iid, url }) => ({
          imageId: iid as string,
          fileUrl: url,
        }));
      set({
        title: data.title ?? '',
        content: data.content ?? '',
        categoryId,
        hashtagsInput,
        postVersion,
        existingIds: ids,
        existingUrls: urls,
        _initialApplied: true,
        formError: '',
      });
    } catch (err: unknown) {
      const code = (err as { code?: string; message?: string })?.code ?? (err as Error)?.message;
      set({
        formError: getApiErrorMessage(String(code), '게시글을 불러오지 못했습니다.'),
      });
    } finally {
      set({ loading: false });
    }
  },

  addFiles: (files: FileList | File[]) => {
    const list = Array.from(files ?? []) as File[];
    if (list.length === 0) return;
    const { existingUrls, newImages } = get();
    const cap = MAX_IMAGES - existingUrls.length - newImages.length;
    const toAdd = list.slice(0, Math.max(0, cap));
    const added: NewImageItem[] = toAdd.map((file: File) => ({
      file,
      objectUrl: URL.createObjectURL(file),
      imageId: null,
    }));
    set({ newImages: [...get().newImages, ...added] });
  },

  removeExisting: (index: number) => {
    const { existingUrls, existingIds } = get();
    const item = existingUrls[index];
    const nextUrls = existingUrls.filter((_: ExistingImageItem, i: number) => i !== index);
    const nextIds =
      item?.imageId != null ? existingIds.filter((id: string) => id !== item.imageId) : existingIds;
    set({ existingUrls: nextUrls, existingIds: nextIds });
  },

  removeNew: async (index: number) => {
    const { newImages } = get();
    const entry = newImages[index];
    if (!entry) return;
    if (entry.imageId != null) {
      try {
        await apiDelete('/v1/media/images/{image_id}', { path: { image_id: entry.imageId } });
      } catch {
        /* ignore delete failure */
      }
    }
    revokeObjectUrlSafely(entry.objectUrl);
    set({ newImages: newImages.filter((_item, i) => i !== index) });
  },

  uploadNewImages: async () => {
    const { newImages } = get();
    const current = [...newImages];
    for (let i = 0; i < current.length; i++) {
      if (current[i].imageId != null) continue;
      const data = await uploadImageFile(current[i].file, { purpose: 'post' });
      current[i] = { ...current[i], imageId: data.imageId };
    }
    set({ newImages: current });
    return current;
  },

  submit: async (postId: string, onSuccess: () => void) => {
    const { title, content, categoryId, hashtagsInput, postVersion, existingIds, uploadNewImages } =
      get();
    const titleTrim = title.trim();
    const contentTrim = content.trim();
    const tCheck = validatePostTitle(titleTrim);
    const cCheck = validatePostContent(contentTrim);
    set({
      titleError: tCheck.ok ? '' : (tCheck.message ?? ''),
      contentError: cCheck.ok ? '' : (cCheck.message ?? ''),
      formError: '',
    });
    if (!tCheck.ok || !cCheck.ok) return;
    set({ submitting: true, formError: '' });
    try {
      const uploaded = await uploadNewImages();
      const newIds = uploaded
        .map((x: NewImageItem) => x.imageId)
        .filter((id: string | null): id is string => id != null && id.length > 0);
      const imageIds = [...existingIds, ...newIds].slice(0, MAX_IMAGES);
      const hashtags = parseHashtagsInput(hashtagsInput);
      const body: Record<string, unknown> = {
        title: titleTrim,
        content: contentTrim,
        imageIds,
        categoryId,
        hashtags,
      };
      if (postVersion != null) {
        body.version = postVersion;
      }
      await apiPatch('/v1/posts/{post_id}', { path: { post_id: postId }, body });
      onSuccess();
    } catch (err: unknown) {
      const e = err as { code?: string; message?: string; status?: number };
      const status = e?.status;
      const code = e?.code ?? e?.message;
      if (status === 409 || code === 'CONFLICT') {
        set({
          formError: '다른 사용자가 이미 글을 수정했습니다. 최신 데이터를 확인해주세요.',
        });
        return;
      }
      set({ formError: getApiErrorMessage(String(code), '게시글 수정에 실패했습니다.') });
    } finally {
      set({ submitting: false });
    }
  },

  reset: () => {
    const { newImages } = get();
    newImages.forEach((item: NewImageItem) => revokeObjectUrlSafely(item.objectUrl));
    set(getInitialState());
  },
}));
