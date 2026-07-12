// 관리자 전용: 신고된 게시글 목록·블라인드 해제·유저 정지·글 삭제.
import { useState, useEffect, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link, useNavigate } from 'react-router-dom';
import { Header } from '../components/Header.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { api } from '../api/client.js';
import { formatDateTime, getApiErrorMessage } from '../utils/index.js';

const PAGE_SIZE = 20;

interface ReportedAuthor {
  nickname?: string;
  status?: string;
}

interface ReportedRow {
  id: string;
  postId?: string;
  userId?: string;
  targetType?: string;
  title?: string;
  contentPreview?: string;
  author?: ReportedAuthor | null;
  authorStatus?: string;
  reportReasons?: string[];
  reportCount?: number;
  lastReportedAt?: string;
  isBlinded?: boolean;
}

/** @see former admin.css — details/summary 드롭다운 트리거 */
const ADMIN_ACTION_SUMMARY_CLASS =
  "list-none cursor-pointer select-none rounded-[6px] border border-[#e2e8f0] bg-[#f1f5f9] py-[6px] px-[10px] text-[13px] font-medium text-black [&::-webkit-details-marker]:hidden after:content-[''] after:ml-[6px] after:inline-block after:align-middle after:border-4 after:border-transparent after:border-t-current group-open:after:mb-[2px] group-open:after:border-t-transparent group-open:after:border-b-current";

/** @see former admin.css — 드롭다운 패널 */
const ADMIN_ACTION_MENU_CLASS =
  'absolute left-0 top-full z-50 mt-[4px] flex min-w-[120px] flex-col gap-[2px] rounded-[8px] border border-[#e2e8f0] bg-white p-[4px] shadow-[0_4px_12px_rgba(0,0,0,0.1)]';

/** @see former admin.css — 메뉴 버튼 공통 */
const ADMIN_ACTION_BTN_BASE =
  'cursor-pointer rounded-[4px] border-0 bg-transparent py-[6px] px-[10px] text-left text-[12px] font-medium text-black whitespace-nowrap transition-[background-color,color] duration-150 disabled:cursor-not-allowed disabled:opacity-60';

const ADMIN_ACTION_BTN_ACTIVE_CLASS = `${ADMIN_ACTION_BTN_BASE} bg-[#e2e8f0] hover:enabled:bg-[#cbd5e1]`;
const ADMIN_ACTION_BTN_DEFAULT_CLASS = ADMIN_ACTION_BTN_BASE;
const ADMIN_ACTION_BTN_GRAY_CLASS = `${ADMIN_ACTION_BTN_BASE} bg-transparent text-black hover:enabled:bg-transparent hover:enabled:text-black`;

/** @see former admin.css — 상태 배지 */
const ADMIN_BADGE_BASE =
  'inline-block whitespace-nowrap rounded-[4px] px-[6px] py-[2px] text-[11px] font-semibold';
const ADMIN_BADGE_GRAY_CLASS = `${ADMIN_BADGE_BASE} bg-[#f1f5f9] text-[#475569]`;
const ADMIN_BADGE_RED_CLASS = `${ADMIN_BADGE_BASE} bg-[#fef2f2] text-[#b91c1c]`;
const ADMIN_BADGE_ORANGE_CLASS = `${ADMIN_BADGE_BASE} bg-[#fff7ed] text-[#c2410c]`;

export function AdminDashboard() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [list, setList] = useState<ReportedRow[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);

  const optimisticRollback = useCallback(
    async (mutate: () => void, request: () => Promise<unknown>, failMessage: string) => {
      const prevList = list;
      const prevTotal = total;
      mutate();
      try {
        await request();
      } catch (err) {
        const e = err as { code?: string; message?: string };
        alert(getApiErrorMessage(e?.code ?? e?.message, failMessage));
        setList(prevList);
        setTotal(prevTotal);
      }
    },
    [list, total]
  );

  const isAdmin = user?.role === 'ADMIN';

  useEffect(() => {
    if (user != null && user.role !== 'ADMIN') {
      navigate('/', { replace: true });
    }
  }, [user, navigate]);

  const reportedQuery = useQuery({
    queryKey: ['admin', 'reported-posts', page],
    queryFn: async () => {
      const res = await api.get<{ data?: { items?: unknown; total?: unknown } }>(
        `/admin/reported-posts?page=${page}&size=${PAGE_SIZE}`
      );
      const payload = res?.data ?? {};
      return {
        items: Array.isArray(payload.items) ? (payload.items as ReportedRow[]) : [],
        total: Number(payload.total) || 0,
      };
    },
    enabled: isAdmin,
  });

  useEffect(() => {
    if (reportedQuery.data) {
      setList(reportedQuery.data.items);
      setTotal(reportedQuery.data.total);
    }
  }, [reportedQuery.data]);

  useEffect(() => {
    const status = (reportedQuery.error as { status?: number } | null)?.status;
    if (reportedQuery.isError && status === 403) {
      navigate('/', { replace: true });
    }
  }, [reportedQuery.isError, reportedQuery.error, navigate]);

  const loading = reportedQuery.isPending;
  const queryErrorStatus = (reportedQuery.error as { status?: number } | null)?.status;
  const error =
    reportedQuery.isError && queryErrorStatus !== 403
      ? (reportedQuery.error?.message ?? '목록을 불러올 수 없습니다.')
      : null;

  const handleUnblind = async (postId: string) => {
    if (!window.confirm('이 글의 블라인드를 해제(복구)하시겠습니까?')) return;
    await optimisticRollback(
      () => setList((prev) => prev.map((r) => (r.id === postId ? { ...r, isBlinded: false } : r))),
      () => api.patch(`/admin/posts/${postId}/unblind`),
      '복구 처리에 실패했습니다.'
    );
  };

  const handleSuspendUser = async (userId?: string) => {
    if (!window.confirm('해당 유저를 정지하시겠습니까? 정지된 유저는 로그인 및 활동이 제한됩니다.')) return;
    await optimisticRollback(
      () =>
        setList((prev) =>
          prev.map((r) =>
            r.userId === userId
              ? {
                  ...r,
                  authorStatus: 'SUSPENDED',
                  author: r.author ? { ...r.author, status: 'SUSPENDED' } : r.author,
                }
              : r
          )
        ),
      () => api.patch(`/admin/users/${userId}/suspend`),
      '유저 정지에 실패했습니다.'
    );
  };

  const handleActivateUser = async (userId?: string) => {
    if (!window.confirm('해당 유저의 정지를 해제하시겠습니까?')) return;
    await optimisticRollback(
      () =>
        setList((prev) =>
          prev.map((r) =>
            r.userId === userId
              ? {
                  ...r,
                  authorStatus: 'ACTIVE',
                  author: r.author ? { ...r.author, status: 'ACTIVE' } : r.author,
                }
              : r
          )
        ),
      () => api.patch(`/admin/users/${userId}/activate`),
      '정지 해제에 실패했습니다.'
    );
  };

  const handleBlindPost = async (postId: string) => {
    if (!window.confirm('이 글을 블라인드 처리하시겠습니까? 게시글이 비공개 처리됩니다.')) return;
    await optimisticRollback(
      () => setList((prev) => prev.map((r) => (r.id === postId ? { ...r, isBlinded: true } : r))),
      () => api.patch(`/admin/posts/${postId}/blind`),
      '블라인드 처리에 실패했습니다.'
    );
  };

  const handleDeletePost = async (postId: string) => {
    if (!window.confirm('이 게시글을 삭제하시겠습니까? 삭제된 글은 복구할 수 없습니다.')) return;
    await optimisticRollback(
      () => {
        setList((prev) => prev.filter((r) => !(r.targetType !== 'COMMENT' && r.id === postId)));
        setTotal((t) => Math.max(0, (Number(t) || 0) - 1));
      },
      () => api.delete(`/admin/posts/${postId}`),
      '글 삭제에 실패했습니다.'
    );
  };

  const handleResetReports = async (postId: string) => {
    if (!window.confirm('이 글의 신고를 초기화하시겠습니까? 해당 신고는 목록에서 사라집니다.')) return;
    await optimisticRollback(
      () => {
        setList((prev) => prev.filter((r) => !(r.targetType !== 'COMMENT' && r.id === postId)));
        setTotal((t) => Math.max(0, (Number(t) || 0) - 1));
      },
      () => api.patch(`/admin/posts/${postId}/reset-reports`),
      '신고 무시 처리에 실패했습니다.'
    );
  };

  const handleUnblindComment = async (commentId: string) => {
    if (!window.confirm('이 댓글의 블라인드를 해제하시겠습니까?')) return;
    await optimisticRollback(
      () => setList((prev) => prev.map((r) => (r.id === commentId ? { ...r, isBlinded: false } : r))),
      () => api.patch(`/admin/comments/${commentId}/unblind`),
      '댓글 블라인드 해제에 실패했습니다.'
    );
  };

  const handleBlindComment = async (commentId: string) => {
    if (!window.confirm('이 댓글을 블라인드 처리하시겠습니까?')) return;
    await optimisticRollback(
      () => setList((prev) => prev.map((r) => (r.id === commentId ? { ...r, isBlinded: true } : r))),
      () => api.patch(`/admin/comments/${commentId}/blind`),
      '댓글 블라인드 처리에 실패했습니다.'
    );
  };

  const handleResetCommentReports = async (commentId: string) => {
    if (!window.confirm('이 댓글의 신고를 초기화하시겠습니까? 해당 신고는 목록에서 사라집니다.')) return;
    await optimisticRollback(
      () => {
        setList((prev) => prev.filter((r) => !(r.targetType === 'COMMENT' && r.id === commentId)));
        setTotal((t) => Math.max(0, (Number(t) || 0) - 1));
      },
      () => api.patch(`/admin/comments/${commentId}/reset-reports`),
      '댓글 신고 무시 처리에 실패했습니다.'
    );
  };

  const handleDeleteComment = async (postId: string | undefined, commentId: string) => {
    if (!window.confirm('이 댓글을 삭제하시겠습니까? 삭제된 댓글은 복구할 수 없습니다.')) return;
    await optimisticRollback(
      () => {
        setList((prev) => prev.filter((r) => !(r.targetType === 'COMMENT' && r.id === commentId)));
        setTotal((t) => Math.max(0, (Number(t) || 0) - 1));
      },
      () => api.delete(`/admin/posts/${postId}/comments/${commentId}`),
      '댓글 삭제에 실패했습니다.'
    );
  };

  if (user != null && user?.role !== 'ADMIN') {
    return null;
  }

  return (
    <Header showBackButton backHref="/posts">
      <main className="flex flex-1 items-center justify-center bg-[var(--app-bg)] px-[16px] pt-[8px]">
        <div className="mx-auto w-full max-w-[1100px] p-6 text-[15px] leading-[1.35] text-black">
          <h1 className="mb-4 text-center text-[24px] font-extrabold">관리자 대시보드</h1>
          <p className="mb-3 text-center text-[14px] text-[var(--color-text-secondary,#666)]">
            신고가 누적되었거나 블라인드된 게시글 목록입니다.
          </p>

          {loading ? (
            <div className="admin-skeleton" aria-label="목록 로딩">
              <div className="admin-skeleton__header" aria-hidden="true" />
              {Array.from({ length: 8 }).map((_, i) => (
                <div key={i} className="admin-skeleton__row" aria-hidden="true" />
              ))}
            </div>
          ) : error ? (
            <p className="p-5 text-[var(--color-error)]">{error}</p>
          ) : list.length === 0 ? (
            <p className="p-10 text-center">신고된 내용이 없습니다.</p>
          ) : (
            <>
              <table className="w-full table-fixed border-collapse text-left text-[14px] [&_th+th]:border-l [&_td+td]:border-l [&_th+th]:border-[#9ca3af] [&_td+td]:border-[#9ca3af]">
                  <thead>
                    <tr className="border-b-2 border-[#9ca3af]">
                      <th className="w-[84px] px-3 py-2 font-extrabold whitespace-nowrap">
                        신고 유형
                      </th>
                      <th className="w-[24%] px-3 py-2 font-extrabold whitespace-nowrap">
                        게시글 제목
                      </th>
                      <th className="w-[26%] px-3 py-2 font-extrabold whitespace-nowrap">
                        내용
                      </th>
                      <th className="w-[120px] px-3 py-2 font-extrabold whitespace-nowrap">
                        작성자 닉네임
                      </th>
                      <th className="hidden lg:table-cell w-[80px] px-3 py-2 text-right font-extrabold whitespace-nowrap">
                        신고 횟수
                      </th>
                      <th className="hidden xl:table-cell w-[18%] px-3 py-2 font-extrabold whitespace-nowrap">
                        신고 사유
                      </th>
                      <th className="hidden xl:table-cell w-[140px] px-3 py-2 font-extrabold whitespace-nowrap">
                        최근 신고 시각
                      </th>
                      <th className="w-[84px] px-3 py-2 text-center font-extrabold whitespace-nowrap">
                        유저 상태
                      </th>
                      <th className="hidden md:table-cell w-[88px] px-3 py-2 text-center font-extrabold whitespace-nowrap">
                        노출 상태
                      </th>
                      <th className="w-[110px] px-3 py-2 font-extrabold whitespace-nowrap">
                        액션
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {list.map((row) => {
                      const title = row.title ?? '-';
                      const contentPreview = row.contentPreview ?? '-';
                      const authorNickname = row.author?.nickname ?? `user_${row.userId}`;

                      const reasons = row.reportReasons ?? [];
                      const reasonsText = (() => {
                        if (!reasons.length) return '-';
                        const countByReason = reasons.reduce(
                          (acc: Record<string, number>, r: string) => {
                            acc[r] = (acc[r] ?? 0) + 1;
                            return acc;
                          },
                          {} as Record<string, number>
                        );
                        return Object.entries(countByReason)
                          .sort(([a], [b]) => a.localeCompare(b))
                          .map(([reason, count]) => `${reason}(${count})`)
                          .join(', ');
                      })();

                      const lastReportedAtText = row.lastReportedAt ? formatDateTime(row.lastReportedAt) : '-';

                      return (
                        <tr key={`${row.targetType ?? 'POST'}-${row.id}`} className="border-b border-[#9ca3af]">
                          <td className="px-3 py-2 whitespace-nowrap truncate" title={row.targetType === 'COMMENT' ? '댓글' : '게시글'}>
                            {row.targetType === 'COMMENT' ? '댓글' : '게시글'}
                          </td>
                          <td className="px-3 py-2">
                            <Link
                              to={`/posts/${row.postId ?? row.id}?from=admin`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="block whitespace-normal break-words line-clamp-2 text-[var(--color-link,#2563eb)] underline"
                              title={title}
                            >
                              {title}
                            </Link>
                          </td>
                          <td className="px-3 py-2">
                            <div className="block whitespace-normal break-words line-clamp-2 text-[12px]" title={contentPreview}>
                              {contentPreview}
                            </div>
                          </td>
                          <td className="px-3 py-2">
                            <span className="block truncate whitespace-nowrap" title={authorNickname}>
                              {authorNickname}
                            </span>
                          </td>
                          <td className="hidden lg:table-cell px-3 py-2 text-right tabular-nums whitespace-nowrap truncate" title={String(row.reportCount ?? 0)}>
                            {row.reportCount ?? 0}
                          </td>
                          <td className="hidden xl:table-cell px-3 py-2">
                            <div className="block truncate whitespace-nowrap text-[12px]" title={reasonsText}>
                              {reasonsText}
                            </div>
                          </td>
                          <td className="hidden xl:table-cell px-3 py-2 whitespace-nowrap truncate" title={lastReportedAtText}>
                            {lastReportedAtText}
                          </td>
                          <td className="px-3 py-2 text-center whitespace-nowrap">
                            {(row.author?.status ?? row.authorStatus) === 'SUSPENDED' ? (
                              <span className={ADMIN_BADGE_RED_CLASS} title="정지된 유저">정지</span>
                            ) : (
                              <span className={ADMIN_BADGE_GRAY_CLASS} title="정상">정상</span>
                            )}
                          </td>
                          <td className="hidden md:table-cell px-3 py-2 text-center whitespace-nowrap">
                            {row.isBlinded ? (
                              <span className={ADMIN_BADGE_ORANGE_CLASS} title="블라인드">블라인드</span>
                            ) : (
                              <span className={ADMIN_BADGE_GRAY_CLASS} title="정상">정상</span>
                            )}
                          </td>
                          <td className="px-3 py-2 whitespace-nowrap">
                            {row.targetType === 'COMMENT' ? (
                              <details className="group relative inline-block">
                                <summary
                                  className={ADMIN_ACTION_SUMMARY_CLASS}
                                  aria-haspopup="listbox"
                                  aria-expanded="false"
                                >
                                  관리 메뉴
                                </summary>
                                <div className={ADMIN_ACTION_MENU_CLASS}>
                                  {row.isBlinded ? (
                                    <button
                                      type="button"
                                      className={ADMIN_ACTION_BTN_ACTIVE_CLASS}
                                      onClick={() => handleUnblindComment(row.id)}
                                    >
                                      블라인드 해제
                                    </button>
                                  ) : (
                                    <button
                                      type="button"
                                      className={ADMIN_ACTION_BTN_DEFAULT_CLASS}
                                      onClick={() => handleBlindComment(row.id)}
                                    >
                                      블라인드 처리
                                    </button>
                                  )}
                                  {(row.author?.status ?? row.authorStatus) === 'SUSPENDED' ? (
                                    <button
                                      type="button"
                                      className={ADMIN_ACTION_BTN_ACTIVE_CLASS}
                                      onClick={() => handleActivateUser(row.userId)}
                                    >
                                      정지 해제
                                    </button>
                                  ) : (
                                    <button
                                      type="button"
                                      className={ADMIN_ACTION_BTN_DEFAULT_CLASS}
                                      onClick={() => handleSuspendUser(row.userId)}
                                    >
                                      유저 정지
                                    </button>
                                  )}
                                  <button
                                    type="button"
                                    className={ADMIN_ACTION_BTN_DEFAULT_CLASS}
                                    onClick={() => handleDeleteComment(row.postId, row.id)}
                                  >
                                    댓글 삭제
                                  </button>
                                  <button
                                    type="button"
                                    className={ADMIN_ACTION_BTN_GRAY_CLASS}
                                    onClick={() => handleResetCommentReports(row.id)}
                                  >
                                    신고 무시
                                  </button>
                                </div>
                              </details>
                            ) : (
                              <details className="group relative inline-block">
                                <summary
                                  className={ADMIN_ACTION_SUMMARY_CLASS}
                                  aria-haspopup="listbox"
                                  aria-expanded="false"
                                >
                                  관리 메뉴
                                </summary>
                                <div className={ADMIN_ACTION_MENU_CLASS}>
                                  {row.isBlinded ? (
                                    <button
                                      type="button"
                                      className={ADMIN_ACTION_BTN_ACTIVE_CLASS}
                                      onClick={() => handleUnblind(row.id)}
                                    >
                                      블라인드 해제
                                    </button>
                                  ) : (
                                    <button
                                      type="button"
                                      className={ADMIN_ACTION_BTN_DEFAULT_CLASS}
                                      onClick={() => handleBlindPost(row.id)}
                                    >
                                      블라인드 처리
                                    </button>
                                  )}
                                  {(row.author?.status ?? row.authorStatus) === 'SUSPENDED' ? (
                                    <button
                                      type="button"
                                      className={ADMIN_ACTION_BTN_ACTIVE_CLASS}
                                      onClick={() => handleActivateUser(row.userId)}
                                    >
                                      정지 해제
                                    </button>
                                  ) : (
                                    <button
                                      type="button"
                                      className={ADMIN_ACTION_BTN_DEFAULT_CLASS}
                                      onClick={() => handleSuspendUser(row.userId)}
                                    >
                                      유저 정지
                                    </button>
                                  )}
                                  <button
                                    type="button"
                                    className={ADMIN_ACTION_BTN_DEFAULT_CLASS}
                                    onClick={() => handleDeletePost(row.id)}
                                  >
                                    글 삭제
                                  </button>
                                  <button
                                    type="button"
                                    className={ADMIN_ACTION_BTN_GRAY_CLASS}
                                    onClick={() => handleResetReports(row.id)}
                                  >
                                    신고 무시
                                  </button>
                                </div>
                              </details>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              {total > PAGE_SIZE && (
                <div className="mt-4 flex gap-2 justify-center">
                  <button
                    type="button"
                    className="cursor-pointer inline-flex h-[33px] items-center justify-center rounded-[4px] border-0 bg-[var(--primary)] px-5 text-[13px] font-bold leading-[13px] text-white no-underline transition-all duration-200 hover:bg-[var(--primary-hover)] active:bg-[var(--primary-hover)] disabled:opacity-50"
                    disabled={page <= 1}
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                  >
                    이전
                  </button>
                  <span className="self-center text-[13px] text-black">
                    {page} / {Math.ceil(total / PAGE_SIZE) || 1}
                  </span>
                  <button
                    type="button"
                    className="cursor-pointer inline-flex h-[33px] items-center justify-center rounded-[4px] border-0 bg-[var(--primary)] px-5 text-[13px] font-bold leading-[13px] text-white no-underline transition-all duration-200 hover:bg-[var(--primary-hover)] active:bg-[var(--primary-hover)] disabled:opacity-50"
                    disabled={page * PAGE_SIZE >= total}
                    onClick={() => setPage((p) => p + 1)}
                  >
                    다음
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </main>
    </Header>
  );
}
