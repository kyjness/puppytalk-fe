// 로그인 페이지: useLogin 훅 + LoginForm 조합.
import { Header } from '../components/Header.jsx';
import { useLogin } from '../hooks/useLogin.js';
import { LoginForm } from '../components/Login';

export function Login() {
  const {
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
  } = useLogin();

  if (isLoggedIn) {
    navigate(from, { replace: true });
    return null;
  }

  return (
    <Header showProfile={false}>
      <main className="flex flex-1 items-center justify-center bg-[var(--app-bg)] px-[16px] pt-[8px]">
        <div className="w-full max-w-[var(--form-max)] p-0 m-0 rounded-none bg-transparent shadow-none">
          <h2 className="mb-6 text-center font-['Pretendard'] text-[25px] font-bold leading-[25px] text-black">
            로그인
          </h2>
          <LoginForm
            email={email}
            password={password}
            emailError={emailError}
            passwordError={passwordError}
            formError={formError}
            submitting={submitting}
            onSubmit={handleSubmit}
            onEmailChange={handleEmailChange}
            onPasswordChange={handlePasswordChange}
            onSignupClick={() => navigate('/signup')}
          />
        </div>
      </main>
    </Header>
  );
}
