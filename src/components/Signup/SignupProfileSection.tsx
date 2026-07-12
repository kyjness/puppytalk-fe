// 회원가입 프로필 사진 업로드 블록.
import type { ChangeEvent, RefObject } from 'react';

interface SignupProfileSectionProps {
  profilePreviewUrl: string | null;
  profileError: string;
  fileInputRef: RefObject<HTMLInputElement | null>;
  onAvatarClick: () => void;
  onFileChange: (e: ChangeEvent<HTMLInputElement>) => void;
}

export function SignupProfileSection({
  profilePreviewUrl,
  profileError,
  fileInputRef,
  onAvatarClick,
  onFileChange,
}: SignupProfileSectionProps) {
  return (
    <div className="flex flex-col gap-[2px]">
      <label className="mb-0 font-['Pretendard'] text-[12px] font-bold leading-[12px] text-black">
        프로필 사진
      </label>
      {profileError && (
        <span
          className="mt-[2px] block min-h-[14px] font-['Pretendard',sans-serif] text-[12px] font-normal leading-[12px] text-[#FF0000]"
          id="profile-error"
          role="alert"
        >
          * {profileError}
        </span>
      )}
      <div className="mx-auto flex h-[130px] w-[130px] min-h-[130px] min-w-[130px] shrink-0 items-center justify-center">
        <button
          type="button"
          className="relative h-[130px] w-[130px] min-h-[130px] min-w-[130px] max-h-[130px] max-w-[130px] overflow-hidden rounded-full border-0 bg-[#C4C4C4] p-0 cursor-pointer"
          id="signup-avatar-preview"
          onClick={onAvatarClick}
          aria-label="프로필 사진 선택"
        >
          {profilePreviewUrl ? (
            <img
              id="avatar-img"
              src={profilePreviewUrl}
              alt=""
              className="block h-full w-full aspect-square rounded-full object-cover object-center"
            />
          ) : (
            <div
              id="plus-icon"
              className="absolute left-1/2 top-1/2 h-4 w-4 -translate-x-1/2 -translate-y-1/2"
              aria-hidden="true"
            >
              <span className="absolute left-0 top-1/2 h-px w-4 -translate-y-1/2 bg-black" />
              <span className="absolute left-1/2 top-0 h-4 w-px -translate-x-1/2 bg-black" />
            </div>
          )}
        </button>
        <input
          ref={fileInputRef}
          type="file"
          id="profile-image"
          accept="image/jpeg,image/png"
          style={{ display: 'none' }}
          onChange={onFileChange}
        />
      </div>
    </div>
  );
}
