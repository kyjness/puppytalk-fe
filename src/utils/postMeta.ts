// 게시글 카테고리·해시태그 입력 파싱 (목록/상세·작성 UI 공용).

export interface PostCategoryOption {
  id: number;
  label: string;
}

export const POST_CATEGORY_OPTIONS: PostCategoryOption[] = [
  { id: 1, label: '자유게시판' },
  { id: 2, label: '질문있어요' },
  { id: 3, label: '강아지자랑' },
  { id: 4, label: '정보공유' },
  { id: 5, label: '나눔해요' },
];

export function getPostCategoryLabel(categoryId: unknown): string {
  const n = Number(categoryId);
  if (!Number.isFinite(n)) return '기타';
  const found = POST_CATEGORY_OPTIONS.find((o) => o.id === n);
  return found?.label ?? '기타';
}

/** 인기게시물 위젯용 짧은 카테고리 라벨 */
const TRENDING_CATEGORY_SHORT: Record<number, string> = {
  1: '자유',
  2: '질문',
  3: '강아지',
  4: '정보',
  5: '나눔',
};

export function getTrendingPostCategoryLabel(categoryId: unknown): string {
  const n = Number(categoryId);
  if (!Number.isFinite(n)) return '기타';
  return TRENDING_CATEGORY_SHORT[n] ?? '기타';
}

/** 쉼표·공백으로 구분된 입력 → 태그 문자열 배열 (# 접두 제거, 빈 토큰 제거). */
export function parseHashtagsInput(raw: unknown): string[] {
  if (raw == null) return [];
  const s = String(raw).trim();
  if (!s) return [];
  const tokens = s
    .split(/[\s,]+/u)
    .map((t) => t.trim().replace(/^#+/u, ''))
    .filter((t) => t.length > 0);
  const uniq: string[] = [];
  const seen = new Set<string>();
  for (const t of tokens) {
    if (seen.has(t)) continue;
    seen.add(t);
    uniq.push(t);
    if (uniq.length >= 6) break;
  }
  return uniq;
}
