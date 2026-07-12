// 게시글 작성 페이지: useNewPost 훅 + NewPost 하위 컴포넌트 조합.
import { Header } from '../components/Header.jsx';
import { useNewPost } from '../hooks/useNewPost.js';
import {
  NewPostTitleField,
  NewPostContentBlock,
  NewPostImageAttachment,
} from '../components/NewPost';
import { POST_CATEGORY_OPTIONS } from '../utils/postMeta.js';

export function NewPost() {
  const {
    title,
    content,
    titleError,
    contentError,
    formError,
    submitting,
    fileInputRef,
    contentRef,
    newImages,
    totalCount,
    MAX_IMAGES,
    handleFileChange,
    handleRemovePreview,
    handleSubmit,
    handleTitleChange,
    handleContentChange,
    categoryId,
    hashtagsInput,
    handleCategoryChange,
    handleHashtagsChange,
  } = useNewPost();

  return (
    <Header showBackButton backHref="/posts">
      <main className="flex flex-1 items-start justify-center bg-[var(--app-bg)] px-[16px] pt-[14px] pb-10">
        <div className="mx-auto flex w-full max-w-[var(--content-max)] flex-col items-center">
          <div className="w-full max-w-[min(860px,92vw)] bg-transparent p-2">
            <h2 className="mb-5 flex items-center justify-center gap-2 text-center font-['Pretendard'] text-[22px] font-extrabold leading-[1] text-[#111827]">
              <span aria-hidden="true">✍️</span>
              게시글 작성
            </h2>
            <form
              id="new-post-form"
              className="flex flex-col"
              noValidate
              onSubmit={handleSubmit}
            >
              <div className="flex flex-col gap-1 mb-3 last:mb-5">
                <label
                  htmlFor="new-post-category"
                  className="mb-0 font-['Pretendard'] text-[12px] font-extrabold leading-[12px] text-[#111827]"
                >
                  카테고리
                </label>
                <select
                  id="new-post-category"
                  name="categoryId"
                  className="w-full h-[38px] rounded-[12px] border border-[rgba(168,85,247,0.18)] bg-white px-3 font-['Pretendard',sans-serif] text-[14px] font-medium leading-[14px] text-[#111827] outline-none transition-shadow focus:border-[rgba(168,85,247,0.35)] focus:shadow-[0_0_0_4px_rgba(168,85,247,0.12)]"
                  value={categoryId}
                  onChange={handleCategoryChange}
                  aria-label="게시판 카테고리"
                >
                  {POST_CATEGORY_OPTIONS.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.label}
                    </option>
                  ))}
                </select>
              </div>
              <NewPostTitleField
                title={title}
                titleError={titleError}
                onChange={handleTitleChange}
              />
              <NewPostContentBlock
                content={content}
                contentRef={contentRef}
                contentError={contentError}
                onChange={handleContentChange}
                newImages={newImages}
                totalCount={totalCount}
                onRemovePreview={handleRemovePreview}
              />
              <NewPostImageAttachment
                fileInputRef={fileInputRef}
                totalCount={totalCount}
                maxImages={MAX_IMAGES}
                onFileChange={handleFileChange}
              />
              <div className="flex flex-col gap-1 mb-3 last:mb-5">
                <label
                  htmlFor="new-post-hashtags"
                  className="mb-0 font-['Pretendard'] text-[12px] font-extrabold leading-[12px] text-[#111827]"
                >
                  해시태그
                </label>
                <input
                  id="new-post-hashtags"
                  name="hashtags"
                  type="text"
                  className="w-full h-[38px] rounded-[12px] border border-[rgba(168,85,247,0.18)] bg-white px-3 font-['Pretendard',sans-serif] text-[14px] font-medium leading-[14px] text-[#111827] outline-none transition-shadow focus:border-[rgba(168,85,247,0.35)] focus:shadow-[0_0_0_4px_rgba(168,85,247,0.12)] placeholder:text-[13px] placeholder:font-medium placeholder:text-[rgba(17,24,39,0.55)]"
                  placeholder="예: 강아지, 산책 (최대 6개)"
                  value={hashtagsInput}
                  onChange={handleHashtagsChange}
                  autoComplete="off"
                />
              </div>
              {formError && (
                <span
                  className="mt-[2px] block min-h-[14px] font-['Pretendard',sans-serif] text-[12px] font-normal leading-[12px] text-[#FF0000]"
                  id="new-post-form-error"
                  role="alert"
                >
                  * {formError}
                </span>
              )}
              <button
                type="submit"
                className="inline-flex h-[33px] w-full max-w-[360px] self-center items-center justify-center rounded-[4px] border-0 bg-[var(--primary)] px-5 text-[13px] font-bold leading-[13px] text-white no-underline transition-all duration-200 hover:bg-[var(--primary-hover)] active:bg-[var(--primary-hover)] disabled:opacity-50 cursor-pointer"
                disabled={submitting}
              >
                완료
              </button>
            </form>
          </div>
        </div>
      </main>
    </Header>
  );
}
