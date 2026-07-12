import { useMemo } from 'react';
import { keepPreviousData, useQuery } from '@tanstack/react-query';

import { api } from '../api/client.js';

export interface RecentChatRoom {
  roomId: string;
  peerUserId: string;
  peerProfileImageUrl: string;
  peerDogProfileImageUrl: string;
  peerDogName: string;
  peerDogBreed: string;
  peerDogGender: string;
  peerDogBirthDate: string;
  title: string;
  lastMessagePreview: string;
  unreadCount: number;
  updatedAt: string;
}

function normalizeRoom(raw: Record<string, unknown>): RecentChatRoom | null {
  const roomId = String(raw.roomId ?? raw.roomid ?? raw.room_id ?? '').trim();
  const peerUserId = String(raw.peerUserId ?? raw.peer_user_id ?? raw.peer ?? '').trim();
  if (!roomId || !peerUserId) return null;

  const peerProfileImageUrl = String(raw.peerProfileImageUrl ?? raw.peer_profile_image_url ?? '').trim();
  const peerDogProfileImageUrl = String(
    raw.peerDogProfileImageUrl ?? raw.peer_dog_profile_image_url ?? '',
  ).trim();
  const peerDogName = String(raw.peerDogName ?? raw.peer_dog_name ?? '').trim();
  const peerDogBreed = String(raw.peerDogBreed ?? raw.peer_dog_breed ?? '').trim();
  const peerDogGender = String(raw.peerDogGender ?? raw.peer_dog_gender ?? '').trim();
  const peerDogBirthDate = String(raw.peerDogBirthDate ?? raw.peer_dog_birth_date ?? '').trim();
  const title =
    String(raw.title ?? raw.peerNickname ?? raw.peer_nickname ?? raw.peerName ?? '채팅').trim() || '채팅';
  const lastMessagePreview =
    String(raw.lastMessagePreview ?? raw.last_message_preview ?? raw.lastMessage ?? raw.last_message ?? '')
      .replace(/\s+/g, ' ')
      .trim();
  const unreadRaw = raw.unreadCount ?? raw.unread_count ?? raw.unread ?? 0;
  const unreadCount = Number.isFinite(Number(unreadRaw)) ? Math.max(0, Number(unreadRaw)) : 0;
  const updatedAt = String(raw.updatedAt ?? raw.updated_at ?? raw.lastMessageAt ?? raw.last_message_at ?? '');

  return {
    roomId,
    peerUserId,
    peerProfileImageUrl,
    peerDogProfileImageUrl,
    peerDogName,
    peerDogBreed,
    peerDogGender,
    peerDogBirthDate,
    title,
    lastMessagePreview,
    unreadCount,
    updatedAt,
  };
}

async function fetchRecentRooms(limit: number): Promise<RecentChatRoom[]> {
  // 백엔드 스펙: (현재 README 기준) /v1/chat/*, 목록 엔드포인트는 구현 상황에 따라 달라질 수 있어
  // 404/스키마 불일치에도 UI가 깨지지 않도록 보수적으로 파싱합니다.
  const safeLimit = Number.isFinite(limit) ? Math.max(1, Math.min(50, Math.floor(limit))) : 20;
  try {
    const body = await api.get<{ data?: unknown }>(
      `/chat/rooms?limit=${encodeURIComponent(String(safeLimit))}`
    );
    const data: unknown = body?.data ?? body;
    const dataObj = data && typeof data === 'object' ? (data as { items?: unknown }) : null;
    const items = Array.isArray(dataObj?.items)
      ? dataObj.items
      : Array.isArray(data)
        ? data
        : [];
    const out: RecentChatRoom[] = [];
    for (const x of items) {
      if (!x || typeof x !== 'object') continue;
      const room = normalizeRoom(x as Record<string, unknown>);
      if (room) out.push(room);
    }
    return out;
  } catch (err: unknown) {
    // 목록 API가 아직 없거나(404), 프론트 선행 배포 상황에서도 UI는 정상 동작해야 함
    const status = (err as { status?: unknown } | null)?.status;
    if (status === 404) return [];
    throw err;
  }
}

export function useRecentChatRooms(enabled: boolean, limit = 20) {
  const safeLimit = Number.isFinite(limit) ? Math.max(1, Math.min(50, Math.floor(limit))) : 20;
  const query = useQuery({
    queryKey: ['chat', 'recent-rooms', safeLimit],
    queryFn: () => fetchRecentRooms(safeLimit),
    enabled,
    placeholderData: keepPreviousData,
    staleTime: 15_000,
    gcTime: 10 * 60_000,
    refetchOnWindowFocus: false,
  });

  const unreadTotal = useMemo(() => {
    const list = query.data ?? [];
    return list.reduce((sum, r) => sum + (Number.isFinite(r.unreadCount) ? r.unreadCount : 0), 0);
  }, [query.data]);

  return { ...query, unreadTotal };
}

