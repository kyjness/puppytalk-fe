// 채팅 목록의 "하단 고정" 정책 — 사용자가 바닥 근처를 보고 있을 때만 새 메시지를 따라간다.
// 전체화면·플로팅 두 화면이 같은 규칙을 쓴다. 과거 페이지 로드 후의 위치 복원은 전체화면
// 전용이라 여기 넣지 않는다(그쪽은 정책이 진짜로 다르다).
import { useCallback, useLayoutEffect, useRef, type RefObject } from 'react';

/** 바닥에서 이 픽셀 안쪽이면 "따라가는 중"으로 본다. */
const STICK_BOTTOM_PX = 96;

export interface StickToBottom {
  /** 스크롤 컨테이너의 onScroll에 그대로 연결한다. */
  onScroll: () => void;
  /** 전송 직후처럼 무조건 바닥으로 보내야 할 때. */
  scrollToBottom: () => void;
  /** 위치 복원을 직접 하는 화면이 이번 커밋의 자동 스크롤을 건너뛰게 한다. */
  skipNextAutoScrollRef: RefObject<boolean>;
}

export function useStickToBottom(
  scrollRef: RefObject<HTMLDivElement | null>,
  messageCount: number,
  roomId: string,
): StickToBottom {
  const stickBottomRef = useRef(true);
  const prevCountRef = useRef(0);
  const skipNextAutoScrollRef = useRef(false);

  // 방이 바뀌면 초기화한다. effect가 아니라 렌더 중에 처리한다 — 아래 useLayoutEffect가
  // 같은 커밋에서 먼저 돌기 때문에, effect로 미루면 새 방의 첫 스크롤 계산이 이전 방 값을 본다.
  const prevRoomIdRef = useRef(roomId);
  if (prevRoomIdRef.current !== roomId) {
    prevRoomIdRef.current = roomId;
    prevCountRef.current = 0;
    stickBottomRef.current = true;
  }

  const onScroll = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    stickBottomRef.current = el.scrollHeight - el.scrollTop - el.clientHeight < STICK_BOTTOM_PX;
  }, [scrollRef]);

  const scrollToBottom = useCallback(() => {
    stickBottomRef.current = true;
    requestAnimationFrame(() => {
      const el = scrollRef.current;
      if (el) el.scrollTop = el.scrollHeight;
    });
  }, [scrollRef]);

  useLayoutEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    if (skipNextAutoScrollRef.current) return;
    if (messageCount === 0) {
      prevCountRef.current = 0;
      return;
    }
    const prevCount = prevCountRef.current;
    prevCountRef.current = messageCount;
    // 첫 페이지는 무조건 바닥에서 시작하고, 이후엔 따라가는 중일 때만 붙는다.
    if (prevCount === 0 || (messageCount > prevCount && stickBottomRef.current)) {
      el.scrollTop = el.scrollHeight;
    }
  }, [messageCount, roomId, scrollRef]);

  return { onScroll, scrollToBottom, skipNextAutoScrollRef };
}
