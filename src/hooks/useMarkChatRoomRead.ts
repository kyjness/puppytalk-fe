import { useQueryClient } from '@tanstack/react-query';
import { useCallback } from 'react';

import { apiPost } from '../api/typed.js';

export function useMarkChatRoomRead() {
  const queryClient = useQueryClient();
  return useCallback(
    async (roomId: string) => {
      const rid = roomId.trim();
      if (!rid) return;
      try {
        await apiPost('/v1/chat/rooms/{room_id}/read', { path: { room_id: rid } });
        await queryClient.invalidateQueries({ queryKey: ['chat', 'recent-rooms'] });
      } catch (e) {
        console.warn('[markChatRoomRead]', e);
      }
    },
    [queryClient],
  );
}
