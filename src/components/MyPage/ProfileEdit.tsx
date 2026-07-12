// 회원정보 수정(프로필 전용): 프로필 사진·이메일·닉네임만. 강아지는 반려견 관리 탭에서.
import { useEditProfile } from '../../hooks/useEditProfile.js';
import {
  ProfileImageSection,
  NicknameSection,
  DeleteAccountModal,
} from '../EditProfile';

export function ProfileEdit() {
  const {
    user,
    fileInputRef,
    nickname,
    setNickname,
    nicknameError,
    setNicknameError,
    profileImageDisplay,
    canClearProfileImage,
    formError,
    submitting,
    deleteModalOpen,
    setDeleteModalOpen,
    handleProfileChange,
    handleClearProfileImage,
    handleAvatarChangeClick,
    handleSubmit,
    handleEditComplete,
    handleDeleteAccount,
  } = useEditProfile();

  return (
    <div className="flex w-full max-w-[600px] flex-col items-center pb-2 text-center">
      <h2 className="mb-4 text-center font-['Pretendard'] text-[18px] font-bold leading-[18px] text-black">
        내 프로필
      </h2>
      <form
        id="form"
        className="flex w-full max-w-[360px] flex-col items-center text-left"
        noValidate
        onSubmit={handleSubmit}
      >
        <ProfileImageSection
          profileImageDisplay={profileImageDisplay}
          canClearProfileImage={canClearProfileImage}
          fileInputRef={fileInputRef}
          onProfileChange={handleProfileChange}
          onClearProfile={handleClearProfileImage}
          onAvatarClick={() => fileInputRef.current?.click()}
          onAvatarChangeClick={handleAvatarChangeClick}
        />
        <NicknameSection
          email={user?.email}
          nickname={nickname}
          nicknameError={nicknameError}
          onNicknameChange={(v) => {
            setNickname(v);
            if (nicknameError) setNicknameError('');
          }}
        />

        {formError && (
          <span
            className="mt-[2px] block min-h-[14px] w-full font-['Pretendard',sans-serif] text-[12px] font-normal leading-[12px] text-[#FF0000]"
            id="edit-profile-form-error"
            role="alert"
          >
            * {formError}
          </span>
        )}
        <div className="mt-4 flex w-full flex-col items-center gap-2">
          <button
            type="submit"
            className="inline-flex h-[33px] w-full max-w-[360px] self-center items-center justify-center rounded-[4px] border-0 bg-[var(--primary)] px-5 text-[13px] font-bold leading-[13px] text-white no-underline transition-all duration-200 hover:bg-[var(--primary-hover)] active:bg-[var(--primary-hover)] disabled:opacity-50"
            disabled={submitting}
          >
            수정하기
          </button>
          <button
            type="button"
            id="delete-account-btn"
            className="inline-flex h-[42px] min-w-0 w-auto items-center justify-center self-center rounded-full border-0 bg-transparent px-4 text-[12px] font-normal leading-[12px] text-black no-underline transition-all duration-200 hover:text-[#333333] active:text-[#111111] cursor-pointer"
            onClick={() => setDeleteModalOpen(true)}
          >
            회원 탈퇴
          </button>
        </div>
      </form>
      <button
        type="button"
        id="edit-complete-btn"
        className="mx-auto mb-3 mt-2 block cursor-pointer rounded-[18px] border-0 bg-[var(--primary)] px-[16px] py-[9px] text-center text-[12px] font-bold leading-[12px] text-white transition-colors duration-200 hover:bg-[var(--primary-hover)]"
        onClick={handleEditComplete}
      >
        수정완료
      </button>

      <DeleteAccountModal
        open={deleteModalOpen}
        onClose={() => setDeleteModalOpen(false)}
        onConfirm={handleDeleteAccount}
      />
    </div>
  );
}
