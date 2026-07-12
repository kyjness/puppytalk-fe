// 차단 유저 관리: GET /users/me/blocks 목록 표시, 차단 해제 시 POST /users/{id}/block 토글.
import { useState, useEffect, type SyntheticEvent } from 'react';
import { api } from '../../api/client.js';
import { DEFAULT_PROFILE_IMAGE } from '../../config.js';
import { getApiErrorMessage, getClientErrorCode } from '../../utils/index.js';

interface BlockedUser {
  id: string;
  nickname?: string;
  profileImageUrl?: string | null;
}

export function BlockManagement() {
  const [list, setList] = useState<BlockedUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const fetchBlocks = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await api.get<{ data?: { items?: unknown } }>('/users/me/blocks');
      const payload = res?.data ?? {};
      const items = Array.isArray(payload.items) ? (payload.items as BlockedUser[]) : [];
      setList(items);
    } catch (err) {
      setError(getApiErrorMessage(getClientErrorCode(err), '차단 목록을 불러오지 못했습니다.'));
      setList([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBlocks();
  }, []);

  const handleUnblock = async (userId: string) => {
    const prevList = list;
    const nextList = prevList.filter((item) => item.id !== userId);
    setList(nextList);
    try {
      await api.post(`/users/${userId}/block`);
    } catch (err) {
      const msg = getApiErrorMessage(getClientErrorCode(err), '차단 해제에 실패했습니다.');
      alert(msg);
      setError(msg);
      setList(prevList);
    }
  };

  const avatarUrl = (item: BlockedUser) => item?.profileImageUrl ?? DEFAULT_PROFILE_IMAGE;

  return (
    <div className="flex w-full max-w-[600px] flex-col items-center pb-2 text-center">
      <h2 className="mb-4 text-center font-['Pretendard'] text-[18px] font-bold leading-[18px] text-black">
        차단 관리
      </h2>
      {error && (
        <p className="mb-3 text-sm text-red-500" role="alert">
          {error}
        </p>
      )}
      {loading ? (
        <ul className="m-0 flex list-none flex-col gap-4 p-0" aria-label="차단 목록 로딩">
          {Array.from({ length: 4 }).map((_, i) => (
            <li
              key={i}
              className="animate-[skeleton-pulse_1.05s_ease-in-out_infinite] flex items-center justify-between gap-4 border-b border-[#e5e7eb] pt-1 pb-4 last:border-b-0"
            >
              <div className="flex min-w-0 items-center gap-3">
                <div
                  className="h-10 w-10 shrink-0 rounded-full bg-[rgba(15,23,42,0.1)]"
                  aria-hidden="true"
                />
                <div
                  className="h-[14px] min-w-0 max-w-[min(180px,40vw)] rounded-[8px] bg-[rgba(15,23,42,0.1)]"
                  aria-hidden="true"
                />
              </div>
              <div
                className="h-8 w-[88px] shrink-0 rounded-full bg-[rgba(15,23,42,0.1)]"
                aria-hidden="true"
              />
            </li>
          ))}
        </ul>
      ) : list.length === 0 ? (
        <p className="m-0 w-full text-center text-sm text-gray-600">차단한 유저가 없습니다.</p>
      ) : (
        <ul className="m-0 flex list-none flex-col gap-4 p-0">
          {list.map((item) => (
            <li
              key={item.id}
              className="flex items-center justify-between gap-4 border-b border-[#e5e7eb] pt-1 pb-4 last:border-b-0"
            >
              <div className="flex min-w-0 items-center gap-3">
                <img
                  src={avatarUrl(item)}
                  alt=""
                  className="h-10 w-10 shrink-0 rounded-full bg-gray-200 object-cover"
                  onError={(e: SyntheticEvent<HTMLImageElement>) => {
                    if (e.currentTarget.src !== DEFAULT_PROFILE_IMAGE) {
                      e.currentTarget.src = DEFAULT_PROFILE_IMAGE;
                    }
                  }}
                />
                <span className="truncate font-medium text-gray-800">{item.nickname ?? ''}</span>
              </div>
              <button
                type="button"
                className="inline-flex h-[40px] w-fit shrink-0 items-center justify-center rounded-full border-0 bg-transparent px-5 text-[12px] font-normal leading-[12px] text-black no-underline transition-all duration-200 hover:text-[#333333] active:text-[#111111] disabled:opacity-50"
                onClick={() => handleUnblock(item.id)}
              >
                차단 해제
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
