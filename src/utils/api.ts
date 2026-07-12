/** ApiResponse 래퍼에서 `data`만 꺼냄 (camelCase 전제). */
export function unwrapApiData<T = unknown>(res: unknown): T | null {
  if (res == null || typeof res !== 'object') return null;
  return (res as { data?: T }).data ?? null;
}
