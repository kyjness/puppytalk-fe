// 채팅 헤더 아래 한 줄 안내. 소켓 상태와 마지막 오류를 사용자 언어로 옮긴다.
// 예전에는 `status !== 'open'`만 보고 "연결 끊김"을 띄워서, 레이트리밋처럼 사유가 분명한
// 경우에도 무엇이 잘못됐는지 알 수 없었다(lastError는 어디에도 렌더링되지 않았다).
import type { ChatSocketError, ChatSocketStatus } from '../../hooks/useChatSocket.js';

export interface ChatConnectionNoticeProps {
  status: ChatSocketStatus;
  lastError: ChatSocketError | null;
}

const DISCONNECTED = '실시간 연결 끊김 — 메시지 수신이 지연될 수 있어요.';

function noticeFor(status: ChatSocketStatus, lastError: ChatSocketError | null): string | null {
  switch (lastError?.kind) {
    case 'connection_limit':
      return '다른 탭이나 기기에서 이미 접속 중이라 이 창은 실시간 수신이 꺼졌습니다. 새로고침하면 다시 시도합니다.';
    case 'rate_limited':
      return '메시지를 너무 빠르게 보냈습니다. 잠시 후 자동으로 다시 연결됩니다.';
    case 'server':
      // 서버가 거절한 경우(전송 한도·상대 없음 등). message는 서버가 쓴 사용자용 한국어다.
      return lastError.message ?? DISCONNECTED;
    default:
      // auth는 곧 로그아웃으로 이어지고, transport는 재연결 중이라 상태 문구로 충분하다.
      return status !== 'open' && status !== 'connecting' ? DISCONNECTED : null;
  }
}

export function ChatConnectionNotice({ status, lastError }: ChatConnectionNoticeProps) {
  const notice = noticeFor(status, lastError);
  if (!notice) return null;
  return (
    <p className="mt-0.5 text-xs text-amber-700" role="status">
      {notice}
    </p>
  );
}
