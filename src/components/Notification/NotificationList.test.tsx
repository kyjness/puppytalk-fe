/**
 * 알림 목록 — "더보기"가 뜨는 조건 검증.
 *
 * 여기가 버그가 살던 자리다: 서버가 주지 않는 total로 `listTotal > items.length`를 계산해
 * 항상 false가 되었고, 버튼이 렌더된 적이 없어 사용자는 최신 6건 너머를 볼 수 없었다.
 */
import { render as rtlRender, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { NotificationList } from './NotificationList.js';
import { MemoryRouter } from 'react-router-dom';
import type { NotificationItem } from '../../utils/notificationParse.js';

// 개별 알림 항목이 useNavigate를 쓴다 — 라우터 컨텍스트 없이는 렌더 자체가 안 된다.
const render = (ui: React.ReactElement) => rtlRender(<MemoryRouter>{ui}</MemoryRouter>);

const item = (id: string): NotificationItem =>
  ({
    id,
    kind: 'LIKE_POST',
    createdAt: '2026-01-01T00:00:00Z',
    readAt: null,
  }) as NotificationItem;

const base = { loading: false, error: false, onMarkRead: vi.fn(), onMarkAllRead: vi.fn() };

describe('NotificationList', () => {
  it('서버에 다음 페이지가 있으면 더보기가 뜬다', () => {
    render(<NotificationList {...base} items={[item('a')]} listHasMore visibleCount={6} />);
    expect(screen.getByRole('button', { name: '더보기' })).toBeTruthy();
  });

  it('서버에 남은 게 없고 전부 보이면 더보기가 없다', () => {
    render(
      <NotificationList {...base} items={[item('a')]} listHasMore={false} visibleCount={6} />
    );
    expect(screen.queryByRole('button', { name: '더보기' })).toBeNull();
  });

  it('실시간 수신으로 화면 밖에 쌓인 게 있으면 더보기가 뜬다', () => {
    // SSE가 밀어 넣어 items가 visibleCount를 넘긴 상황 — 서버 페이지와 무관하게 보여줘야 한다.
    render(
      <NotificationList
        {...base}
        items={[item('a'), item('b'), item('c')]}
        listHasMore={false}
        visibleCount={2}
      />
    );
    expect(screen.getByRole('button', { name: '더보기' })).toBeTruthy();
  });

  it('더보기를 누르면 상위에 더 요청한다', async () => {
    const onRequestMore = vi.fn();
    render(
      <NotificationList {...base} items={[item('a')]} listHasMore onRequestMore={onRequestMore} />
    );
    await userEvent.click(screen.getByRole('button', { name: '더보기' }));
    expect(onRequestMore).toHaveBeenCalledTimes(1);
  });

  it('visibleCount까지만 렌더한다', () => {
    const { container } = render(
      <NotificationList
        {...base}
        items={[item('a'), item('b'), item('c')]}
        listHasMore={false}
        visibleCount={2}
      />
    );
    // 알림 행은 role="button"이라 클래스로 센다(헤더·더보기 버튼과 구분).
    expect(container.querySelectorAll('.notification-item').length).toBe(2);
  });

  it('로딩·에러 중에는 더보기를 감춘다', () => {
    const { rerender } = render(
      <NotificationList {...base} loading items={[item('a')]} listHasMore />
    );
    expect(screen.queryByRole('button', { name: '더보기' })).toBeNull();
    rerender(<NotificationList {...base} error items={[item('a')]} listHasMore />);
    expect(screen.queryByRole('button', { name: '더보기' })).toBeNull();
  });
});
