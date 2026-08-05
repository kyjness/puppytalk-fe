// 로그인 페이지: useLogin 훅 + LoginForm 조합.
import { Navigate } from 'react-router-dom';
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
    handleDemoLogin,
    handleEmailChange,
    handlePasswordChange,
  } = useLogin();

  // 렌더 중 navigate()를 호출하면 라우터 상태를 다른 컴포넌트 렌더 도중에 바꾸는 셈이라
  // React가 경고를 냈다(동시성 렌더에서는 폐기된 렌더의 이동까지 남을 수 있다).
  // 선언형 <Navigate>는 커밋 이후에 이동한다.
  if (isLoggedIn) {
    return <Navigate to={from} replace />;
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
            onDemoLogin={handleDemoLogin}
            onEmailChange={handleEmailChange}
            onPasswordChange={handlePasswordChange}
            onSignupClick={() => navigate('/signup')}
          />
        </div>
      </main>
    </Header>
  );
}
