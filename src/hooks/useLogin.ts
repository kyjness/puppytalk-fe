// 로그인 페이지 로직: 폼 상태, 유효성 검사, POST /auth/login, setUser·리다이렉트.
import { useState, useCallback, type ChangeEvent, type FormEvent } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { apiGet, apiPost } from '../api/typed.js';
import { useAuth } from '../context/AuthContext.jsx';
import { getApiErrorMessage, isValidEmail, unwrapApiData } from '../utils/index.js';

interface LoginUserData {
  id?: string;
  userId?: string;
  email?: string;
  nickname?: string;
  profileImageUrl?: string | null;
  accessToken?: string;
  dogs?: unknown[];
}

export function useLogin() {
  const navigate = useNavigate();
  const location = useLocation();
  const { setUser, isLoggedIn } = useAuth();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [emailError, setEmailError] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [formError, setFormError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const from =
    (location.state as { from?: { pathname?: string } } | null)?.from?.pathname || '/posts';

  const handleEmailChange = useCallback((e: ChangeEvent<HTMLInputElement>) => {
    setEmail(e.target.value);
    setEmailError('');
  }, []);

  const handlePasswordChange = useCallback((e: ChangeEvent<HTMLInputElement>) => {
    setPassword(e.target.value);
    setPasswordError('');
    setFormError('');
  }, []);

  const handleSubmit = useCallback(
    async (e: FormEvent) => {
      e.preventDefault();
      setEmailError('');
      setPasswordError('');
      setFormError('');

      const emailTrim = email.trim();
      const passwordVal = password ?? '';

      let hasError = false;
      if (!emailTrim) {
        setEmailError('이메일을 입력해주세요.');
        hasError = true;
      } else if (!isValidEmail(emailTrim)) {
        setEmailError(getApiErrorMessage('INVALID_EMAIL_FORMAT'));
        hasError = true;
      }
      if (!passwordVal.trim()) {
        setPasswordError('비밀번호를 입력해주세요.');
        hasError = true;
      }
      if (hasError) return;

      setSubmitting(true);
      try {
        const result = (await apiPost('/v1/auth/login', {
          body: { email: emailTrim, password: passwordVal },
        })) as { data?: LoginUserData };
        const data = unwrapApiData<LoginUserData>(result) ?? result?.data;
        if (data) {
          const accessToken = data.accessToken ?? result?.data?.accessToken;
          const baseUser = {
            userId: data.id ?? data.userId,
            email: data.email,
            nickname: data.nickname,
            profileImageUrl: data.profileImageUrl,
            accessToken,
          };
          setUser({ ...baseUser, dogs: data.dogs ?? [] });
          let me: LoginUserData | null = null;
          for (let attempt = 0; attempt < 3; attempt++) {
            try {
              const meRes = await apiGet('/v1/users/me', {});
              me = unwrapApiData<LoginUserData>(meRes);
              if (me) break;
            } catch (_) {
              if (attempt < 2) {
                await new Promise((r) => setTimeout(r, 200 * (attempt + 1)));
              }
            }
          }
          if (me) {
            setUser({
              ...baseUser,
              ...me,
              userId: me.id ?? baseUser.userId,
              accessToken: accessToken ?? baseUser.accessToken,
              dogs: me.dogs ?? [],
            });
          }
        }
        const returnPath =
          (typeof window !== 'undefined' && sessionStorage.getItem('login_return_path')) || from;
        if (typeof sessionStorage !== 'undefined') sessionStorage.removeItem('login_return_path');
        navigate(returnPath, { replace: true });
      } catch (err) {
        const e2 = err as { code?: string; message?: string };
        const code = (e2?.code || e2?.message || '').toString().toUpperCase();
        const isBodyValidation =
          code === 'INVALID_REQUEST_BODY' || code === 'UNPROCESSABLE_ENTITY';
        const message = isBodyValidation
          ? getApiErrorMessage('INVALID_PASSWORD_FORMAT')
          : getApiErrorMessage(code, '이메일과 비밀번호를 확인한 뒤 다시 시도해주세요.');
        setPasswordError(isBodyValidation ? message : '');
        setFormError(isBodyValidation ? '' : message);
      } finally {
        setSubmitting(false);
      }
    },
    [email, password, from, setUser, navigate]
  );

  return {
    email,
    password,
    emailError,
    passwordError,
    formError,
    submitting,
    isLoggedIn,
    from,
    navigate,
    handleSubmit,
    handleEmailChange,
    handlePasswordChange,
  };
}
