/**
 * 테스트 공용 설정.
 *
 * globals:false로 두면(전역 오염을 피하려는 선택) @testing-library의 자동 cleanup이
 * 등록되지 않는다 — 렌더가 누적돼 findByRole이 "여러 개 찾음"으로 실패한다. 직접 건다.
 */
import { cleanup } from '@testing-library/react';
import { afterEach } from 'vitest';

afterEach(() => {
  cleanup();
});
