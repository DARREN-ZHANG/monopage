import type {
  ArticlesResponse,
  LoginRequest,
  LoginResponse,
  MeResponse,
  LogoutResponse,
  ApiErrorResponse,
} from '../types';
import { AuthError, ApiError } from '../types';

class ApiClient {
  private async request<T>(path: string, options: RequestInit = {}): Promise<T> {
    try {
      const response = await fetch(`/api${path}`, {
        ...options,
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          ...options.headers,
        },
      });

      // 尝试解析 JSON，处理空响应
      let data;
      const contentType = response.headers.get('content-type');
      if (contentType?.includes('application/json')) {
        const text = await response.text();
        data = text ? JSON.parse(text) : {};
      } else {
        data = {};
      }

      if (!response.ok) {
        if (response.status === 401) {
          throw new AuthError('登录已过期，请重新登录');
        }
        if (response.status === 405) {
          throw new Error('请求方法错误');
        }
        if (data.error) {
          throw new ApiError(data as ApiErrorResponse);
        }
        throw new Error(`请求失败 (${response.status})`);
      }

      return data;
    } catch (error) {
      if (error instanceof AuthError || error instanceof ApiError) {
        throw error;
      }
      if (error instanceof TypeError && error.message.includes('fetch')) {
        throw new Error('网络连接失败，请检查网络');
      }
      throw error;
    }
  }

  async login(username: string, password: string): Promise<LoginResponse> {
    return this.request<LoginResponse>('/login', {
      method: 'POST',
      body: JSON.stringify({ username, password } as LoginRequest),
    });
  }

  async logout(): Promise<LogoutResponse> {
    return this.request<LogoutResponse>('/logout', { method: 'POST' });
  }

  async getMe(): Promise<MeResponse> {
    return this.request<MeResponse>('/me');
  }

  async getArticles(params: { date?: string; days?: number; page?: number; pageSize?: number }): Promise<ArticlesResponse> {
    const searchParams = new URLSearchParams();
    if (params.date) searchParams.set('date', params.date);
    if (params.days) searchParams.set('days', String(params.days));
    if (params.page) searchParams.set('page', String(params.page));
    if (params.pageSize) searchParams.set('pageSize', String(params.pageSize));

    const query = searchParams.toString();
    return this.request<ArticlesResponse>(`/articles${query ? `?${query}` : ''}`);
  }
}

export const api = new ApiClient();
