import { useQuery } from '@tanstack/react-query';

import { api } from '../api/client.js';

export interface ChatRoomPeerInfo {
  roomId: string;
  peerUserId: string;
  peerNickname: string;
  peerProfileImageUrl: string;
  peerDogName: string;
  peerDogProfileImageUrl: string;
  peerDogBreed: string;
  peerDogGender: string;
  peerDogBirthDate: string;
}

function normalize(raw: Record<string, unknown>): ChatRoomPeerInfo | null {
  const roomId = String(raw.roomId ?? raw.room_id ?? raw.roomid ?? '').trim();
  const peerUserId = String(raw.peerUserId ?? raw.peer_user_id ?? raw.peer ?? '').trim();
  if (!roomId || !peerUserId) return null;
  const peerNickname = String(raw.peerNickname ?? raw.peer_nickname ?? '').trim();
  const peerProfileImageUrl = String(raw.peerProfileImageUrl ?? raw.peer_profile_image_url ?? '').trim();
  const peerDogName = String(raw.peerDogName ?? raw.peer_dog_name ?? '').trim();
  const peerDogProfileImageUrl = String(
    raw.peerDogProfileImageUrl ?? raw.peer_dog_profile_image_url ?? '',
  ).trim();
  const peerDogBreed = String(raw.peerDogBreed ?? raw.peer_dog_breed ?? '').trim();
  const peerDogGender = String(raw.peerDogGender ?? raw.peer_dog_gender ?? '').trim();
  const peerDogBirthDate = String(raw.peerDogBirthDate ?? raw.peer_dog_birth_date ?? '').trim();
  return {
    roomId,
    peerUserId,
    peerNickname,
    peerProfileImageUrl,
    peerDogName,
    peerDogProfileImageUrl,
    peerDogBreed,
    peerDogGender,
    peerDogBirthDate,
  };
}

async function fetchPeerInfo(roomId: string): Promise<ChatRoomPeerInfo | null> {
  const body = await api.get<{ data?: unknown }>(`/chat/rooms/${encodeURIComponent(roomId)}`);
  const data = body?.data ?? body;
  if (!data || typeof data !== 'object') return null;
  return normalize(data as Record<string, unknown>);
}

export function useChatRoomPeerInfo(enabled: boolean, roomId: string) {
  const rid = roomId?.trim() ?? '';
  return useQuery({
    queryKey: ['chat', 'room-peer', rid],
    enabled: enabled && Boolean(rid),
    queryFn: () => fetchPeerInfo(rid),
    staleTime: 60_000,
    gcTime: 10 * 60_000,
    refetchOnWindowFocus: false,
    retry: 1,
  });
}

