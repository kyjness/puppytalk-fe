// 회원정보 수정 프로필 사진 섹션(아바타·변경·기본값).
import type { ChangeEvent, MouseEvent as ReactMouseEvent, RefObject } from 'react';

interface ProfileImageSectionProps {
  profileImageDisplay: string;
  canClearProfileImage: boolean;
  fileInputRef: RefObject<HTMLInputElement | null>;
  onProfileChange: (e: ChangeEvent<HTMLInputElement>) => void;
  onClearProfile: () => void;
  onAvatarClick: () => void;
  onAvatarChangeClick: (e?: ReactMouseEvent) => void;
}

export function ProfileImageSection({
  profileImageDisplay,
  canClearProfileImage,
  fileInputRef,
  onProfileChange,
  onClearProfile,
  onAvatarClick,
  onAvatarChangeClick,
}: ProfileImageSectionProps) {
  return (
    <div className="mb-3 flex w-full flex-col gap-1">
      <label className="mb-0 w-full text-left font-['Pretendard'] text-[12px] font-bold leading-[12px] text-black">
        프로필 사진
      </label>
      <div className="mb-0 flex w-full flex-col items-center gap-2.5">
        <div
          className="relative flex aspect-square w-[149px] cursor-pointer items-center justify-center overflow-hidden rounded-full bg-gray-800/55 shadow-md"
          id="avatar-area"
          onClick={onAvatarClick}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              onAvatarClick();
            }
          }}
        >
          <div className="absolute inset-0 h-full w-full">
            <img id="avatar-img" src={profileImageDisplay} alt="프로필 이미지" className="h-full w-full rounded-full object-cover" />
          </div>
          <div className="pointer-events-none absolute inset-0 rounded-full bg-black/35" aria-hidden />
          <button
            type="button"
            className="absolute left-1/2 top-1/2 z-10 flex h-[27px] w-[52px] -translate-x-1/2 -translate-y-1/2 cursor-pointer items-center justify-center rounded-[25px] border border-white bg-black/35 text-[13px] font-semibold text-white"
            id="avatar-change-btn"
            onClick={onAvatarChangeClick}
          >
            변경
          </button>
        </div>
        <div className="flex items-center gap-2">
          {canClearProfileImage && (
            <button
              type="button"
              className="cursor-pointer border-none bg-transparent p-0 text-[13px] text-gray-600 underline transition-colors hover:text-gray-800"
              onClick={(e) => {
                e.preventDefault();
                onClearProfile();
              }}
            >
              [기본값]
            </button>
          )}
        </div>
        <input
          ref={fileInputRef}
          type="file"
          id="profile-image"
          accept="image/jpeg,image/png"
          style={{ display: 'none' }}
          onChange={onProfileChange}
        />
      </div>
    </div>
  );
}
