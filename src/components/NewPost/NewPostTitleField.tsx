// 게시글 작성 제목 필드.
import type { ChangeEvent } from 'react';

interface NewPostTitleFieldProps {
  title: string;
  titleError: string;
  onChange: (e: ChangeEvent<HTMLInputElement>) => void;
}

export function NewPostTitleField({ title, titleError, onChange }: NewPostTitleFieldProps) {
  return (
    <div className="flex flex-col gap-1 mb-3 last:mb-5">
      <label
        htmlFor="title"
        className="mb-0 font-['Pretendard'] text-[12px] font-extrabold leading-[12px] text-[#111827]"
      >
        제목*
      </label>
      <input
        type="text"
        id="title"
        name="title"
        className="w-full h-[38px] rounded-[12px] border border-[rgba(168,85,247,0.18)] bg-white px-3 font-['Pretendard',sans-serif] text-[14px] font-medium leading-[14px] text-[#111827] outline-none transition-shadow focus:border-[rgba(168,85,247,0.35)] focus:shadow-[0_0_0_4px_rgba(168,85,247,0.12)] placeholder:text-[13px] placeholder:font-medium placeholder:text-[rgba(17,24,39,0.55)]"
        placeholder="제목을 입력하세요. (최대 26글자)"
        maxLength={26}
        value={title}
        onChange={onChange}
        aria-invalid={!!titleError}
        aria-describedby={titleError ? 'title-error' : undefined}
      />
      {titleError && (
        <span
          className="mt-[2px] block min-h-[14px] font-['Pretendard',sans-serif] text-[12px] font-normal leading-[12px] text-[#FF0000]"
          id="title-error"
          role="alert"
        >
          * {titleError}
        </span>
      )}
    </div>
  );
}
