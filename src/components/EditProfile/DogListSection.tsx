// 회원정보 수정 우리 강아지 목록·카드·추가 버튼.
import type { FormDog } from '../../hooks/useDogManagement.js';

interface DogListSectionProps {
  dogs: FormDog[];
  setDogAt: (index: number, patch: Partial<FormDog>) => void;
  addDog: () => void;
  removeDog: (index: number) => void;
  setRepresentative: (index: number) => void;
}

const GENDER_OPTIONS: { value: FormDog['gender']; label: string }[] = [
  { value: 'male', label: '\u2642\uFE0F' }, /* ♂️ */
  { value: 'female', label: '\u2640\uFE0F' }, /* ♀️ */
];

/** @see former mypage.css — 성별/대표 pill 버튼 */
const DOG_CHOICE_BASE =
  "cursor-pointer rounded-full border border-[rgba(0,0,0,0.2)] bg-white px-4 py-2 font-['Pretendard',sans-serif] text-[13px] leading-[13px] text-[#374151] transition-[background-color,border-color,color] duration-200 hover:border-[rgba(0,0,0,0.35)] hover:bg-[#f9fafb]";
const DOG_CHOICE_ACTIVE =
  "cursor-pointer rounded-full border border-[#1f2937] bg-[#1f2937] px-4 py-2 font-['Pretendard',sans-serif] text-[13px] leading-[13px] text-white transition-[background-color,border-color,color] duration-200 hover:border-[#111827] hover:bg-[#111827]";

const DOG_LABEL =
  "mb-0 font-['Pretendard'] text-[12px] font-bold leading-[12px] text-black";
const DOG_INPUT =
  "w-full h-[33px] border border-black rounded-[4px] bg-[#F4F5F7] py-[12px] px-[14px] font-['Pretendard',sans-serif] text-[13px] font-normal leading-[13px] text-black outline-none focus:border-black placeholder:font-['Pretendard',sans-serif] placeholder:text-[13px] placeholder:font-normal placeholder:leading-[13px] placeholder:text-black placeholder:opacity-100 placeholder:transition-opacity placeholder:duration-200 focus:placeholder:opacity-0";

/** 오늘 날짜 YYYY-MM-DD (생년월일 미래 선택 방지용) */
function getTodayISO() {
  return new Date().toISOString().slice(0, 10);
}

export function DogListSection({
  dogs,
  setDogAt,
  addDog,
  removeDog,
  setRepresentative,
}: DogListSectionProps) {
  const maxBirthDate = getTodayISO();
  return (
    <div className="mt-6 flex flex-col">
      {dogs.map((dog, index) => (
        <div
          key={index}
          className="mb-6 border-b border-black/[0.08] bg-transparent py-4 pb-5 last:mb-4 last:border-b-0"
        >
          <div className="grid grid-cols-2 gap-x-5 gap-y-4 max-[480px]:grid-cols-1">
            <div className="flex flex-col gap-1">
              <label className={DOG_LABEL}>이름</label>
              <input
                type="text"
                className={DOG_INPUT}
                value={dog.name}
                onChange={(e) => setDogAt(index, { name: e.target.value })}
                placeholder="강아지 이름"
                maxLength={100}
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className={DOG_LABEL}>품종</label>
              <input
                type="text"
                className={DOG_INPUT}
                value={dog.breed}
                onChange={(e) => setDogAt(index, { breed: e.target.value })}
                placeholder="품종"
                maxLength={100}
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className={DOG_LABEL}>성별</label>
              <div className="flex w-full flex-nowrap gap-2" role="group" aria-label="성별 선택">
                {GENDER_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    className={`min-w-0 flex-1 ${dog.gender === opt.value ? DOG_CHOICE_ACTIVE : DOG_CHOICE_BASE}`}
                    onClick={() => setDogAt(index, { gender: opt.value })}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>
            <div className="flex flex-col gap-1">
              <label className={DOG_LABEL}>생년월일</label>
              <input
                type="date"
                className="w-full h-[33px] border border-black rounded-[4px] bg-[#F4F5F7] py-[12px] px-[14px] font-['Pretendard',sans-serif] text-[13px] font-normal leading-[13px] text-black outline-none focus:border-black"
                value={dog.birthDate}
                max={maxBirthDate}
                onChange={(e) => setDogAt(index, { birthDate: e.target.value })}
                title="미래 날짜는 선택할 수 없습니다"
              />
            </div>
            <div className="col-span-full flex flex-col items-center justify-center pt-1 max-[480px]:col-span-1">
              <div className="inline-flex flex-wrap justify-center gap-2">
                <button
                  type="button"
                  className={`min-w-[7rem] ${dog.isRepresentative ? DOG_CHOICE_ACTIVE : DOG_CHOICE_BASE}`}
                  onClick={() => setRepresentative(index)}
                >
                  {dog.isRepresentative ? '대표로 설정됨' : '대표로 설정'}
                </button>
              </div>
            </div>
          </div>
          {dogs.length > 1 && (
            <div className="mt-4">
              <button
                type="button"
                className="inline-flex h-[40px] w-fit items-center justify-center rounded-full border-0 bg-transparent px-3 py-1.5 text-[13px] font-normal leading-[13px] text-black no-underline transition-all duration-200 hover:text-[#333333] active:text-[#111111]"
                onClick={() => removeDog(index)}
              >
                삭제
              </button>
            </div>
          )}
        </div>
      ))}
      <button
        type="button"
        className="mt-[3px] inline-flex h-[40px] w-fit self-center items-center justify-center rounded-full border-0 bg-transparent px-5 text-[12px] font-normal leading-[12px] text-black no-underline transition-all duration-200 hover:text-[#333333] active:text-[#111111]"
        onClick={addDog}
      >
        강아지 추가
      </button>
    </div>
  );
}
