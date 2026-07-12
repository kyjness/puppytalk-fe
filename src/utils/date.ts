function parseApiDate(dateString: unknown): Date | null {
  if (!dateString || typeof dateString !== 'string') return null;
  const s = dateString.trim();
  if (!s) return null;
  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(s) && !/[Z+-]\d{2}:?\d{2}$/.test(s)) {
    return new Date(s + (s.endsWith('Z') ? '' : 'Z'));
  }
  return new Date(s);
}

/** ISO 날짜 문자열 → YYYY-MM-DD HH:mm (초 없음) */
export function formatDateTime(dateString: string | null | undefined): string {
  if (!dateString) return '';
  const date = parseApiDate(dateString);
  if (!date || Number.isNaN(date.getTime())) return '';
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  const h = String(date.getHours()).padStart(2, '0');
  const min = String(date.getMinutes()).padStart(2, '0');
  return `${y}-${m}-${d} ${h}:${min}`;
}
