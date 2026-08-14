// DM 메시지 목록 렌더링 — 날짜 구분선·시각·아바타·말풍선 배치.
// 전체화면 채팅방(ChatRoom)과 플로팅 채팅창(FloatingChatWindow)이 공유한다.
// 스크롤 컨테이너는 각 화면이 소유한다 — 여기는 "무엇을 그리는가"만 책임진다.
import type { ReactNode } from 'react';

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
}

export function ChatMessageList({
  messages,
  myId,
  peerProfileImageUrl,
  loadingInitial,
  loadError,
  topSentinel,
}: ChatMessageListProps) {
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
        {messages.map((m, i) => {
          const created = parseDateSafe(m?.createdAt ?? '');
          const prevCreated = i > 0 ? parseDateSafe(messages[i - 1]?.createdAt ?? '') : null;
          const nextCreated =
            i + 1 < messages.length ? parseDateSafe(messages[i + 1]?.createdAt ?? '') : null;

          const showDayDivider =
            created != null && (prevCreated == null || dayKey(created) !== dayKey(prevCreated));

          // 같은 분(minute)에 이어지는 메시지는 마지막 것에만 시각을 붙인다.
          const showTime =
            created != null &&
            (nextCreated == null ||
              Math.floor(created.getTime() / 60_000) !== Math.floor(nextCreated.getTime() / 60_000));

          const isMine = Boolean(myId && m?.senderId != null && String(m.senderId) === myId);

          const timeEl =
            showTime && created ? (
              <time
                className="shrink-0 text-[11px] leading-none tabular-nums text-gray-400"
                dateTime={m?.createdAt ?? ''}
              >
                {formatChatTime12h(created)}
              </time>
            ) : null;

          return (
            <li key={m?.id != null && String(m.id) !== '' ? String(m.id) : `msg-${i}`}>
              {showDayDivider && created && (
                <div className="my-2 flex w-full items-center justify-center">
                  <span className="rounded-full bg-[rgba(15,23,42,0.06)] px-3 py-1 text-[12px] font-semibold text-[rgba(15,23,42,0.55)]">
                    {formatDayDivider(created)}
                  </span>
                </div>
              )}

              <div
                className={`flex w-full min-w-0 items-end gap-[2px] ${isMine ? 'justify-end' : 'justify-start'}`}
              >
                {!isMine && (
                  <div className="mr-[2px] h-8 w-8 shrink-0 overflow-hidden rounded-full bg-[#e5e7eb]">
                    <img
                      src={
                        safeImageUrl(peerProfileImageUrl, DEFAULT_PROFILE_IMAGE) ||
                        DEFAULT_PROFILE_IMAGE
                      }
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
                <ChatMessageBubble message={m} isMine={isMine} />
                {!isMine && timeEl}
              </div>
            </li>
          );
        })}
      </ul>
    </>
  );
}
