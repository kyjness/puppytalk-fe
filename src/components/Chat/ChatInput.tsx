// 채팅 입력: Enter 전송, Shift+Enter 줄바꿈, 자동 높이 조절.
import { useCallback, useEffect, useRef, type KeyboardEvent } from 'react';

import type { ChatSocketStatus } from '../../hooks/useChatSocket.js';

/** 입력이 왜 막혔는지 자리표시자로 알린다 — 비활성 입력창은 이유가 보여야 한다. */
export function chatInputPlaceholder(
  peerUserId: string,
  status: ChatSocketStatus,
  noPeerText: string,
): string {
  if (!peerUserId) return noPeerText;
  if (status === 'connecting') return '연결 중…';
  if (status !== 'open') return '연결이 끊겨 지금은 보낼 수 없어요 — 재연결 중…';
  return '메시지를 입력하세요…';
}

export interface ChatInputProps {
  value: string;
  onChange: (value: string) => void;
  onSend: () => void;
  disabled?: boolean;
  placeholder?: string;
}

const MAX_TEXTAREA_PX = 200;

function autoResize(el: HTMLTextAreaElement | null) {
  if (!el) return;
  el.style.height = 'auto';
  const next = Math.min(el.scrollHeight, MAX_TEXTAREA_PX);
  el.style.height = `${next}px`;
  el.style.overflowY = el.scrollHeight > MAX_TEXTAREA_PX ? 'auto' : 'hidden';
}

export function ChatInput({
  value,
  onChange,
  onSend,
  disabled = false,
  placeholder = '메시지를 입력하세요…',
}: ChatInputProps) {
  const taRef = useRef<HTMLTextAreaElement | null>(null);

  useEffect(() => {
    autoResize(taRef.current);
  }, [value]);

  const sendDisabled = disabled || !value.trim();

  const handleKeyDown = useCallback(
    (e: KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        if (!disabled && value.trim()) {
          onSend();
        }
      }
    },
    [disabled, onSend, value],
  );

  return (
    <div className="flex w-full min-w-0 items-end gap-2 border-t border-[#e5e7eb] bg-white p-3 pb-[max(12px,env(safe-area-inset-bottom))]">
      <textarea
        ref={taRef}
        rows={1}
        value={value}
        disabled={disabled}
        placeholder={placeholder}
        className="min-h-[44px] max-h-[200px] w-full min-w-0 cursor-text resize-none rounded-xl border border-[#e5e7eb] bg-[#f9fafb] px-3 py-2.5 text-[15px] leading-snug text-[#111827] outline-none ring-0 transition-[box-shadow] placeholder:text-gray-400 focus:border-[#93c5fd] focus:bg-white focus:shadow-[0_0_0_3px_rgba(37,99,235,0.15)] disabled:cursor-not-allowed disabled:opacity-50"
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={handleKeyDown}
      />
      <button
        type="button"
        disabled={sendDisabled}
        style={{ cursor: sendDisabled ? 'not-allowed' : 'pointer' }}
        className="shrink-0 rounded-xl bg-[#2563eb] px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition enabled:hover:bg-[#1d4ed8] disabled:bg-gray-300"
        onClick={() => {
          if (value.trim()) onSend();
        }}
      >
        전송
      </button>
    </div>
  );
}
