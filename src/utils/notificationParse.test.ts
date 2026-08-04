/**
 * 알림 목록 응답 파싱 테스트 — **알림 "더보기" 버그가 살던 자리**다.
 *
 * 서버는 CursorPage{items, hasMore}를 주는데 스토어가 total을 읽어 항상 0이 되었고,
 * 그 결과 더보기 버튼이 렌더된 적이 없었다. hasMore가 봉투 어느 형태에서든 제대로
 * 나오는지를 고정한다.
 */
import { describe, expect, it } from 'vitest';
import { parseNotificationListResponse } from './notificationParse.js';

const item = (id: string, readAt: string | null = null) => ({
  id,
  kind: 'LIKE_POST',
  createdAt: '2026-01-01T00:00:00Z',
  readAt,
});

describe('parseNotificationListResponse', () => {
  it('ApiResponse 봉투에서 items·hasMore를 꺼낸다', () => {
    const res = parseNotificationListResponse({
      code: 'OK',
      data: { items: [item('a'), item('b')], hasMore: true },
    });
    expect(res.items.map((i) => i.id)).toEqual(['a', 'b']);
    expect(res.hasMore).toBe(true);
  });

  it('hasMore가 false면 false로 전달한다', () => {
    const res = parseNotificationListResponse({ data: { items: [item('a')], hasMore: false } });
    expect(res.hasMore).toBe(false);
  });

  it('봉투 없이 평면으로 와도 파싱한다', () => {
    const res = parseNotificationListResponse({ items: [item('a')], hasMore: true });
    expect(res.items).toHaveLength(1);
    expect(res.hasMore).toBe(true);
  });

  it('snake_case has_more도 받아들인다', () => {
    const res = parseNotificationListResponse({ data: { items: [item('a')], has_more: true } });
    expect(res.hasMore).toBe(true);
  });

  it('items가 없거나 형식이 어긋나면 빈 목록·hasMore=false', () => {
    expect(parseNotificationListResponse(null).items).toEqual([]);
    expect(parseNotificationListResponse({}).hasMore).toBe(false);
    expect(parseNotificationListResponse({ data: { items: 'nope' } }).items).toEqual([]);
  });

  it('id 없는 항목은 버린다', () => {
    const res = parseNotificationListResponse({
      data: { items: [item('a'), { kind: 'LIKE_POST' }], hasMore: false },
    });
    expect(res.items.map((i) => i.id)).toEqual(['a']);
  });
});
