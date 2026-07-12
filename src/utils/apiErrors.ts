const API_ERROR_MESSAGES: Record<string, string> = {
  INVALID_PASSWORD_FORMAT:
    '8~20자의 영문 소문자·숫자·특수문자 필수 포함해야 합니다.',
  INVALID_NICKNAME_FORMAT: '닉네임은 한글, 영문, 숫자 1~10자로 입력해주세요.',
  INVALID_EMAIL_FORMAT: '이메일 형식이 올바르지 않습니다.',
  INVALID_CREDENTIALS: '이메일 또는 비밀번호가 일치하지 않습니다.',
  INVALID_REQUEST_BODY: '입력값을 확인해주세요.',
  UNPROCESSABLE_ENTITY: '요청을 처리할 수 없습니다.',
  POST_NOT_FOUND: '게시글을 찾을 수 없습니다.',
  EMAIL_ALREADY_EXISTS: '이미 사용 중인 이메일입니다.',
  NICKNAME_ALREADY_EXISTS: '이미 사용 중인 닉네임입니다.',
  INVALID_FILE_TYPE: '지원하지 않는 파일 형식입니다.',
  FILE_SIZE_EXCEEDED: '파일 크기가 너무 큽니다.',
  SIGNUP_IMAGE_TOKEN_INVALID:
    '프로필 이미지 토큰이 만료되었거나 유효하지 않습니다. 사진을 다시 선택한 뒤 회원가입을 시도해주세요.',
  SIGNUP_IMAGE_TOKEN_ALREADY_USED: '이미 사용된 프로필 이미지입니다. 사진을 다시 선택해주세요.',
  RATE_LIMIT_EXCEEDED: '요청이 너무 많습니다. 잠시 후 다시 시도해주세요.',
  LOGIN_RATE_LIMIT_EXCEEDED: '로그인 시도 횟수가 제한되었습니다. 1분 후 다시 시도해주세요.',
  UNAUTHORIZED: '로그인이 필요합니다. 다시 로그인해주세요.',
  INVALID_REQUEST: '요청 내용을 확인해주세요.',
  USER_WITHDRAWN: '탈퇴한 유저입니다.',
  INTERNAL_SERVER_ERROR: '서버 오류가 발생했습니다. 잠시 후 다시 시도해주세요.',
  POST_FILE_LIMIT_EXCEEDED: '이미지는 최대 5장까지 첨부할 수 있습니다.',
  POST_HASHTAG_LIMIT_EXCEEDED: '해시태그는 최대 6개까지 입력할 수 있습니다.',
  CONFLICT: '요청이 처리 중입니다. 잠시 후 다시 시도해주세요.',
  DB_ERROR: '서버 오류가 발생했습니다. 잠시 후 다시 시도해주세요.',
};

export const PASSWORD_POLICY_TEXT = API_ERROR_MESSAGES.INVALID_PASSWORD_FORMAT;

/** PATCH /users/me/password 새 비밀번호: 백엔드 PasswordUpdateStr (8~128자) */
export const PASSWORD_POLICY_TEXT_CHANGE =
  '8~128자의 영문 소문자·숫자·특수문자 필수 포함해야 합니다.';

export function getApiErrorMessage(code: unknown, fallback = '처리에 실패했습니다.'): string {
  const key = (code ?? '').toString().toUpperCase();
  return API_ERROR_MESSAGES[key] || fallback;
}

/** api 래퍼·Axios 에러에서 코드 추출 */
export function getClientErrorCode(err: unknown): string {
  if (err == null) return '';
  const e = err as {
    response?: { data?: { code?: unknown; detail?: { code?: unknown } } };
    code?: unknown;
    message?: unknown;
  };
  const fromAxios = e.response?.data?.code ?? e.response?.data?.detail?.code;
  const raw = fromAxios ?? e.code ?? e.message ?? '';
  return typeof raw === 'string' ? raw : String(raw);
}
