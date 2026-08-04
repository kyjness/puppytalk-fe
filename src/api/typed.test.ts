/**
 * URL 조립 테스트.
 *
 * 타입은 "모양"만 보증한다 — 경로 변수를 제자리에 넣었는지, 쿼리를 빠뜨리지 않았는지는
 * 타입이 통과해도 런타임에서만 드러난다. 그래서 이 순수 함수만 따로 검증한다.
 */
import { describe, expect, it } from 'vitest';
import { buildUrl } from './typed.js';

describe('buildUrl', () => {
  it('스펙의 /v1 접두사를 뗀다 — BASE_URL(/api/v1)이 이미 포함한다', () => {
    expect(buildUrl('/v1/users/me')).toBe('/users/me');
  });

  it('경로 변수를 값으로 치환한다', () => {
    expect(
      buildUrl('/v1/posts/{post_id}/comments/{comment_id}/replies', {
        path: { post_id: 'abc', comment_id: 'xyz' },
      })
    ).toBe('/posts/abc/comments/xyz/replies');
  });

  it('경로 변수를 URL 인코딩한다', () => {
    expect(buildUrl('/v1/chat/rooms/{room_id}', { path: { room_id: 'a/b?c' } })).toBe(
      '/chat/rooms/a%2Fb%3Fc'
    );
  });

  it('경로 변수가 비면 조용히 잘못된 URL을 만들지 않고 던진다', () => {
    // 이전 코드는 `/admin/users/${undefined}/suspend`를 그대로 보냈다.
    expect(() => buildUrl('/v1/posts/{post_id}', { path: { post_id: '' } })).toThrow(/post_id/);
    expect(() => buildUrl('/v1/posts/{post_id}', {})).toThrow(/post_id/);
  });

  it('쿼리를 직렬화한다', () => {
    expect(buildUrl('/v1/posts', { query: { size: 10, q: '강아지' } })).toBe(
      '/posts?size=10&q=%EA%B0%95%EC%95%84%EC%A7%80'
    );
  });

  it('undefined·null 쿼리 값은 보내지 않는다 — 첫 페이지 요청에 cursor=null이 붙으면 안 된다', () => {
    expect(buildUrl('/v1/posts', { query: { size: 10, cursor: undefined, q: null } })).toBe(
      '/posts?size=10'
    );
  });

  it('쿼리가 비면 물음표를 붙이지 않는다', () => {
    expect(buildUrl('/v1/posts', { query: {} })).toBe('/posts');
  });

  it('0과 false는 유효한 값이라 보낸다', () => {
    expect(buildUrl('/v1/posts', { query: { size: 0, flag: false } })).toBe(
      '/posts?size=0&flag=false'
    );
  });
});
