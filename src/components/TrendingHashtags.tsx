import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiGet } from '../api/typed.js';

interface HashtagItem {
  name: string;
  count: number;
}

function unwrapApiList(res: unknown): unknown[] {
  if (!res) return [];
  const data = (res as { data?: unknown })?.data ?? res;
  const list = (data as { data?: unknown })?.data ?? data;
  return Array.isArray(list) ? list : [];
}

function rankClass(rank: number): string {
  if (rank <= 3) return 'text-purple-600 font-extrabold';
  return 'text-gray-400 font-medium';
}

export function TrendingHashtags() {
  const navigate = useNavigate();
  const [hashtags, setHashtags] = useState<HashtagItem[]>([]);
  const [loading, setLoading] = useState(true);

  const handleTagClick = (name: string) => {
    const raw = String(name ?? '').trim();
    if (!raw) return;
    const q = `#${raw}`;
    navigate(`/posts?q=${encodeURIComponent(q)}`);
  };

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        setLoading(true);
        const res = await apiGet('/v1/posts/trending-hashtags', {});
        const items = unwrapApiList(res)
          .slice(0, 10)
          .map((raw) => {
            const x = (raw ?? {}) as { name?: unknown; count?: unknown };
            return {
              name: String(x.name ?? '').trim(),
              count: Number(x.count ?? 0),
            };
          })
          .filter((x) => x.name);
        if (alive) setHashtags(items);
      } catch (_) {
        if (alive) setHashtags([]);
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  const displayHashtags = Array.from({ length: 10 }, (_, i) => hashtags[i] ?? null);

  return (
    <section className="w-full min-h-[272px] box-border rounded-[20px] bg-gradient-to-br from-[rgba(168,85,247,0.10)] via-white to-white p-3 pl-4 pr-3 pb-[17px] shadow-[0_2px_18px_rgba(168,85,247,0.06)]">
      <div className="flex flex-nowrap items-center gap-2 pb-1 mb-2.5">
        <span className="text-[16px] leading-none" aria-hidden="true">
          🐾
        </span>
        <div className="flex-1 whitespace-nowrap text-[14px] font-extrabold text-gray-900">
          지금 뜨는 멍태그
        </div>
        <span className="ml-auto whitespace-nowrap inline-flex items-center rounded-full bg-[rgba(168,85,247,0.10)] px-2 py-[2px] text-[10px] font-bold text-[rgba(91,33,182,1)]">
          TOP 10
        </span>
      </div>

      {loading ? (
        <ul className="m-0 list-none space-y-1 p-0" aria-busy="true" aria-label="멍태그 순위">
          {Array.from({ length: 10 }, (_, idx) => (
            <li key={`sk-${idx}`}>
              <div className="flex w-full items-center gap-2 rounded-[10px] px-1.5 py-[5px]">
                <span className="w-5 shrink-0 text-center text-[12px] tabular-nums text-gray-300">{idx + 1}</span>
                <span className="h-[18px] flex-1 rounded bg-[rgba(15,23,42,0.08)] [animation:postlist-skeleton-shimmer_1.1s_ease-in-out_infinite]" />
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <ul className="m-0 list-none space-y-1 p-0">
          {displayHashtags.map((h, idx) => {
            const rank = idx + 1;
            const missing = h == null || !h.name;
            return (
              <li key={`rank-${rank}`}>
                <button
                  type="button"
                  disabled={missing}
                  className="flex w-full items-center gap-2 rounded-[10px] border-0 bg-transparent px-1.5 py-[5px] text-left cursor-pointer outline-none transition-colors hover:bg-[rgba(168,85,247,0.08)] focus:outline-none focus-visible:outline-none active:bg-[rgba(168,85,247,0.12)] disabled:cursor-default disabled:opacity-45"
                  title={missing ? '' : `#${h.name} 검색`}
                  aria-label={missing ? `${rank}위: -` : `${h.name} 태그로 게시글 검색`}
                  onClick={() => {
                    if (missing) return;
                    handleTagClick(h.name);
                  }}
                >
                  <span className={`w-5 shrink-0 text-center text-[12px] tabular-nums ${rankClass(rank)}`}>{rank}</span>
                  <span className="min-w-0 flex-1 truncate text-[13px] font-semibold text-sky-700">
                    {missing ? '-' : `#${h.name}`}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

