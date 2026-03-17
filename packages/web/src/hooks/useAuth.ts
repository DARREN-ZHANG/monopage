import { useState, useEffect, useCallback } from 'react';
import { api } from '../api/client';
import { AuthError, type MeResponse, type LoginResponse } from '../types';

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
        const response: MeResponse = await api.getMe();
        if (mounted && response.success && response.data) {
          setUser(response.data.username);
        }
      } catch {
        // 未登录或 token 过期，忽略错误
      } finally {
        if (mounted) {
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
      const response: LoginResponse = await api.login(username, password);
      if (response.success && response.data) {
        setUser(response.data.username);
        setIsLoading(false);
        return { success: true };
      }
      throw new Error('登录响应格式错误');
    } catch (err) {
      let errorMessage = '登录失败，请稍后重试';

      if (err instanceof AuthError) {
        errorMessage = err.message || '用户名或密码错误';
      } else if (err instanceof Error) {
        errorMessage = err.message;
      }

      setIsLoading(false);
      setError(errorMessage);
      return { success: false, error: errorMessage };
    }
  }, []);

  const logout = useCallback(async () => {
    try {
      await api.logout();
    } catch {
      // 忽略登出错误
    } finally {
      setUser(null);
      setIsLoading(false);
      setError(null);
    }
  }, []);

  return { user, isLoading, error, login, logout };
}
