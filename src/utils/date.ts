const WEEKDAY_KO = ['일', '월', '화', '수', '목', '금', '토'] as const;

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

// --- 채팅 말풍선 타임스탬프 ---
// 전체화면 채팅방(ChatRoom)과 플로팅 채팅창(FloatingChatWindow)이 같은 규칙으로
// 날짜 구분선·시각을 그린다 — 규칙이 갈라지면 같은 대화가 두 화면에서 다르게 보인다.

/** 파싱 불가면 null. 서버 `UtcDatetime`은 tz-aware라 오프셋이 실려 온다. */
export function parseDateSafe(iso: string | null | undefined): Date | null {
  const d = parseApiDate(iso);
  return d == null || Number.isNaN(d.getTime()) ? null : d;
}

/** 로컬 타임존 기준 '같은 날' 판정 키 — 날짜 구분선 삽입 여부에 쓴다. */
export function dayKey(d: Date): string {
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
}

/** 날짜 구분선 문구: `2026년 8월 14일 금요일` */
export function formatDayDivider(d: Date): string {
  const weekday = WEEKDAY_KO[d.getDay()] ?? '';
  return `${d.getFullYear()}년 ${d.getMonth() + 1}월 ${d.getDate()}일 ${weekday}요일`;
}

/** 말풍선 옆 시각: `오후 3:07` */
export function formatChatTime12h(d: Date): string {
  const hours24 = d.getHours();
  const period = hours24 < 12 ? '오전' : '오후';
  const hours12 = hours24 % 12 === 0 ? 12 : hours24 % 12;
  const mm = String(d.getMinutes()).padStart(2, '0');
  return `${period} ${hours12}:${mm}`;
}
