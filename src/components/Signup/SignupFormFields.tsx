// 회원가입 폼: 이메일·비밀번호·비밀번호 확인·닉네임 4필드.
import type { ChangeEvent } from 'react';
import { PASSWORD_POLICY_TEXT } from '../../utils/index.js';

type SignupFieldKey = 'email' | 'password' | 'passwordConfirm' | 'nickname';

interface SignupFormFieldsProps {
  formData: Record<SignupFieldKey, string>;
  errors: Record<SignupFieldKey, string>;
  onFieldChange: (field: SignupFieldKey) => (e: ChangeEvent<HTMLInputElement>) => void;
}

export function SignupFormFields({ formData, errors, onFieldChange }: SignupFormFieldsProps) {
  return (
    <>
      <div className="flex flex-col gap-1">
        <label
          htmlFor="email"
          className="mb-0 font-['Pretendard'] text-[12px] font-bold leading-[12px] text-black"
        >
          이메일*
        </label>
        <input
          type="email"
          id="email"
          name="email"
          className="w-full h-[33px] border border-black rounded-[4px] bg-[#F4F5F7] py-[12px] pl-2 pr-[14px] font-['Pretendard',sans-serif] text-[14px] font-normal leading-[14px] text-black outline-none focus:border-black placeholder:font-['Pretendard',sans-serif] placeholder:text-[13px] placeholder:font-normal placeholder:leading-[13px] placeholder:text-black placeholder:opacity-100 placeholder:transition-opacity placeholder:duration-200 focus:placeholder:opacity-0"
          placeholder="이메일을 입력하세요"
          value={formData.email}
          onChange={onFieldChange('email')}
          aria-invalid={!!errors.email}
          aria-describedby={errors.email ? 'email-error' : undefined}
        />
        {errors.email && (
          <span
            className="mt-[2px] block min-h-[14px] font-['Pretendard',sans-serif] text-[12px] font-normal leading-[12px] text-[#FF0000]"
            id="email-error"
            role="alert"
          >
            * {errors.email}
          </span>
        )}
      </div>
      <div className="flex flex-col gap-1">
        <label
          htmlFor="password"
          className="mb-0 font-['Pretendard'] text-[12px] font-bold leading-[12px] text-black"
        >
          비밀번호*
        </label>
        <input
          type="password"
          id="password"
          name="password"
          className="w-full h-[33px] border border-black rounded-[4px] bg-[#F4F5F7] py-[12px] pl-2 pr-[14px] font-['Pretendard',sans-serif] text-[14px] font-normal leading-[14px] text-black outline-none focus:border-black placeholder:font-['Pretendard',sans-serif] placeholder:text-[13px] placeholder:font-normal placeholder:leading-[13px] placeholder:text-black placeholder:opacity-100 placeholder:transition-opacity placeholder:duration-200 focus:placeholder:opacity-0"
          placeholder={PASSWORD_POLICY_TEXT}
          value={formData.password}
          onChange={onFieldChange('password')}
          aria-invalid={!!errors.password}
          aria-describedby={errors.password ? 'password-error' : undefined}
        />
        {errors.password && (
          <span
            className="mt-[2px] block min-h-[14px] font-['Pretendard',sans-serif] text-[12px] font-normal leading-[12px] text-[#FF0000]"
            id="password-error"
            role="alert"
          >
            * {errors.password}
          </span>
        )}
      </div>
      <div className="flex flex-col gap-1">
        <label
          htmlFor="password-confirm"
          className="mb-0 font-['Pretendard'] text-[12px] font-bold leading-[12px] text-black"
        >
          비밀번호 확인*
        </label>
        <input
          type="password"
          id="password-confirm"
          name="password-confirm"
          className="w-full h-[33px] border border-black rounded-[4px] bg-[#F4F5F7] py-[12px] pl-2 pr-[14px] font-['Pretendard',sans-serif] text-[14px] font-normal leading-[14px] text-black outline-none focus:border-black placeholder:font-['Pretendard',sans-serif] placeholder:text-[13px] placeholder:font-normal placeholder:leading-[13px] placeholder:text-black placeholder:opacity-100 placeholder:transition-opacity placeholder:duration-200 focus:placeholder:opacity-0"
          placeholder="비밀번호를 다시 입력하세요"
          value={formData.passwordConfirm}
          onChange={onFieldChange('passwordConfirm')}
          aria-invalid={!!errors.passwordConfirm}
          aria-describedby={errors.passwordConfirm ? 'password-confirm-error' : undefined}
        />
        {errors.passwordConfirm && (
          <span
            className="mt-[2px] block min-h-[14px] font-['Pretendard',sans-serif] text-[12px] font-normal leading-[12px] text-[#FF0000]"
            id="password-confirm-error"
            role="alert"
          >
            * {errors.passwordConfirm}
          </span>
        )}
      </div>
      <div className="flex flex-col gap-1">
        <label
          htmlFor="nickname"
          className="mb-0 font-['Pretendard'] text-[12px] font-bold leading-[12px] text-black"
        >
          닉네임*
        </label>
        <input
          type="text"
          id="nickname"
          name="nickname"
          className="w-full h-[33px] border border-black rounded-[4px] bg-[#F4F5F7] py-[12px] pl-2 pr-[14px] font-['Pretendard',sans-serif] text-[14px] font-normal leading-[14px] text-black outline-none focus:border-black placeholder:font-['Pretendard',sans-serif] placeholder:text-[13px] placeholder:font-normal placeholder:leading-[13px] placeholder:text-black placeholder:opacity-100 placeholder:transition-opacity placeholder:duration-200 focus:placeholder:opacity-0"
          placeholder="닉네임을 입력하세요"
          value={formData.nickname}
          onChange={onFieldChange('nickname')}
          aria-invalid={!!errors.nickname}
          aria-describedby={errors.nickname ? 'nickname-error' : undefined}
        />
        {errors.nickname && (
          <span
            className="mt-[2px] block min-h-[14px] font-['Pretendard',sans-serif] text-[12px] font-normal leading-[12px] text-[#FF0000]"
            id="nickname-error"
            role="alert"
          >
            * {errors.nickname}
          </span>
        )}
      </div>
    </>
  );
}
