// 회원정보 수정 이메일·닉네임 입력. (계정 상태는 백엔드 관리용, 화면에는 노출하지 않음)
const INPUT_CLASS =
  "w-full h-[33px] border border-black rounded-[4px] bg-[#F4F5F7] py-[12px] pl-2 pr-[14px] font-['Pretendard',sans-serif] text-[13px] font-normal leading-[13px] text-black outline-none focus:border-black placeholder:font-['Pretendard',sans-serif] placeholder:text-[13px] placeholder:font-normal placeholder:leading-[13px] placeholder:text-black placeholder:opacity-100 placeholder:transition-opacity placeholder:duration-200 focus:placeholder:opacity-0";

interface NicknameSectionProps {
  email?: string;
  nickname: string;
  nicknameError: string;
  onNicknameChange: (value: string) => void;
}

export function NicknameSection({
  email,
  nickname,
  nicknameError,
  onNicknameChange,
}: NicknameSectionProps) {
  return (
    <>
      <div className="mb-2 flex w-full flex-col gap-1">
        <label className="mb-0 w-full text-left font-['Pretendard'] text-[12px] font-bold leading-[12px] text-black">
          이메일
        </label>
        <p className="py-1 text-sm text-black">{email ?? '\u00A0'}</p>
      </div>
      <div className="mb-[10px] flex w-full flex-col gap-1">
        <label
          htmlFor="nickname"
          className="mb-0 w-full text-left font-['Pretendard'] text-[12px] font-bold leading-[12px] text-black"
        >
          닉네임
        </label>
        <input
          type="text"
          id="nickname"
          name="nickname"
          className={INPUT_CLASS}
          value={nickname}
          onChange={(e) => {
            onNicknameChange(e.target.value);
          }}
          aria-invalid={!!nicknameError}
          aria-describedby={nicknameError ? 'edit-profile-nickname-error' : undefined}
        />
        {nicknameError && (
          <span
            className="mt-[2px] block min-h-[14px] font-['Pretendard',sans-serif] text-[12px] font-normal leading-[12px] text-[#FF0000]"
            id="edit-profile-nickname-error"
            role="alert"
          >
            * {nicknameError}
          </span>
        )}
      </div>
    </>
  );
}
