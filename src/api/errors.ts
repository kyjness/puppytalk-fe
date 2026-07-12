// API 계층 공통 에러: message + 서버 code + HTTP status(+ 부가 details/cause).
// axios 인터셉터·S3 업로드·presign 등에서 던지는 에러를 단일 타입으로 통일한다.

export interface ApiErrorOptions {
  code?: string | null;
  status?: number;
  details?: string;
  cause?: unknown;
}

export class ApiError extends Error {
  code: string | null;
  status?: number;
  details?: string;
  cause?: unknown;

  constructor(message: string, options: ApiErrorOptions = {}) {
    super(message);
    this.name = 'ApiError';
    this.code = options.code ?? null;
    if (options.status !== undefined) this.status = options.status;
    if (options.details !== undefined) this.details = options.details;
    if (options.cause !== undefined) this.cause = options.cause;
  }
}

/** unknown 에러에서 서버 code를 최대한 안전하게 추출(없으면 null). */
export function getErrorCode(error: unknown): string | null {
  if (error instanceof ApiError) return error.code;
  if (error && typeof error === 'object' && 'code' in error) {
    const code = (error as { code?: unknown }).code;
    return typeof code === 'string' ? code : null;
  }
  return null;
}
