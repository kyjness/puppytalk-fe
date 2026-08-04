/**
 * 테스트 공용 조각 — api 목 리셋 규약과 프로바이더 래퍼.
 *
 * 목 **선언**은 각 파일에 남긴다. `vi.mock` 팩토리는 파일 최상단으로 호이스팅되므로 거기서
 * 참조할 값은 같은 파일의 `vi.hoisted`로 만들어야 한다 — 다른 모듈의 함수로 감싸면 그
 * 경계를 넘지 못한다. 대신 파일마다 갈리던 **리셋 관례**(mockReset vs mockClear)와
 * 프로바이더 래퍼를 여기로 모은다.
 *
 * 각 테스트 파일의 2줄 규약:
 *   const api = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn(), patch: vi.fn(), delete: vi.fn() }));
 *   vi.mock('../api/client.js', () => ({ api }));
 */
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { MemoryRouter } from 'react-router-dom';
import type { Mock } from 'vitest';

export interface ApiMock {
  get: Mock;
  post: Mock;
  patch: Mock;
  delete: Mock;
}

/** 백엔드 표준 응답 봉투. */
export const ok = (data: unknown = null) => ({ code: 'OK', data });

/**
 * 전 메서드를 초기화하고 성공 봉투를 기본 응답으로 둔다.
 * 리셋을 통일해야 앞 테스트의 mockResolvedValueOnce가 다음 테스트로 새지 않는다.
 */
export function resetApiMock(api: ApiMock, data: unknown = null): void {
  for (const fn of [api.get, api.post, api.patch, api.delete]) {
    fn.mockReset().mockResolvedValue(ok(data));
  }
}

/** react-query·라우터가 필요한 훅/컴포넌트용 래퍼. 호출마다 새 QueryClient(테스트 간 격리). */
export function createWrapper({ router = true }: { router?: boolean } = {}) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return function Wrapper({ children }: { children: ReactNode }) {
    const tree = <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
    return router ? <MemoryRouter>{tree}</MemoryRouter> : tree;
  };
}
