// 게시글 이미지 상태: 기존/신규 목록, 추가·삭제·업로드, Object URL revoke.
import { useState, useEffect, useRef, useCallback } from 'react';
import { apiDelete } from '../api/typed.js';
import { uploadImageFile } from '../api/media.js';
import { revokeObjectUrlSafely } from '../utils/index.js';
import type { ExistingImageItem, NewImageItem } from '../api/api-types.js';

export interface InitialExistingImages {
  ids: (string | number)[];
  urls: ExistingImageItem[];
}

export interface UsePostImagesResult {
  existingIds: (string | number)[];
  existingUrls: ExistingImageItem[];
  newImages: NewImageItem[];
  totalCount: number;
  addFiles: (files: FileList | File[]) => void;
  removeExisting: (index: number) => void;
  removeNew: (index: number) => Promise<void>;
  uploadNewImages: () => Promise<NewImageItem[]>;
}

/** initialExisting은 서버에서 받은 기존 이미지 (한 번만 적용). */
export function usePostImages(
  initialExisting: InitialExistingImages | null,
  maxImages = 5
): UsePostImagesResult {
  const [existingIds, setExistingIds] = useState<(string | number)[]>([]);
  const [existingUrls, setExistingUrls] = useState<ExistingImageItem[]>([]);
  const [newImages, setNewImages] = useState<NewImageItem[]>([]);
  const appliedRef = useRef(false);
  const newImagesRef = useRef<NewImageItem[]>([]);

  useEffect(() => {
    newImagesRef.current = newImages;
  }, [newImages]);

  const totalCount = existingUrls.length + newImages.length;

  // 초기 기존 이미지 한 번만 반영 (데이터 로드 시)
  useEffect(() => {
    if (!initialExisting || appliedRef.current) return;
    setExistingIds(initialExisting.ids ?? []);
    setExistingUrls(initialExisting.urls ?? []);
    appliedRef.current = true;
  }, [initialExisting]);

  // 언마운트 시 새 이미지 Object URL 전부 해제 (메모리 누수 방지)
  useEffect(() => {
    return () => {
      newImagesRef.current.forEach((item) => revokeObjectUrlSafely(item.objectUrl));
    };
  }, []);

  const addFiles = useCallback(
    (files: FileList | File[]) => {
      const list = Array.from(files ?? []);
      if (list.length === 0) return;
      setNewImages((prev) => {
        const cap = maxImages - existingUrls.length - prev.length;
        const toAdd = list.slice(0, Math.max(0, cap));
        const next = [...prev];
        for (const file of toAdd) {
          if (next.length + existingUrls.length >= maxImages) break;
          next.push({ file, objectUrl: URL.createObjectURL(file), imageId: null });
        }
        return next;
      });
    },
    [maxImages, existingUrls.length]
  );

  const removeExisting = useCallback((index: number) => {
    setExistingUrls((prev) => {
      const imageId = prev[index]?.imageId;
      if (imageId != null) {
        setExistingIds((ids) => ids.filter((id) => String(id) !== String(imageId)));
      }
      return prev.filter((_, i) => i !== index);
    });
  }, []);

  const removeNew = useCallback(async (index: number) => {
    // 삭제 요청은 업데이터 **밖**에서 — StrictMode는 업데이터를 두 번 호출하므로
    // 안에서 쏘면 DELETE가 두 번 나간다(부수효과를 순수 함수에 넣은 대가).
    let removed: NewImageItem | undefined;
    setNewImages((prev) => {
      removed = prev[index];
      if (!removed) return prev;
      return prev.filter((_, i) => i !== index);
    });
    if (!removed) return;
    revokeObjectUrlSafely(removed.objectUrl);
    if (removed.imageId != null) {
      await apiDelete('/v1/media/images/{image_id}', {
        path: { image_id: removed.imageId },
      }).catch(() => {});
    }
  }, []);

  const uploadNewImages = useCallback(async () => {
    const current = newImagesRef.current.map((item) => ({ ...item }));
    for (let i = 0; i < current.length; i++) {
      if (current[i].imageId != null) continue;
      const data = await uploadImageFile(current[i].file, { purpose: 'post' });
      const id = data?.imageId ?? null;
      if (id == null) {
        console.error('[usePostImages] 이미지 업로드 응답에 imageId 없음:', data);
        throw new Error('이미지 업로드에 실패했습니다. 응답 형식을 확인해 주세요.');
      }
      current[i].imageId = id;
    }
    return current;
  }, []);

  return {
    existingIds,
    existingUrls,
    newImages,
    totalCount,
    addFiles,
    removeExisting,
    removeNew,
    uploadNewImages,
  };
}
