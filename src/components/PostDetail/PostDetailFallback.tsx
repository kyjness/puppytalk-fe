// 게시글 상세 초기 상태: invalid/loading/error.
import { Header } from '../Header.jsx';

interface PostDetailFallbackProps {
  variant: 'invalid' | 'loading' | 'error';
  error?: string;
  onBack?: () => void;
}

export function PostDetailFallback({ variant, error, onBack }: PostDetailFallbackProps) {
  const content = {
    invalid: <p className="text-center text-[16px] text-black">유효하지 않은 게시글입니다.</p>,
    loading: (
      <div className="app-skeleton-screen" aria-label="로딩" />
    ),
    error: (
      <>
        <p className="text-center text-[16px] text-black">게시글을 불러올 수 없습니다.</p>
        <p style={{ color: '#777', fontSize: 12 }}>{error}</p>
        <button
          type="button"
          className="mt-5 inline-flex h-[33px] w-full max-w-[360px] self-center items-center justify-center rounded-[4px] border-0 bg-[var(--primary)] px-5 text-[13px] font-bold leading-[13px] text-white no-underline transition-all duration-200 hover:bg-[var(--primary-hover)] active:bg-[var(--primary-hover)]"
          onClick={onBack}
        >
          목록으로 돌아가기
        </button>
      </>
    ),
  }[variant];

  return (
    <Header showBackButton backHref="/posts">
      <main className="flex min-h-[50vh] flex-1 items-center justify-center bg-[var(--app-bg)] px-[16px] pt-[8px]">
        <div className="flex flex-col items-center pt-8 text-center w-full max-w-[min(620px,92vw)]">
          {content}
        </div>
      </main>
    </Header>
  );
}
