/**
 * 인증·프로필 관련 훅이 만드는 요청 검증.
 *
 * 이 계열은 본문(body)이 계약의 핵심이다 — 경로는 하나뿐이라 헷갈릴 일이 없지만,
 * 필드 이름을 잘못 실으면 422가 나거나(운 나쁘면) 조용히 무시된다.
 */
import { renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const get = vi.fn();
const post = vi.fn();
const patch = vi.fn();
const del = vi.fn();

vi.mock('../api/client.js', () => ({
  api: { get, post, patch, delete: del },
  getStoredAccessToken: () => 'tok',
}));

const setUser = vi.fn();
vi.mock('../context/AuthContext.jsx', () => ({
  useAuth: () => ({ user: { userId: 'me', dogs: [] }, setUser, isLoggedIn: false, isRestored: true }),
}));

const { useLogin } = await import('./useLogin.js');
const { useSignup } = await import('./useSignup.js');
const { useChangePassword } = await import('./useChangePassword.js');
const { useEditProfile } = await import('./useEditProfile.js');

const wrapper = ({ children }: { children: ReactNode }) => <MemoryRouter>{children}</MemoryRouter>;

beforeEach(() => {
  get.mockReset().mockResolvedValue({ code: 'OK', data: { id: 'me', nickname: 'n', dogs: [] } });
  post.mockReset().mockResolvedValue({ code: 'OK', data: { id: 'me', accessToken: 't' } });
  patch.mockReset().mockResolvedValue({ code: 'OK', data: { id: 'me' } });
  del.mockReset().mockResolvedValue({ code: 'OK', data: null });
  setUser.mockClear();
  vi.stubGlobal('alert', vi.fn());
});

describe('useLogin', () => {
  it('로그인은 email·password를 본문에 싣는다', async () => {
    const { result } = renderHook(() => useLogin(), { wrapper });
    result.current.handleEmailChange({ target: { value: 'a@b.com' } } as never);
    result.current.handlePasswordChange({ target: { value: 'PwPwPw123!' } } as never);
    await waitFor(() => expect(result.current.email).toBe('a@b.com'));

    await result.current.handleSubmit({ preventDefault: () => {} } as never);

    expect(post.mock.calls[0][0]).toBe('/auth/login');
    expect(post.mock.calls[0][1]).toEqual({ email: 'a@b.com', password: 'PwPwPw123!' });
  });

  it('로그인 후 프로필을 다시 읽어 사용자 상태를 채운다', async () => {
    const { result } = renderHook(() => useLogin(), { wrapper });
    result.current.handleEmailChange({ target: { value: 'a@b.com' } } as never);
    result.current.handlePasswordChange({ target: { value: 'PwPwPw123!' } } as never);
    await waitFor(() => expect(result.current.email).toBe('a@b.com'));

    await result.current.handleSubmit({ preventDefault: () => {} } as never);

    expect(get.mock.calls.map((c) => c[0])).toContain('/users/me');
  });
});

describe('useChangePassword', () => {
  it('현재·새 비밀번호를 본문에 싣는다', async () => {
    const { result } = renderHook(() => useChangePassword(), { wrapper });
    result.current.handleFieldChange('currentPassword')({
      target: { value: 'OldPw123!' },
    } as never);
    result.current.handleFieldChange('newPassword')({ target: { value: 'NewPw123!' } } as never);
    result.current.handleFieldChange('newPasswordConfirm')({
      target: { value: 'NewPw123!' },
    } as never);
    await waitFor(() => expect(result.current.formData.newPassword).toBe('NewPw123!'));

    await result.current.handleSubmit({ preventDefault: () => {} } as never);

    expect(patch.mock.calls[0][0]).toBe('/users/me/password');
    expect(patch.mock.calls[0][1]).toEqual({
      currentPassword: 'OldPw123!',
      newPassword: 'NewPw123!',
    });
  });
});

describe('useEditProfile', () => {
  it('회원 탈퇴는 users/me를 지운다', async () => {
    const { result } = renderHook(() => useEditProfile(), { wrapper });

    await result.current.handleDeleteAccount();

    expect(del.mock.calls[0][0]).toBe('/users/me');
  });
});

describe('useSignup', () => {
  it('훅이 라우터 컨텍스트에서 정상 마운트된다', () => {
    const { result } = renderHook(() => useSignup(), { wrapper });
    expect(result.current).toBeTruthy();
  });
});
