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
    const response = await fetch(path, {
      ...options,
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
    });

    const data = await response.json();

    if (!response.ok) {
      if (response.status === 401) {
        throw new AuthError();
      }
      throw new ApiError(data as ApiErrorResponse);
    }

    return data;
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
