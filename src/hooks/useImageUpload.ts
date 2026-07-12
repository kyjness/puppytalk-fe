// S3 Presigned POST 업로드 React Query mutation 래퍼.
import { useMutation, type UseMutationOptions } from '@tanstack/react-query';
import { uploadImageFile, type ImageUploadPurpose, type ImageUploadResult } from '../api/media.js';

export interface ImageUploadVariables {
  file: File;
  purpose?: ImageUploadPurpose;
}

/** Presigned POST 파이프라인 useMutation. */
export function useImageUpload(
  options: Omit<
    UseMutationOptions<ImageUploadResult, Error, ImageUploadVariables>,
    'mutationFn'
  > = {}
) {
  return useMutation({
    mutationFn: ({ file, purpose = 'post' }: ImageUploadVariables) =>
      uploadImageFile(file, { purpose }),
    ...options,
  });
}
