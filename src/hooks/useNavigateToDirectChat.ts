// 상대 공개 ID로 1:1 방 조회·생성 후 플로팅 채팅창 오픈.
import { useCallback, useState } from 'react';

import { api } from '../api/client.js';
import { ApiError } from '../api/errors.js';
import { getApiErrorMessage, getClientErrorCode } from '../utils/index.js';
import { useChatUiStore } from '../store/useChatUiStore';

export function useNavigateToDirectChat() {
  const [busy, setBusy] = useState(false);
  const openFloatingRoom = useChatUiStore((s) => s.openFloatingRoom);

  const go = useCallback(
    async (
      peerUserId: string | null | undefined,
      title?: string | null,
      peerProfileImageUrl?: string | null
    ): Promise<boolean> => {
      const peer = peerUserId != null ? String(peerUserId).trim() : '';
      if (!peer) return false;
      setBusy(true);
      try {
        // 방이 없으면 생성하는(상태 변경) 호출이라 BE 계약이 POST.
        const body = await api.post<{
          data?: { roomId?: string; roomid?: string; room_id?: string };
        }>(`/chat/rooms/direct/${encodeURIComponent(peer)}`, {});
        const inner = body?.data;
        const raw = inner?.roomId ?? inner?.roomid ?? inner?.room_id;
        const roomIdStr = raw != null && String(raw).trim() ? String(raw).trim() : '';
        const invalid =
          !roomIdStr ||
          roomIdStr === 'None' ||
          roomIdStr === 'null' ||
          roomIdStr === 'undefined';
        if (invalid) {
          window.alert('채팅방 정보를 받지 못했습니다. (서버 응답 오류)');
          return false;
        }
        // openFloatingRoom이 헤더 DM 목록도 함께 닫음
        openFloatingRoom({
          roomId: roomIdStr,
          peerUserId: peer,
          title: (title != null && String(title).trim()) || '채팅',
          peerProfileImageUrl:
            peerProfileImageUrl != null && String(peerProfileImageUrl).trim()
              ? String(peerProfileImageUrl).trim()
              : undefined,
        });
        return true;
      } catch (err) {
        // 차단 관계 direct-open 403: 누가 차단했는지 노출하지 않는 중립 문구(서버 메시지 우선).
        if (err instanceof ApiError && err.status === 403) {
          const neutral =
            err.message && err.message !== err.code
              ? err.message
              : '메시지를 보낼 수 없는 상대입니다.';
          window.alert(neutral);
          return false;
        }
        window.alert(getApiErrorMessage(getClientErrorCode(err), '채팅방을 열 수 없습니다.'));
        return false;
      } finally {
        setBusy(false);
      }
    },
    [openFloatingRoom]
  );

  return { go, busy };
}
