/** @see former comment.css — 댓글 도메인 Tailwind 단일 소스 */

export const COMMENT_WRITE_BOX =
  'mx-auto my-[15px] -mb-[10px] max-w-[min(590px,92vw)] rounded-[12px] bg-white px-[18px]';

export const COMMENT_FORM = 'flex flex-col';

export const COMMENT_TEXTAREA =
  "box-border mb-3 max-h-[400px] min-h-[80px] w-full resize-none overflow-hidden border-0 bg-transparent py-[20px] pb-3 pl-[10px] pr-0 font-['Pretendard',sans-serif] text-[13px] leading-[1.5] shadow-none outline-none placeholder:text-[13px] focus:border-0 focus:outline-none";

export const COMMENT_WRITE_BOX_DIVIDER =
  'mb-[5px] block h-px w-[calc(100%+40px)] shrink-0 bg-[#D9D9D9] -mx-5';

export const COMMENT_FORM_SUBMIT =
  'mb-2 self-end cursor-pointer rounded-[20px] border-0 bg-[var(--primary)] px-[22px] py-[7px] text-[13px] font-bold leading-none text-white transition-all duration-200 hover:bg-[var(--primary-hover)] disabled:opacity-50';

export const COMMENT_ITEM = (isTopLevel: boolean, isReply: boolean) =>
  [
    'flex items-start gap-3 rounded-[12px] bg-transparent px-[14px]',
    isTopLevel ? 'pt-1 pb-[6px]' : 'pt-[6px] pb-2',
    isReply ? 'mt-1 ml-5' : '',
  ]
    .filter(Boolean)
    .join(' ');

export const COMMENT_ITEM_AVATAR =
  'h-9 w-9 shrink-0 overflow-hidden rounded-full bg-[#e5e7eb]';

export const COMMENT_ITEM_AVATAR_IMG = 'block h-full w-full rounded-full object-cover';

export const COMMENT_ITEM_BODY = 'min-w-0 flex-1';

export const COMMENT_ITEM_HEADER = 'relative mb-1 box-border flex min-h-0 items-start pr-[120px]';

export const COMMENT_ITEM_AUTHOR_WRAP =
  'inline-flex min-w-0 flex-1 flex-wrap items-center gap-x-1.5 gap-y-[3px] leading-[1.25]';

export const COMMENT_ITEM_AUTHOR =
  'inline text-[13px] font-semibold leading-[inherit] text-black';

export const COMMENT_ITEM_DOG =
  'ml-1 inline whitespace-nowrap text-[12px] font-normal leading-[inherit] text-[#666]';

export const COMMENT_ITEM_CONTENT_BLOCK = 'relative m-0 pr-11 pt-0';

/** 첫 줄: 본문 + 좋아요 열(absolute) */
export const COMMENT_ITEM_CONTENT_ROW = 'relative m-0 flex items-start justify-between gap-3 p-0';

export const COMMENT_ITEM_TEXT_WRAP = 'min-w-0 flex-1';

export const COMMENT_ITEM_CONTENT = (extra?: string) =>
  ['m-0 min-w-0 whitespace-pre-line text-[14px] leading-[1.45] text-black', extra].filter(Boolean).join(' ');

export const COMMENT_ITEM_CONTENT_CLAMP = 'line-clamp-3 overflow-hidden';

export const COMMENT_ITEM_READMORE_BTN =
  'mt-1 cursor-pointer border-0 bg-transparent p-0 text-[12px] font-medium text-[#6b7280] hover:text-[#374151]';

export const COMMENT_ITEM_LIKE_COL =
  'absolute -top-1 -right-11 flex w-7 flex-col items-center gap-[5px]';

export const COMMENT_ITEM_LIKE_ICON_WRAP =
  'flex w-7 shrink-0 items-start justify-center';

export const commentItemLikeIconBtn = (isLiked: boolean) =>
  [
    'inline-flex items-center justify-center rounded-lg border-0 bg-transparent p-[5px] transition-colors duration-150',
    isLiked
      ? 'cursor-pointer text-[#f43f5e] hover:bg-[#fff1f2] hover:text-rose-600'
      : 'cursor-pointer text-[#94a3b8] hover:bg-[#fff1f2] hover:text-[#f43f5e]',
  ].join(' ');

export const COMMENT_ITEM_LIKE_COUNT =
  '-mt-0.5 w-7 shrink-0 text-center text-[12px] leading-none text-[#64748b]';

export const COMMENT_ITEM_META_ROW = 'mt-1.5 flex items-center justify-between gap-3';

export const COMMENT_ITEM_META = 'm-0 mt-0 flex items-center gap-[14px] text-[12px] text-[#64748b]';

export const COMMENT_REPLY_BTN =
  'cursor-pointer border-0 bg-transparent p-0 text-[12px] text-[#64748b] hover:text-[#475569]';

export const COMMENT_ITEM_ACTIONS = (isReply: boolean) =>
  [
    'absolute -top-[3px] flex shrink-0 flex-row items-center gap-2',
    isReply ? 'right-[-20px]' : 'right-0',
  ].join(' ');

export const COMMENT_ITEM_MENU_TRIGGER =
  'relative -top-[9px] inline-flex h-8 w-8 cursor-pointer items-center justify-center rounded-lg border-0 bg-transparent p-0 text-[#64748b] transition-colors duration-150 hover:bg-[#f1f5f9] hover:text-[#334155]';

export const COMMENT_ITEM_MENU_BACKDROP = 'fixed inset-0 z-[199]';

export const COMMENT_ITEM_MENU =
  'absolute right-0 top-full z-[200] -mt-3.5 flex min-w-[88px] list-none flex-col gap-0.5 rounded-[14px] border border-[rgba(148,163,184,0.25)] bg-[rgba(255,255,255,0.78)] p-1.5 shadow-[0_24px_48px_-18px_rgba(2,6,23,0.35),0_12px_22px_-14px_rgba(2,6,23,0.25)] backdrop-blur-[8px] [&>li]:m-0 [&>li]:p-0';

export const COMMENT_ITEM_MENU_POST_DETAIL = `${COMMENT_ITEM_MENU} -mt-px`;

export const MENU_ITEM_BTN =
  "flex w-full cursor-pointer items-center gap-2 rounded-[10px] border-0 bg-transparent px-2.5 py-2 text-left font-['Pretendard',sans-serif] text-[13px] text-[#4b5563] transition-all duration-200 ease-in-out hover:bg-[rgba(148,163,184,0.18)] hover:text-[#0f172a] active:bg-[rgba(148,163,184,0.25)]";

export const MENU_ITEM_BTN_DANGER =
  "flex w-full cursor-pointer items-center gap-2 rounded-[10px] border-0 bg-transparent px-2.5 py-2 text-left font-['Pretendard',sans-serif] text-[13px] text-[#4b5563] transition-all duration-200 ease-in-out hover:bg-[#fef2f2] hover:text-[#ef4444] active:bg-[rgba(148,163,184,0.25)]";

export const COMMENT_ITEM_ACTIONS_SPACER =
  'pointer-events-none invisible h-8 w-8 shrink-0';

export const COMMENT_ITEM_EDITED = 'text-[12px] text-[#94a3b8]';

export const COMMENT_REPLIES = 'ml-[-40px] mt-1 overflow-visible pl-0';

export const COMMENT_REPLIES_TOGGLE =
  'mb-1 mt-2 ml-[35px] flex cursor-pointer items-center gap-2 border-0 bg-transparent p-0 text-[13px] font-semibold text-[#7c3aed] transition-colors duration-150 ease-in-out hover:text-[#6d28d9]';

export const COMMENT_EDIT_FORM = 'my-2';

export const COMMENT_EDIT_TEXTAREA =
  "w-full min-h-[60px] resize-none overflow-hidden rounded-md border border-[#d1d5db] p-2 font-['Pretendard',sans-serif] text-[13px]";

export const COMMENT_EDIT_ACTIONS = 'mt-2 inline-flex items-center gap-3';

export const COMMENT_SORT_TABS =
  'mb-1.5 mt-7 flex flex-wrap items-center justify-center gap-x-3 gap-y-1.5';

export const commentSortTabBtn = (selected: boolean) =>
  [
    'cursor-pointer rounded-md border-0 bg-transparent px-2.5 py-1.5 text-[13px]',
    selected
      ? 'font-bold text-[#1e293b] hover:text-[#1e293b]'
      : 'text-[#94a3b8] hover:text-[#64748b]',
  ].join(' ');

export const COMMENT_LIST_SECTION = 'mt-4 flex flex-col gap-1.5';

export const COMMENT_PAGINATION = 'mt-5 flex justify-center';

export const COMMENT_PAGINATION_UL = 'm-0 flex list-none flex-wrap justify-center gap-2 p-0';

export const commentPaginationBtn = (active: boolean) =>
  [
    'h-9 min-w-9 cursor-pointer rounded-lg px-2.5 text-[14px] font-medium transition-colors duration-200',
    active
      ? 'border border-[#aca0eb] bg-[#aca0eb] text-white'
      : 'border border-[#d1d5db] bg-white hover:border-[#9ca3af] hover:bg-[#f9fafb]',
  ].join(' ');

export const COMMENT_REPLY_BOX =
  'mt-[14px] mb-[6px] flex flex-col rounded-[12px] bg-white px-[18px]';

export const COMMENT_REPLY_TEXTAREA =
  "box-border mb-3 w-full max-h-[200px] min-h-[36px] resize-none overflow-hidden border-0 bg-transparent py-[20px] pb-3 pl-[10px] pr-0 font-['Pretendard',sans-serif] text-[13px] leading-[1.4] outline-none placeholder:text-[13px]";

export const COMMENT_REPLY_BOX_DIVIDER = COMMENT_WRITE_BOX_DIVIDER;

export const COMMENT_REPLY_ACTIONS = 'mb-2 flex items-center justify-end gap-3';

export const COMMENT_REPLY_CANCEL =
  'cursor-pointer border-0 bg-transparent p-0 text-[12px] text-[#64748b] hover:text-[#475569]';

export const COMMENT_REPLY_SUBMIT =
  'mt-1 h-[30px] cursor-pointer self-end rounded-2xl border-0 bg-[var(--primary)] px-[18px] py-1.5 text-[12px] font-bold leading-none text-white transition-all duration-200 hover:bg-[var(--primary-hover)] disabled:opacity-50';
