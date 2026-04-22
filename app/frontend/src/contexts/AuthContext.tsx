import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  ReactNode,
} from 'react';
import { client } from '../lib/api';

interface User {
  id: string;
  email: string;
  name?: string;
  avatar?: string;
}

interface AuthContextType {
  user: User | null;
  loading: boolean;
  login: () => void;
  logout: () => Promise<void>;
  refetch: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
};

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  const checkAuth = useCallback(async () => {
    try {
      const res = await client.auth.me();
      if (res?.data) {
        setUser({
          id: res.data.id || res.data.sub || '',
          email: res.data.email || '',
          name: res.data.name || res.data.nickname || res.data.email?.split('@')[0] || '',
          avatar: res.data.avatar || res.data.picture || '',
        });
      } else {
        setUser(null);
      }
    } catch {
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  const login = useCallback(() => {
    client.auth.toLogin();
  }, []);

  const logout = useCallback(async () => {
    try {
      await client.auth.logout();
    } catch {
      // fallback
    }
    setUser(null);
    window.location.href = '/';
  }, []);

  useEffect(() => {
    checkAuth();
  }, [checkAuth]);

  return (
    <AuthContext.Provider value={{ user, loading, login, logout, refetch: checkAuth }}>
      {children}
    </AuthContext.Provider>
  );
};