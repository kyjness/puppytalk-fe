// 인증 필요 라우트 래퍼: 비로그인 시 /login으로 리다이렉트.
import type { ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';

export function ProtectedRoute({ children }: { children: ReactNode }) {
  const { isLoggedIn, isRestored } = useAuth();
  const location = useLocation();

  if (!isRestored) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '60vh' }}>
        <div className="app-skeleton-screen" aria-label="로딩" />
      </div>
    );
  }

  if (!isLoggedIn) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  return children;
}
