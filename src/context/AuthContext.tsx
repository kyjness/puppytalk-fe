// 인증 Context: 로그인 유저 상태·localStorage 복원·setUser/clearUser 제공.

import {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
  type ReactNode,
} from 'react';

import { useChatUiStore } from '../store/useChatUiStore';

const STORAGE_KEY = 'user';

export interface AuthUser {
  userId?: string;
  id?: string;
  nickname?: string;
  email?: string;
  role?: string;
  profileImageUrl?: string | null;
  accessToken?: string;
  dogs?: unknown[];
  [key: string]: unknown;
}

export interface AuthContextValue {
  user: AuthUser | null;
  isLoggedIn: boolean;
  isRestored: boolean;
  setUser: (userData: AuthUser | null) => void;
  clearUser: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUserState] = useState<AuthUser | null>(null);
  const [isRestored, setIsRestored] = useState(false);

  const setUser = useCallback((userData: AuthUser | null) => {
    setUserState(userData);
    if (userData) {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(userData));
      } catch (_) {}
    } else {
      try {
        localStorage.removeItem(STORAGE_KEY);
      } catch (_) {}
    }
  }, []);

  const clearUser = useCallback(() => {
    setUserState(null);
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch (_) {}
    try {
      useChatUiStore.getState().closeFloatingRoom();
      useChatUiStore.getState().closeChatInbox();
    } catch (_) {}
  }, []);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const data = JSON.parse(raw) as AuthUser;
        setUserState(data);
      }
    } catch (_) {
      setUserState(null);
    }
    setIsRestored(true);
  }, []);

  const value: AuthContextValue = {
    user,
    isLoggedIn: !!user,
    isRestored,
    setUser,
    clearUser,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
