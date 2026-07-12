// 반려견 관리 탭: 강아지 추가/수정/대표 설정, PATCH /users/me (dogs).
import { useDogManagement } from '../../hooks/useDogManagement.js';
import { DogListSection } from '../EditProfile';

export function DogManagement() {
  const {
    dogs,
    setDogAt,
    addDog,
    removeDog,
    setRepresentative,
    formError,
    submitting,
    handleSubmit,
  } = useDogManagement();

  return (
    <div className="flex w-full max-w-[600px] flex-col items-center pb-2 text-center">
      <h2 className="mb-4 text-center font-['Pretendard'] text-[18px] font-bold leading-[18px] text-black">
        반려견 관리
      </h2>
      <form
        className="flex w-full max-w-[480px] flex-col text-left"
        noValidate
        onSubmit={handleSubmit}
      >
        <DogListSection
          dogs={dogs}
          setDogAt={setDogAt}
          addDog={addDog}
          removeDog={removeDog}
          setRepresentative={setRepresentative}
        />
        {formError && (
          <span
            className="mt-[2px] block min-h-[14px] font-['Pretendard',sans-serif] text-[12px] font-normal leading-[12px] text-[#FF0000]"
            role="alert"
          >
            * {formError}
          </span>
        )}
        <div className="mt-4 flex w-full flex-wrap justify-center gap-2">
          <button
            type="submit"
            className="inline-flex h-[33px] w-full max-w-[360px] self-center items-center justify-center rounded-[4px] border-0 bg-[var(--primary)] px-5 text-[13px] font-bold leading-[13px] text-white no-underline transition-all duration-200 hover:bg-[var(--primary-hover)] active:bg-[var(--primary-hover)] disabled:opacity-50"
            disabled={submitting}
          >
            저장하기
          </button>
        </div>
      </form>
    </div>
  );
}
