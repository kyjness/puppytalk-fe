// 게시글 이미지 미리보기 1건(기존/신규), 제거 시 onRemove 호출.
import { memo, type MouseEvent as ReactMouseEvent } from 'react';
import { safeImageUrl } from '../utils/index.js';

type ImagePreviewType = 'existing' | 'new';

interface ImagePreviewItemProps {
  type: ImagePreviewType;
  item: { imageId?: string | number | null; fileUrl?: string; objectUrl?: string };
  index: number;
  onRemove: (type: ImagePreviewType, index: number) => void;
}

function ImagePreviewItem({ type, item, index, onRemove }: ImagePreviewItemProps) {
  const src = type === 'existing' ? safeImageUrl(item.fileUrl, '') || '' : item.objectUrl;
  const dataImageId = type === 'existing' && item.imageId != null ? item.imageId : undefined;

  const handleRemove = (e: ReactMouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    onRemove(type, index);
  };

  return (
    <div
      className="relative h-[88px] w-[88px] shrink-0 overflow-hidden rounded-[8px] bg-[#eee]"
      data-type={type}
      data-index={index}
      {...(dataImageId != null && { 'data-image-id': dataImageId })}
    >
      <img
        src={src}
        alt={type === 'existing' ? '이미지' : '새 이미지'}
        className="block h-full w-full object-cover"
      />
      <button
        type="button"
        className="absolute right-1 top-1 flex h-6 w-6 items-center justify-center rounded-full border-0 bg-[rgba(0,0,0,0.6)] p-0 text-[18px] leading-none text-white cursor-pointer transition-[background] duration-150 hover:bg-[rgba(0,0,0,0.85)]"
        aria-label="제거"
        onClick={handleRemove}
      >
        ×
      </button>
    </div>
  );
}

export default memo(ImagePreviewItem);
