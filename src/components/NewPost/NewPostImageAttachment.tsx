// 게시글 작성 이미지 첨부(파일 선택·총 N장 표시).
import type { ChangeEvent, RefObject } from 'react';

interface NewPostImageAttachmentProps {
  fileInputRef: RefObject<HTMLInputElement | null>;
  totalCount: number;
  maxImages: number;
  onFileChange: (e: ChangeEvent<HTMLInputElement>) => void;
}

export function NewPostImageAttachment({
  fileInputRef,
  totalCount,
  maxImages,
  onFileChange,
}: NewPostImageAttachmentProps) {
  return (
    <div className="flex flex-col gap-1 mb-3 last:mb-5">
      <span className="mb-0 font-['Pretendard'] text-[12px] font-extrabold leading-[12px] text-[#111827]">
        이미지 (최대 {maxImages}장)
      </span>
      <div className="flex items-center gap-2">
        <input
          ref={fileInputRef}
          type="file"
          id="post-file-input"
          accept="image/jpeg,image/png"
          multiple
          className="hidden"
          aria-hidden="true"
          onChange={onFileChange}
        />
        <button
          type="button"
          className="inline-flex h-[34px] w-[88px] items-center justify-center rounded-[12px] border border-[rgba(168,85,247,0.18)] bg-white font-['Pretendard',sans-serif] text-[12px] font-extrabold text-[rgba(91,33,182,1)] cursor-pointer transition-shadow hover:shadow-[0_0_0_4px_rgba(168,85,247,0.10)] disabled:opacity-50"
          id="post-file-trigger"
          onClick={() => fileInputRef.current?.click()}
          disabled={totalCount >= maxImages}
        >
          파일 선택
        </button>
        <span className="font-['Pretendard',sans-serif] text-[12px] text-black" id="file-input-text">
          {totalCount > 0 ? `총 ${totalCount}장` : '파일을 선택해주세요.'}
        </span>
      </div>
    </div>
  );
}
