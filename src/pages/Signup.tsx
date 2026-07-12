// 회원가입 페이지: useSignup 훅 + Signup 하위 컴포넌트 조합.
import { Header } from '../components/Header.jsx';
import { useSignup } from '../hooks/useSignup.js';
import { SignupProfileSection, SignupFormFields } from '../components/Signup';

export function Signup() {
  const {
    formData,
    errors,
    profilePreviewUrl,
    submitting,
    fileInputRef,
    handleAvatarClick,
    handleFileChange,
    handleFieldChange,
    handleSubmit,
    navigate,
  } = useSignup();

  return (
    <Header showProfile={false} showBackButton backHref="/login">
      <main className="flex flex-1 items-center justify-center bg-[var(--app-bg)] px-[16px] pt-[8px]">
        <div className="w-full max-w-[min(369px,92vw)] p-0 m-0 rounded-none bg-transparent shadow-none">
          <h2 className="mb-6 text-center font-['Pretendard'] text-[25px] font-bold leading-[25px] text-black">
            회원가입
          </h2>
          <form id="signup-form" className="flex flex-col gap-4" noValidate onSubmit={handleSubmit}>
            <SignupProfileSection
              profilePreviewUrl={profilePreviewUrl}
              profileError={errors.profile}
              fileInputRef={fileInputRef}
              onAvatarClick={handleAvatarClick}
              onFileChange={handleFileChange}
            />
            <SignupFormFields
              formData={formData}
              errors={errors}
              onFieldChange={handleFieldChange}
            />
            {errors.form && (
              <span
                className="mt-[2px] block min-h-[14px] font-['Pretendard',sans-serif] text-[12px] font-normal leading-[12px] text-[#FF0000]"
                id="form-error-common"
                role="alert"
              >
                * {errors.form}
              </span>
            )}
            <button
              type="submit"
              className="inline-flex h-[33px] w-full max-w-[360px] self-center items-center justify-center rounded-[4px] border-0 bg-[var(--primary)] px-5 text-[13px] font-bold leading-[13px] text-white no-underline transition-all duration-200 hover:bg-[var(--primary-hover)] active:bg-[var(--primary-hover)] disabled:opacity-50 cursor-pointer"
              id="signup-submit"
              disabled={submitting}
            >
              회원가입
            </button>
            <button
              type="button"
              id="login-link"
              className="inline-flex h-[40px] w-fit self-center items-center justify-center rounded-full border-0 bg-transparent px-5 text-[12px] font-normal leading-[12px] text-black no-underline transition-all duration-200 hover:text-[#333333] active:text-[#111111] cursor-pointer"
              onClick={() => navigate('/login')}
            >
              로그인하러 가기
            </button>
          </form>
        </div>
      </main>
    </Header>
  );
}
