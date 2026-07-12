// 라우터: Routes 정의 및 401 시 로그인 리다이렉트 핸들러 등록.

import { useEffect, type ReactNode } from 'react';
import { Routes, Route, useNavigate } from 'react-router-dom';
import { setUnauthorizedHandler } from './api/client.js';
import { useAuth } from './context/AuthContext.jsx';
import { ProtectedRoute } from './components/ProtectedRoute.jsx';
import { PostList } from './pages/PostList.jsx';
import { Login } from './pages/Login.jsx';
import { Signup } from './pages/Signup.jsx';
import { PostDetail } from './pages/PostDetail.jsx';
import { NewPost } from './pages/NewPost.jsx';
import { EditPost } from './pages/EditPost.jsx';
import { MyPage } from './pages/MyPage.jsx';
import { AdminDashboard } from './pages/AdminDashboard.jsx';
import { NotFound } from './pages/NotFound.jsx';
import { NotificationStreamHost } from './components/Notification/NotificationStreamHost.jsx';
import { ChatRoomErrorBoundary } from './components/Chat/ChatRoomErrorBoundary';
import { ChatRoom } from './pages/ChatRoom';

/** API 401 시 로그인으로 보내는 핸들러 (라우터 하위에서 한 번만 등록) */
function ApiUnauthorizedSetup({ children }: { children: ReactNode }) {
  const navigate = useNavigate();
  const { clearUser } = useAuth();
  useEffect(() => {
    setUnauthorizedHandler(() => {
      try {
        const path =
          typeof window !== 'undefined' ? window.location.pathname : '';
        if (path && path !== '/login' && path !== '/signup') {
          sessionStorage.setItem('login_return_path', path);
        }
      } catch (_) {}
      clearUser();
      navigate('/login', { replace: true });
    });
    return () => setUnauthorizedHandler(null);
  }, [navigate, clearUser]);
  return children;
}

export default function Router() {
  return (
    <ApiUnauthorizedSetup>
      <NotificationStreamHost />
      <Routes>
        <Route path="/" element={<PostList />} />
        <Route path="/posts" element={<PostList />} />
        <Route path="/login" element={<Login />} />
        <Route path="/signup" element={<Signup />} />
        <Route path="/posts/new" element={<ProtectedRoute><NewPost /></ProtectedRoute>} />
        <Route path="/posts/:id" element={<PostDetail />} />
        <Route path="/posts/:id/edit" element={<ProtectedRoute><EditPost /></ProtectedRoute>} />
        <Route path="/mypage" element={<ProtectedRoute><MyPage /></ProtectedRoute>} />
        <Route
          path="/chat/:roomId"
          element={
            <ProtectedRoute>
              <ChatRoomErrorBoundary>
                <ChatRoom />
              </ChatRoomErrorBoundary>
            </ProtectedRoute>
          }
        />
        <Route path="/admin/dashboard" element={<ProtectedRoute><AdminDashboard /></ProtectedRoute>} />
        <Route path="*" element={<NotFound />} />
      </Routes>
    </ApiUnauthorizedSetup>
  );
}
