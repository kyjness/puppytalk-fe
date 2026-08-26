// DM 말풍선: 내 메시지 오른쪽(파란), 상대 왼쪽(회색). 모바일 퍼스트 max-width.
import type { ChatMessageRow } from '../../api/api-types.js';

export interface ChatMessageBubbleProps {
  message: ChatMessageRow;
  isMine: boolean;
  /** 전달 실패한 내 메시지에만 붙는다. */
  onRetry?: () => void;
  onDiscard?: () => void;
}

export function ChatMessageBubble({ message, isMine, onRetry, onDiscard }: ChatMessageBubbleProps) {
  const pending = message?.deliveryStatus === 'pending';
  const failed = message?.deliveryStatus === 'failed';

  const bubble = (
    <div
      className={`max-w-[min(100%,18rem)] sm:max-w-sm break-words rounded-2xl px-2.5 py-1.5 text-[14px] leading-snug shadow-sm ${
        isMine
          ? 'rounded-br-md border border-transparent bg-[#2563eb] text-white'
          : 'rounded-bl-md border border-[#e5e7eb] bg-[#f3f4f6] text-[#111827]'
      } ${pending ? 'opacity-60' : ''} ${failed ? 'opacity-50 ring-1 ring-red-400' : ''}`}
      data-message-id={message?.id ?? ''}
      data-delivery-status={message?.deliveryStatus ?? ''}
    >
      <p className="whitespace-pre-wrap">{message?.content ?? ''}</p>
    </div>
  );

  if (!failed) return bubble;

  return (
    <div className="flex flex-col items-end gap-0.5">
      {bubble}
      <p className="text-[11px] text-red-600" role="alert">
        전송되지 않았습니다.{' '}
        <button
          type="button"
          className="cursor-pointer border-0 bg-transparent p-0 font-semibold underline"
          onClick={onRetry}
        >
          다시 보내기
        </button>
        {' · '}
        <button
          type="button"
          className="cursor-pointer border-0 bg-transparent p-0 underline"
          onClick={onDiscard}
        >
          지우기
        </button>
      </p>
    </div>
  );
}
