// 404 페이지: 존재하지 않는 경로 접근 시 표시.
import { Link } from 'react-router-dom';

export function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center text-center p-5">
      <h1 className="m-0 text-[48px] font-bold leading-[48px] text-black">404</h1>
      <p className="my-3 text-[16px] font-normal leading-[16px] text-black">페이지를 찾을 수 없습니다</p>
      <Link
        to="/"
        className="mt-5 inline-flex h-[33px] w-full max-w-[360px] self-center items-center justify-center rounded-[4px] border-0 bg-[var(--primary)] px-5 text-[13px] font-bold leading-[13px] text-white no-underline transition-all duration-200 hover:bg-[var(--primary-hover)] active:bg-[var(--primary-hover)]"
      >
        홈으로 돌아가기
      </Link>
    </div>
  );
}
