// 로그인 폼: 이메일·비밀번호 필드, formError, 로그인/회원가입 버튼.
import type { ChangeEvent, FormEvent } from 'react';

interface LoginFormProps {
  email: string;
  password: string;
  emailError: string;
  passwordError: string;
  formError: string;
  submitting: boolean;
  onSubmit: (e: FormEvent) => void;
  onEmailChange: (e: ChangeEvent<HTMLInputElement>) => void;
  onPasswordChange: (e: ChangeEvent<HTMLInputElement>) => void;
  onSignupClick: () => void;
}

export function LoginForm({
  email,
  password,
  emailError,
  passwordError,
  formError,
  submitting,
  onSubmit,
  onEmailChange,
  onPasswordChange,
  onSignupClick,
}: LoginFormProps) {
  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-4" noValidate>
      <div className="flex flex-col gap-1">
        <label
          htmlFor="login-email"
          className="mb-0 font-['Pretendard'] text-[12px] font-bold leading-[12px] text-black"
        >
          이메일
        </label>
        <input
          type="email"
          id="login-email"
          value={email}
          onChange={onEmailChange}
          className="w-full h-[33px] border border-black rounded-[4px] bg-[#F4F5F7] py-[12px] pl-2 pr-[14px] font-['Pretendard',sans-serif] text-[14px] font-normal leading-[14px] text-black outline-none focus:border-black placeholder:font-['Pretendard',sans-serif] placeholder:text-[13px] placeholder:font-normal placeholder:leading-[13px] placeholder:text-black placeholder:opacity-100 placeholder:transition-opacity placeholder:duration-200 focus:placeholder:opacity-0"
          placeholder="이메일을 입력하세요"
          required
          autoComplete="email"
          aria-invalid={!!emailError}
          aria-describedby={emailError ? 'login-email-error' : undefined}
        />
        {emailError && (
          <span
            className="mt-[2px] block min-h-[14px] font-['Pretendard',sans-serif] text-[12px] font-normal leading-[12px] text-[#FF0000]"
            id="login-email-error"
            role="alert"
          >
            * {emailError}
          </span>
        )}
      </div>
      <div className="flex flex-col gap-1">
        <label
          htmlFor="login-password"
          className="mb-0 font-['Pretendard'] text-[12px] font-bold leading-[12px] text-black"
        >
          비밀번호
        </label>
        <input
          type="password"
          id="login-password"
          value={password}
          onChange={onPasswordChange}
          className="w-full h-[33px] border border-black rounded-[4px] bg-[#F4F5F7] py-[12px] pl-2 pr-[14px] font-['Pretendard',sans-serif] text-[14px] font-normal leading-[14px] text-black outline-none focus:border-black placeholder:font-['Pretendard',sans-serif] placeholder:text-[13px] placeholder:font-normal placeholder:leading-[13px] placeholder:text-black placeholder:opacity-100 placeholder:transition-opacity placeholder:duration-200 focus:placeholder:opacity-0"
          placeholder="비밀번호를 입력하세요"
          required
          autoComplete="current-password"
          aria-invalid={!!passwordError || !!formError}
          aria-describedby={
            passwordError ? 'login-password-error' : formError ? 'login-form-error' : undefined
          }
        />
        {passwordError && (
          <span
            className="mt-[2px] block min-h-[14px] font-['Pretendard',sans-serif] text-[12px] font-normal leading-[12px] text-[#FF0000]"
            id="login-password-error"
            role="alert"
          >
            * {passwordError}
          </span>
        )}
      </div>
      {formError && (
        <span
          className="mt-[2px] block min-h-[14px] font-['Pretendard',sans-serif] text-[12px] font-normal leading-[12px] text-[#FF0000]"
          id="login-form-error"
          role="alert"
        >
          * {formError}
        </span>
      )}
      <button
        type="submit"
        className="inline-flex h-[33px] w-full max-w-[360px] self-center items-center justify-center rounded-[4px] border-0 bg-[var(--primary)] px-5 text-[13px] font-bold leading-[13px] text-white no-underline transition-all duration-200 hover:bg-[var(--primary-hover)] active:bg-[var(--primary-hover)] disabled:opacity-50 cursor-pointer"
        disabled={submitting}
      >
        로그인
      </button>
      <button
        type="button"
        className="inline-flex h-[40px] w-fit self-center items-center justify-center rounded-full border-0 bg-transparent px-5 text-[12px] font-normal leading-[12px] text-black no-underline transition-all duration-200 hover:text-[#333333] active:text-[#111111] cursor-pointer"
        onClick={onSignupClick}
      >
        회원가입
      </button>
    </form>
  );
}
