// S3 Presigned POST 이미지 업로드: presign(axios) → S3(fetch) → confirm(axios).
// S3 단계에는 절대 api/axios 인스턴스를 쓰지 않는다(Bearer 헤더 시 400).
import { apiPost } from './typed.js';
import { ApiError } from './errors.js';
import { getImageUploadData } from '../utils/index.js';

/** 백엔드 Presigned POST content-length-range 상한(10MB) */
export const PRESIGNED_MAX_BYTES = 10 * 1024 * 1024;

export const PRESIGNED_ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp'] as const;

export type ImageUploadPurpose = 'post' | 'profile' | 'signup';

interface PresignData {
  url: string;
  fields: Record<string, string>;
  fileKey: string;
}

/** 업로드 확정 결과(이미지 ID·URL·회원가입 토큰). */
export interface ImageUploadResult {
  imageId: string | null;
  url: string | null;
  signupToken: string | null;
}

function unwrapPresignResponse(res: unknown): PresignData {
  const step1 = (res as { data?: unknown })?.data ?? res;
  const data = (step1 as { data?: unknown })?.data ?? step1;
  const payload = (data as { data?: unknown })?.data ?? data;
  const p = payload as Partial<PresignData> | null | undefined;
  const url = p?.url;
  const fields = p?.fields;
  const fileKey = p?.fileKey;
  if (!url || !fields || !fileKey) {
    throw new ApiError('Presign response is missing url, fields, or fileKey.', {
      code: 'PRESIGN_INVALID_RESPONSE',
    });
  }
  return { url, fields, fileKey };
}

/** 클라이언트 선검증: 타입·10MB 상한(S3 거부 전 UX). */
export function validateImageFileForPresignedUpload(file: File | null | undefined): void {
  if (!file) {
    throw new ApiError('MISSING_REQUIRED_FIELD', { code: 'MISSING_REQUIRED_FIELD' });
  }
  if (!(PRESIGNED_ALLOWED_IMAGE_TYPES as readonly string[]).includes(file.type)) {
    throw new ApiError('INVALID_FILE_TYPE', { code: 'INVALID_FILE_TYPE' });
  }
  if (file.size < 1 || file.size > PRESIGNED_MAX_BYTES) {
    throw new ApiError('FILE_SIZE_EXCEEDED', { code: 'FILE_SIZE_EXCEEDED' });
  }
}

/**
 * presign 요청. 경로를 문자열 변수로 넘기지 않고 purpose로 분기한다 —
 * 동적 경로 문자열은 타입 검사를 통째로 무력화한다(signup은 JWT 불필요한 별도 경로).
 */
async function requestPresign(
  purpose: ImageUploadPurpose,
  body: { filename: string; contentType: string }
): Promise<PresignData> {
  const res =
    purpose === 'signup'
      ? await apiPost('/v1/media/images/signup/presign', { body })
      : await apiPost('/v1/media/images/presign', { body });
  return unwrapPresignResponse(res);
}

/** S3 Presigned POST 업로드. 순수 fetch만 사용(Authorization 미전송). */
export async function postFileToS3(
  url: string,
  fields: Record<string, string>,
  file: File
): Promise<void> {
  const formData = new FormData();

  // IMPORTANT: S3는 policy에 명시된 field를 file보다 먼저 받아야 함. 순서 변경 금지.
  for (const [key, value] of Object.entries(fields)) {
    if (value != null && value !== '') {
      formData.append(key, String(value));
    }
  }
  // file은 반드시 마지막 append
  formData.append('file', file, file.name);

  let response: Response;
  try {
    response = await fetch(url, {
      method: 'POST',
      body: formData,
      credentials: 'omit',
    });
  } catch (networkErr) {
    throw new ApiError(
      'S3 업로드에 실패했습니다. 브라우저 개발자 도구(Network)에서 CORS 오류 여부를 확인하고, ' +
        'S3 버킷 CORS에 이 사이트 Origin과 POST 메서드가 허용되어 있는지 점검하세요.',
      { code: 'S3_UPLOAD_NETWORK_ERROR', cause: networkErr }
    );
  }

  if (!response.ok) {
    const detail = await response.text().catch(() => '');
    throw new ApiError(`S3 upload rejected (${response.status})`, {
      code: 'S3_UPLOAD_FAILED',
      status: response.status,
      details: detail,
    });
  }
}

async function requestConfirm(
  purpose: ImageUploadPurpose,
  fileKey: string,
  file: File
): Promise<ImageUploadResult> {
  const res =
    purpose === 'signup'
      ? await apiPost('/v1/media/images/signup/confirm', {
          body: { fileKey, size: file.size },
        })
      : await apiPost('/v1/media/images/confirm', {
          body: { fileKey, purpose, size: file.size },
        });
  return getImageUploadData(res);
}

/** Presign → S3(fetch) → Confirm 전체 파이프라인. */
export async function uploadImageFile(
  file: File,
  { purpose = 'post' }: { purpose?: ImageUploadPurpose } = {}
): Promise<ImageUploadResult> {
  validateImageFileForPresignedUpload(file);

  const { url, fields, fileKey } = await requestPresign(purpose, {
    filename: file.name,
    contentType: file.type,
  });

  await postFileToS3(url, fields, file);

  return requestConfirm(purpose, fileKey, file);
}
