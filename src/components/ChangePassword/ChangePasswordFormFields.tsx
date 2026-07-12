// 비밀번호 변경 폼: 현재/새/새 확인 3필드.
import type { ChangeEvent } from 'react';
import { PASSWORD_POLICY_TEXT_CHANGE } from '../../utils/index.js';

type ChangePasswordFieldKey = 'currentPassword' | 'newPassword' | 'newPasswordConfirm';

interface ChangePasswordFormFieldsProps {
  formData: Record<ChangePasswordFieldKey, string>;
  errors: Record<ChangePasswordFieldKey, string>;
  onFieldChange: (field: ChangePasswordFieldKey) => (e: ChangeEvent<HTMLInputElement>) => void;
}

const NEW_PW_MAX = 128;

const INPUT_CLASS =
  "w-full h-[33px] border border-black rounded-[4px] bg-[#F4F5F7] py-[12px] pl-2 pr-[14px] font-['Pretendard',sans-serif] text-[13px] font-normal leading-[13px] text-black outline-none focus:border-black placeholder:font-['Pretendard',sans-serif] placeholder:text-[13px] placeholder:font-normal placeholder:leading-[13px] placeholder:text-black placeholder:opacity-100 placeholder:transition-opacity placeholder:duration-200 focus:placeholder:opacity-0";

const LABEL_CLASS = "mb-0 font-['Pretendard'] text-[12px] font-bold leading-[12px] text-black";

export function ChangePasswordFormFields({
  formData,
  errors,
  onFieldChange,
}: ChangePasswordFormFieldsProps) {
  return (
    <>
      <div className="flex flex-col gap-1">
        <label htmlFor="current-password" className={LABEL_CLASS}>
          현재 비밀번호
        </label>
        <input
          type="password"
          id="current-password"
          name="current-password"
          className={INPUT_CLASS}
          placeholder="현재 비밀번호를 입력하세요"
          maxLength={NEW_PW_MAX}
          value={formData.currentPassword}
          onChange={onFieldChange('currentPassword')}
          aria-invalid={!!errors.currentPassword}
          aria-describedby={errors.currentPassword ? 'current-password-error' : undefined}
        />
        {errors.currentPassword && (
          <span
            className="mt-[2px] block min-h-[14px] font-['Pretendard',sans-serif] text-[12px] font-normal leading-[12px] text-[#FF0000]"
            id="current-password-error"
            role="alert"
          >
            * {errors.currentPassword}
          </span>
        )}
      </div>
      <div className="flex flex-col gap-1">
        <label htmlFor="new-password" className={LABEL_CLASS}>
          새 비밀번호
        </label>
        <input
          type="password"
          id="new-password"
          name="new-password"
          className={INPUT_CLASS}
          placeholder={PASSWORD_POLICY_TEXT_CHANGE}
          maxLength={NEW_PW_MAX}
          value={formData.newPassword}
          onChange={onFieldChange('newPassword')}
          aria-invalid={!!errors.newPassword}
          aria-describedby={errors.newPassword ? 'new-password-error' : undefined}
        />
        {errors.newPassword && (
          <span
            className="mt-[2px] block min-h-[14px] font-['Pretendard',sans-serif] text-[12px] font-normal leading-[12px] text-[#FF0000]"
            id="new-password-error"
            role="alert"
          >
            * {errors.newPassword}
          </span>
        )}
      </div>
      <div className="flex flex-col gap-1">
        <label htmlFor="new-password-confirm" className={LABEL_CLASS}>
          새 비밀번호 확인
        </label>
        <input
          type="password"
          id="new-password-confirm"
          name="new-password-confirm"
          className={INPUT_CLASS}
          placeholder="새 비밀번호를 한번 더 입력하세요"
          maxLength={NEW_PW_MAX}
          value={formData.newPasswordConfirm}
          onChange={onFieldChange('newPasswordConfirm')}
          aria-invalid={!!errors.newPasswordConfirm}
          aria-describedby={
            errors.newPasswordConfirm ? 'new-password-confirm-error' : undefined
          }
        />
        {errors.newPasswordConfirm && (
          <span
            className="mt-[2px] block min-h-[14px] font-['Pretendard',sans-serif] text-[12px] font-normal leading-[12px] text-[#FF0000]"
            id="new-password-confirm-error"
            role="alert"
          >
            * {errors.newPasswordConfirm}
          </span>
        )}
      </div>
    </>
  );
}
