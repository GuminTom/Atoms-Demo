import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  ReactNode,
} from 'react';
import { client } from '../lib/api';
import { api } from '../lib/api';

interface User {
  id: string;
  email: string;
  name?: string;
  avatar?: string;
  username?: string;
}

interface AuthContextType {
  user: User | null;
  loading: boolean;
  login: () => void;
  logout: () => Promise<void>;
  refetch: () => Promise<void>;
  localLogin: (username: string, password: string) => Promise<void>;
  localRegister: (username: string, email: string, password: string, name?: string) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
};

/**
 * Decode a JWT payload without a library.
 * Returns the parsed JSON payload or null on failure.
 */
function decodeJWTPayload(token: string): Record<string, unknown> | null {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    const payload = parts[1];
    // Base64url decode
    const base64 = payload.replace(/-/g, '+').replace(/_/g, '/');
    const jsonStr = decodeURIComponent(
      atob(base64)
        .split('')
        .map((c) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
        .join('')
    );
    return JSON.parse(jsonStr);
  } catch {
    return null;
  }
}

/**
 * Check if a JWT token is expired.
 * Returns true if the token is missing, malformed, or expired.
 */
function isTokenExpired(token: string): boolean {
  const payload = decodeJWTPayload(token);
  if (!payload || !payload.exp) return true;
  const now = Math.floor(Date.now() / 1000);
  return (payload.exp as number) < now;
}

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  const checkAuth = useCallback(async () => {
    // First, check for a local auth token in localStorage
    const localToken = localStorage.getItem('auth_token');
    if (localToken) {
      if (isTokenExpired(localToken)) {
        // Token expired – clear it and fall through to OIDC check
        localStorage.removeItem('auth_token');
      } else {
        // Token is still valid – restore user from JWT claims
        const payload = decodeJWTPayload(localToken);
        if (payload) {
          setUser({
            id: (payload.sub as string) || '',
            email: (payload.email as string) || '',
            name: (payload.name as string) || (payload.username as string) || '',
            username: (payload.username as string) || '',
          });
          setLoading(false);
          return;
        }
      }
    }

    // Fall back to OIDC auth check
    try {
      const res = await client.auth.me();
      if (res?.data) {
        setUser({
          id: res.data.id || res.data.sub || '',
          email: res.data.email || '',
          name: res.data.name || res.data.nickname || res.data.email?.split('@')[0] || '',
          avatar: res.data.avatar || res.data.picture || '',
          username: res.data.username || '',
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
    // Clear local auth token
    localStorage.removeItem('auth_token');
    try {
      await client.auth.logout();
    } catch {
      // fallback
    }
    setUser(null);
    window.location.href = '/';
  }, []);

  const localLogin = useCallback(async (username: string, password: string) => {
    const data = await api.post('/local-auth/login', { username, password });
    if (data?.token) {
      localStorage.setItem('auth_token', data.token);
    }
    if (data?.user) {
      setUser({
        id: data.user.id || '',
        email: data.user.email || '',
        name: data.user.name || data.user.username || '',
        username: data.user.username || '',
      });
    }
  }, []);

  const localRegister = useCallback(async (username: string, email: string, password: string, name?: string) => {
    const data = await api.post('/local-auth/register', { username, email, password, name });
    if (data?.token) {
      localStorage.setItem('auth_token', data.token);
    }
    if (data?.user) {
      setUser({
        id: data.user.id || '',
        email: data.user.email || '',
        name: data.user.name || data.user.username || '',
        username: data.user.username || '',
      });
    }
  }, []);

  useEffect(() => {
    checkAuth();
  }, [checkAuth]);

  return (
    <AuthContext.Provider value={{ user, loading, login, logout, refetch: checkAuth, localLogin, localRegister }}>
      {children}
    </AuthContext.Provider>
  );
};