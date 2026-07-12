// 비밀번호 수정: useChangePassword + ChangePasswordFormFields (마이페이지 탭용).
import { useChangePassword } from '../../hooks/useChangePassword.js';
import { ChangePasswordFormFields } from '../ChangePassword';

export function PasswordEdit() {
  const { formData, errors, submitting, handleFieldChange, handleSubmit } = useChangePassword();

  return (
    <div className="flex w-full max-w-[600px] flex-col items-center pb-2 text-center">
      <h2 className="mb-4 text-center font-['Pretendard'] text-[18px] font-bold leading-[18px] text-black">
        비밀번호 수정
      </h2>
      <form
        id="form"
        className="flex w-full max-w-[370px] flex-col gap-4 text-left"
        noValidate
        onSubmit={handleSubmit}
      >
        <ChangePasswordFormFields
          formData={formData}
          errors={errors}
          onFieldChange={handleFieldChange}
        />
        {errors.form && (
          <span
            className="mt-[2px] block min-h-[14px] font-['Pretendard',sans-serif] text-[12px] font-normal leading-[12px] text-[#FF0000]"
            id="change-password-form-error"
            role="alert"
          >
            * {errors.form}
          </span>
        )}
        <div className="mt-4 flex w-full flex-wrap justify-center gap-2">
          <button
            type="submit"
            className="inline-flex h-[33px] w-full self-center items-center justify-center rounded-[4px] border-0 bg-[var(--primary)] px-5 text-[13px] font-bold leading-[13px] text-white no-underline transition-all duration-200 hover:bg-[var(--primary-hover)] active:bg-[var(--primary-hover)] disabled:opacity-50"
            disabled={submitting}
          >
            수정하기
          </button>
        </div>
      </form>
    </div>
  );
}
