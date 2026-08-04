/**
 * 업로드 경로 분기 검증.
 *
 * signup(가입 중, JWT 없음)과 일반 업로드는 **다른 엔드포인트**를 쓴다. 이전 구현은 경로를
 * 문자열 변수로 넘겨 타입 검사를 우회했고, 분기가 뒤바뀌어도 컴파일은 통과했다.
 * 이제는 purpose로 분기하므로, 그 분기가 실제로 맞는 경로를 부르는지 여기서 고정한다.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

const post = vi.fn();
vi.mock('./client.js', async () => {
  const actual = await vi.importActual<typeof import('./client.js')>('./client.js');
  return { ...actual, api: { get: vi.fn(), post, patch: vi.fn(), delete: vi.fn() } };
});

const { uploadImageFile } = await import('./media.js');

function mockPresignThenConfirm() {
  post
    .mockResolvedValueOnce({
      code: 'OK',
      data: { url: 'https://s3.test/bucket', fields: { key: 'k' }, fileKey: 'pending/k.png' },
    })
    .mockResolvedValueOnce({ code: 'OK', data: { imageId: 'img-1', fileUrl: 'https://cdn/k.png' } });
}

beforeEach(() => {
  post.mockReset();
  vi.stubGlobal(
    'fetch',
    vi.fn().mockResolvedValue({ ok: true, status: 204, text: async () => '' })
  );
});

const file = () => new File([new Uint8Array([1, 2, 3])], 'dog.png', { type: 'image/png' });

describe('uploadImageFile', () => {
  it('일반 업로드는 인증 경로를 쓴다', async () => {
    mockPresignThenConfirm();
    await uploadImageFile(file(), { purpose: 'post' });
    expect(post.mock.calls[0][0]).toBe('/media/images/presign');
    expect(post.mock.calls[1][0]).toBe('/media/images/confirm');
  });

  it('가입 중 업로드는 signup 전용 경로를 쓴다 — 뒤바뀌면 인증이 없어 401이다', async () => {
    mockPresignThenConfirm();
    await uploadImageFile(file(), { purpose: 'signup' });
    expect(post.mock.calls[0][0]).toBe('/media/images/signup/presign');
    expect(post.mock.calls[1][0]).toBe('/media/images/signup/confirm');
  });

  it('confirm 본문에 fileKey와 크기를 싣는다', async () => {
    mockPresignThenConfirm();
    await uploadImageFile(file(), { purpose: 'post' });
    const body = post.mock.calls[1][1] as Record<string, unknown>;
    expect(body.fileKey).toBe('pending/k.png');
    expect(body.size).toBe(3);
    expect(body.purpose).toBe('post');
  });

  it('signup confirm에는 purpose를 싣지 않는다(서버 계약)', async () => {
    mockPresignThenConfirm();
    await uploadImageFile(file(), { purpose: 'signup' });
    expect(post.mock.calls[1][1]).not.toHaveProperty('purpose');
  });
});
