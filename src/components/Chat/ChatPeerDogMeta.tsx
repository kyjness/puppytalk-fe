// 채팅 헤더의 상대 대표견 한 줄(이름 / 견종 / 성별 / 나이).
// 전체화면·플로팅 두 헤더가 같은 조립 규칙을 쓰고 글자 크기만 다르다 — 차이는 className으로 받는다.
import { formatDogGenderLabel } from '../../utils/index.js';

export interface ChatPeerDogMetaProps {
  name: string;
  breed: string;
  gender: string;
  age: string;
  /** 크기·여백 등 화면별 차이. */
  className: string;
}

export function ChatPeerDogMeta({ name, breed, gender, age, className }: ChatPeerDogMetaProps) {
  if (!name) return null;

  const parts = [name, breed, gender ? formatDogGenderLabel(gender) : '', age].filter(Boolean);

  return (
    <span className={className}>
      {parts.map((p, i) => (
        <span key={i}>
          {i > 0 && ' / '}
          {p}
        </span>
      ))}
    </span>
  );
}
