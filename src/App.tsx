// 최상위 뷰: 스플래시 여부에 따라 SplashScreen 또는 BrowserRouter+AuthProvider+Router 렌더.

import { useState } from 'react';
import { BrowserRouter } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext.jsx';
import Router from './Router.jsx';
import { SplashScreen } from './components/SplashScreen.jsx';
// DM WebSocket 1회 유지: <AuthProvider> 안에서 로그인 상태일 때만 연결되도록 배치
import { ChatSocketProvider } from './components/Chat/ChatSocketProvider';
import { FloatingChatWindow } from './components/Chat/FloatingChatWindow';

const SPLASH_SHOWN_KEY = 'splashShown';

function getInitialSplashDone() {
  try {
    if (typeof sessionStorage !== 'undefined' && sessionStorage.getItem(SPLASH_SHOWN_KEY) === '1')
      return true;
    if (typeof window !== 'undefined' && window.location.search.includes('from=admin'))
      return true;
    return false;
  } catch (_) {
    return false;
  }
}

export default function App() {
  const [isSplashDone, setIsSplashDone] = useState(getInitialSplashDone);

  if (!isSplashDone) {
    return <SplashScreen onDone={() => setIsSplashDone(true)} />;
  }

  return (
    <BrowserRouter>
      <AuthProvider>
        <ChatSocketProvider>
          <FloatingChatWindow />
          <Router />
        </ChatSocketProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}
