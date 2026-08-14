// DM 메시지 목록 렌더링 — 날짜 구분선·시각·아바타·말풍선 배치.
// 전체화면 채팅방(ChatRoom)과 플로팅 채팅창(FloatingChatWindow)이 공유한다.
// 스크롤 컨테이너는 각 화면이 소유한다 — 여기는 "무엇을 그리는가"만 책임진다.
import { memo, useMemo, type ReactNode } from 'react';

import type { ChatMessageRow } from '../../api/api-types.js';
import { ChatMessageBubble } from './ChatMessageBubble';
import { DEFAULT_PROFILE_IMAGE } from '../../config.js';
import { dayKey, formatChatTime12h, formatDayDivider, parseDateSafe, safeImageUrl } from '../../utils/index.js';

export interface ChatMessageListProps {
  messages: ChatMessageRow[];
  /** 내 공개 사용자 ID — 말풍선 좌/우 정렬 판정. */
  myId: string;
  peerProfileImageUrl: string;
  loadingInitial: boolean;
  loadError: string | null;
  /** 상단 무한 스크롤 sentinel — 전체화면 채팅방만 넘긴다. */
  topSentinel?: ReactNode;
  onRetry: (message: ChatMessageRow) => void;
  onDiscard: (id: string) => void;
}

interface DecoratedRow {
  row: ChatMessageRow;
  showDayDivider: boolean;
  dividerLabel: string;
  timeLabel: string;
}

/** 같은 분(minute) 안에 이어지는 메시지는 마지막 것에만 시각을 붙인다. */
function minuteOf(d: Date): number {
  return Math.floor(d.getTime() / 60_000);
}

/**
 * 행마다 필요한 표시값을 한 번에 계산한다. 렌더 중에 이웃 행의 `createdAt`까지 파싱하면
 * 같은 문자열을 행당 3번 파싱하게 되고, 이 목록은 수신·타이핑·상태 변화마다 다시 그려진다.
 */
function decorate(messages: ChatMessageRow[]): DecoratedRow[] {
  const dates = messages.map((m) => parseDateSafe(m?.createdAt ?? ''));
  return messages.map((row, i) => {
    const created = dates[i];
    const prev = i > 0 ? dates[i - 1] : null;
    const next = i + 1 < dates.length ? dates[i + 1] : null;
    const showDayDivider =
      created != null && (prev == null || dayKey(created) !== dayKey(prev));
    const showTime =
      created != null && (next == null || minuteOf(created) !== minuteOf(next));
    return {
      row,
      showDayDivider,
      dividerLabel: showDayDivider && created ? formatDayDivider(created) : '',
      timeLabel: showTime && created ? formatChatTime12h(created) : '',
    };
  });
}

function ChatMessageListImpl({
  messages,
  myId,
  peerProfileImageUrl,
  loadingInitial,
  loadError,
  topSentinel,
  onRetry,
  onDiscard,
}: ChatMessageListProps) {
  const decorated = useMemo(() => decorate(messages), [messages]);
  // 루프 불변값 — 메시지마다 다시 계산할 이유가 없다.
  const avatarSrc = useMemo(
    () => safeImageUrl(peerProfileImageUrl, DEFAULT_PROFILE_IMAGE) || DEFAULT_PROFILE_IMAGE,
    [peerProfileImageUrl],
  );

  return (
    <>
      {topSentinel}

      {loadError && (
        <p className="py-6 text-center text-sm text-red-600" role="alert">
          대화를 불러오지 못했습니다. {loadError}
        </p>
      )}

      {!loadingInitial && messages.length === 0 && !loadError && (
        <p className="py-6 text-center text-sm text-gray-400">아직 메시지가 없습니다.</p>
      )}

      <ul className="m-0 list-none flex flex-col gap-2 pb-2 p-0">
        {decorated.map(({ row: m, showDayDivider, dividerLabel, timeLabel }, i) => {
          const isMine = Boolean(myId && m?.senderId != null && String(m.senderId) === myId);
          const timeEl = timeLabel ? (
            <time
              className="shrink-0 text-[11px] leading-none tabular-nums text-gray-400"
              dateTime={m?.createdAt ?? ''}
            >
              {timeLabel}
            </time>
          ) : null;

          return (
            <li key={m?.id != null && String(m.id) !== '' ? String(m.id) : `msg-${i}`}>
              {showDayDivider && (
                <div className="my-2 flex w-full items-center justify-center">
                  <span className="rounded-full bg-[rgba(15,23,42,0.06)] px-3 py-1 text-[12px] font-semibold text-[rgba(15,23,42,0.55)]">
                    {dividerLabel}
                  </span>
                </div>
              )}

              <div
                className={`flex w-full min-w-0 items-end gap-[2px] ${isMine ? 'justify-end' : 'justify-start'}`}
              >
                {!isMine && (
                  <div className="mr-[2px] h-8 w-8 shrink-0 overflow-hidden rounded-full bg-[#e5e7eb]">
                    <img
                      src={avatarSrc}
                      alt=""
                      className="h-full w-full object-cover"
                      loading="lazy"
                      decoding="async"
                      referrerPolicy="no-referrer"
                    />
                  </div>
                )}

                {/* 내 메시지는 말풍선 왼쪽, 상대 메시지는 오른쪽에 시각 */}
                {isMine && timeEl}
                <ChatMessageBubble
                  message={m}
                  isMine={isMine}
                  onRetry={() => onRetry(m)}
                  onDiscard={() => onDiscard(m.id)}
                />
                {!isMine && timeEl}
              </div>
            </li>
          );
        })}
      </ul>
    </>
  );
}

// 초안(draft) 상태가 채팅방 훅에 있어 타이핑 한 글자마다 화면 전체가 다시 그려진다 —
// 목록은 props가 그대로면 건너뛴다.
export const ChatMessageList = memo(ChatMessageListImpl);
