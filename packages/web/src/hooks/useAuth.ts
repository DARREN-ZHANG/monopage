import { useState, useEffect, useCallback } from 'react';
import { api } from '../api/client';
import { AuthError } from '../types';

interface UseAuthReturn {
  user: string | null;
  isLoading: boolean;
  error: string | null;
  login: (username: string, password: string) => Promise<{ success: boolean; error?: string }>;
  logout: () => Promise<void>;
}

export function useAuth(): UseAuthReturn {
  const [user, setUser] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;

    async function checkAuth() {
      try {
        const response = await api.getMe();
        if (mounted) {
          setUser(response.data.username);
          setIsLoading(false);
        }
      } catch {
        if (mounted) {
          setUser(null);
          setIsLoading(false);
        }
      }
    }

    checkAuth();
    return () => { mounted = false; };
  }, []);

  const login = useCallback(async (username: string, password: string) => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await api.login(username, password);
      setUser(response.data.username);
      setIsLoading(false);
      return { success: true };
    } catch (err) {
      const errorMessage = err instanceof AuthError
        ? '用户名或密码错误'
        : err instanceof Error
          ? err.message
          : '登录失败，请稍后重试';

      setIsLoading(false);
      setError(errorMessage);
      return { success: false, error: errorMessage };
    }
  }, []);

  const logout = useCallback(async () => {
    try {
      await api.logout();
    } catch {
      // Ignore logout errors
    } finally {
      setUser(null);
      setIsLoading(false);
      setError(null);
    }
  }, []);

  return { user, isLoading, error, login, logout };
}
