/**
 * 커서 파생 테스트 — 게시글 피드·댓글·대댓글·차단 목록·채팅이 전부 이 함수 하나에 의존한다.
 * 여기서 null을 잘못 내면 "더보기"가 영영 안 뜨거나 같은 페이지를 무한히 다시 받는다.
 */
import { describe, expect, it } from 'vitest';
import { nextCursorFromPage } from './cursorPage.js';

describe('nextCursorFromPage', () => {
  it('다음 페이지가 있으면 마지막 항목의 id를 준다', () => {
    expect(nextCursorFromPage([{ id: 'a' }, { id: 'b' }], true)).toBe('b');
  });

  it('hasMore가 false면 null — 끝인데 커서를 주면 같은 페이지를 다시 받는다', () => {
    expect(nextCursorFromPage([{ id: 'a' }, { id: 'b' }], false)).toBeNull();
  });

  it('빈 페이지는 null', () => {
    expect(nextCursorFromPage([], true)).toBeNull();
  });

  it('마지막 항목에 id가 없으면 null — 빈 커서를 보내 첫 페이지로 되돌아가지 않게', () => {
    expect(nextCursorFromPage([{ id: 'a' }, {}], true)).toBeNull();
    expect(nextCursorFromPage([{ id: 'a' }, { id: null }], true)).toBeNull();
    expect(nextCursorFromPage([{ id: 'a' }, { id: '' }], true)).toBeNull();
  });

  it('id가 숫자여도 문자열로 준다', () => {
    expect(nextCursorFromPage([{ id: 7 }], true)).toBe('7');
  });
});
