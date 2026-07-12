// 게시글 작성 내용·이미지 미리보기·contentError.
import ImagePreviewItem from '../ImagePreviewItem.jsx';
import { useEffect, type ChangeEvent, type RefObject } from 'react';
import type { NewImageItem } from '../../api/api-types.js';

interface NewPostContentBlockProps {
  content: string;
  contentRef: RefObject<HTMLTextAreaElement | null>;
  contentError: string;
  onChange: (e: ChangeEvent<HTMLTextAreaElement>) => void;
  newImages: NewImageItem[];
  totalCount: number;
  onRemovePreview: (type: 'existing' | 'new', index: number) => void;
}

export function NewPostContentBlock({
  content,
  contentRef,
  contentError,
  onChange,
  newImages,
  totalCount,
  onRemovePreview,
}: NewPostContentBlockProps) {
  useEffect(() => {
    const el = contentRef?.current;
    if (!el) return;
    el.style.setProperty('overflow', 'hidden');
    el.style.setProperty('height', '1px');
    const h = Math.max(260, el.scrollHeight);
    el.style.setProperty('height', `${h}px`, 'important');
    el.style.removeProperty('overflow');
  }, [content, contentRef]);

  return (
    <div className="flex flex-col gap-1 mb-3 last:mb-5">
      <label
        htmlFor="content"
        className="mb-0 font-['Pretendard'] text-[12px] font-extrabold leading-[12px] text-[#111827]"
      >
        내용*
      </label>
      <textarea
        ref={contentRef}
        id="content"
        name="content"
        className="w-full min-h-[260px] resize-none overflow-hidden rounded-[16px] border border-[rgba(168,85,247,0.16)] bg-white px-3 py-3 font-['Pretendard',sans-serif] text-[14px] font-medium leading-[1.55] text-[#111827] outline-none transition-shadow focus:border-[rgba(168,85,247,0.35)] focus:shadow-[0_0_0_4px_rgba(168,85,247,0.10)]"
        placeholder="내용을 입력하세요."
        value={content}
        onChange={onChange}
        aria-invalid={!!contentError}
        aria-describedby={contentError ? 'content-error' : undefined}
      />
      <div
        id="post-image-preview"
        className={[
          totalCount > 0 ? 'flex' : 'hidden',
          'flex-wrap gap-[10px] mt-3 py-2',
        ].join(' ')}
        aria-label="첨부 이미지 미리보기"
      >
        {newImages.map((item, i) => (
          <ImagePreviewItem
            key={`new-${i}`}
            type="new"
            item={item}
            index={i}
            onRemove={onRemovePreview}
          />
        ))}
      </div>
      {contentError && (
        <span
          className="mt-[2px] block min-h-[14px] font-['Pretendard',sans-serif] text-[12px] font-normal leading-[12px] text-[#FF0000]"
          id="content-error"
          role="alert"
        >
          * {contentError}
        </span>
      )}
    </div>
  );
}
