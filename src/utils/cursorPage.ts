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
