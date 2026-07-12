// 게시글 검색어 검증 (백엔드 validate_search_query와 동일 규칙).

const POST_SEARCH_MIN_TOKEN_LEN = 3;
const POST_SEARCH_MIN_TOKEN_LEN_HANGUL = 2;
const POST_SEARCH_MIN_TOKEN_LEN_DIGIT = 2;

export type FeedSearchValidation =
  | { ok: true; q: string | null }
  | { ok: false; message: string };

function _minTokenLength(token: string): number {
  if (/[가-힣]/.test(token)) return POST_SEARCH_MIN_TOKEN_LEN_HANGUL;
  if (/^\d+$/.test(token)) return POST_SEARCH_MIN_TOKEN_LEN_DIGIT;
  return POST_SEARCH_MIN_TOKEN_LEN;
}

function _isTokenTooShort(token: string): boolean {
  return token.length < _minTokenLength(token);
}

export function tokenizeSearchQuery(raw: string): string[] {
  return raw.split(/\s+/).filter(Boolean);
}

export function validateSearchQueryForFeed(q: string | null | undefined): FeedSearchValidation {
  const stripped = (q ?? '').trim();
  if (!stripped) return { ok: true, q: null };

  if (stripped.startsWith('#')) {
    const tagName = stripped.replace(/^#+/, '').trim().toLowerCase();
    if (!tagName) {
      return { ok: false, message: '검색할 해시태그를 입력해주세요.' };
    }
    return { ok: true, q: stripped };
  }

  const tokens = tokenizeSearchQuery(stripped);
  if (tokens.length === 0) return { ok: true, q: null };

  if (tokens.some(_isTokenTooShort)) {
    return {
      ok: false,
      message:
        '검색어는 공백으로 구분된 각 단어가 최소 2글자(한글·숫자) 또는 3글자(영문) 이상이어야 합니다.',
    };
  }

  return { ok: true, q: stripped };
}
