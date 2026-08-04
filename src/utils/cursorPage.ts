// 커서 페이지네이션 공용 규칙: BE 표준 응답 {items, hasMore}에서 다음 커서를 파생.

/**
 * DESC 페이지의 다음(더 과거) 커서 — hasMore면 마지막 item의 id, 아니면 null.
 * posts 피드·채팅 메시지 등 CursorPage 소비자가 공유한다(규칙 정의처 한 곳).
 */
export function nextCursorFromPage(items: readonly unknown[], hasMore: boolean): string | null {
  if (!hasMore || items.length === 0) return null;
  const last = items[items.length - 1];
  const id = last != null && typeof last === 'object' ? (last as { id?: unknown }).id : null;
  const s = id == null ? '' : String(id);
  return s.length > 0 ? s : null;
}

/**
 * 다음 페이지를 이어붙인다 — 이미 있는 id는 건너뛴다.
 *
 * 커서 페이지네이션에서 재조회·낙관적 갱신·실시간 수신이 겹치면 같은 항목이 두 번 들어올 수
 * 있다. 커서 규칙과 같은 곳에 두어 소비자마다 다르게 구현하지 않게 한다.
 */
export function appendDedupedById<T extends { id?: unknown }>(
  prev: readonly T[],
  next: readonly T[]
): T[] {
  if (next.length === 0) return prev as T[];
  const seen = new Set(prev.map((x) => x.id));
  return [...prev, ...next.filter((x) => x.id != null && !seen.has(x.id))];
}
