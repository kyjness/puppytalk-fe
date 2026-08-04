// 차단 유저 관리: GET /users/me/blocks(커서 페이지네이션) 목록 표시,
// 차단 해제 시 POST /users/{id}/block 토글.
import { useState, useEffect, useCallback, type SyntheticEvent } from 'react';
import { apiGet, apiPost } from '../../api/typed.js';
import { DEFAULT_PROFILE_IMAGE } from '../../config.js';
import {
  getApiErrorMessage,
  getClientErrorCode,
  nextCursorFromPage,
} from '../../utils/index.js';

const PAGE_SIZE = 20;

interface BlockedUser {
  id: string;
  nickname?: string;
  profileImageUrl?: string | null;
}

export function BlockManagement() {
  const [list, setList] = useState<BlockedUser[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState('');

  /** cursor가 있으면 이어붙이고, 없으면 처음부터 다시 채운다. */
  const fetchBlocks = useCallback(async (after: string | null) => {
    const isAppend = after != null;
    if (isAppend) setLoadingMore(true);
    else setLoading(true);
    setError('');
    try {
      const res = await apiGet('/v1/users/me/blocks', {
        query: { size: PAGE_SIZE, cursor: after },
      });
      const payload = res?.data;
      const items = Array.isArray(payload?.items) ? (payload.items as BlockedUser[]) : [];
      const next = nextCursorFromPage(items, Boolean(payload?.hasMore));
      setList((prev) => {
        if (!isAppend) return items;
        const seen = new Set(prev.map((u) => u.id));
        return [...prev, ...items.filter((u) => !seen.has(u.id))];
      });
      setCursor(next);
    } catch (err) {
      setError(getApiErrorMessage(getClientErrorCode(err), '차단 목록을 불러오지 못했습니다.'));
      if (!isAppend) setList([]);
    } finally {
      if (isAppend) setLoadingMore(false);
      else setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchBlocks(null);
  }, [fetchBlocks]);

  const handleUnblock = async (userId: string) => {
    const prevList = list;
    const nextList = prevList.filter((item) => item.id !== userId);
    setList(nextList);
    try {
      await apiPost('/v1/users/{target_user_id}/block', { path: { target_user_id: userId } });
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
          {/* 서버가 커서 페이지네이션이라 전체 개수를 모른다 — 남았으면 이어 받는다. */}
          {cursor && (
            <li className="flex justify-center border-b-0 pt-1 pb-2">
              <button
                type="button"
                className="inline-flex h-[40px] w-fit items-center justify-center rounded-full border-0 bg-transparent px-5 text-[13px] font-normal text-gray-600 transition-colors duration-200 hover:text-black disabled:opacity-50"
                disabled={loadingMore}
                onClick={() => void fetchBlocks(cursor)}
              >
                {loadingMore ? '불러오는 중…' : '더 보기'}
              </button>
            </li>
          )}
        </ul>
      )}
    </div>
  );
}
