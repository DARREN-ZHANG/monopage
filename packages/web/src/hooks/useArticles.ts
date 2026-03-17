import { useQuery } from '@tanstack/react-query';
import { api } from '../api/client';
import type { ArticlesResponse } from '../types';
import { AuthError } from '../types';

interface UseArticlesParams {
  date?: string;
  days?: number;
  page?: number;
  pageSize?: number;
  enabled?: boolean;
}

export function useArticles(params: UseArticlesParams = {}) {
  const { date, days = 7, page = 1, pageSize = 50, enabled = true } = params;

  return useQuery<ArticlesResponse, Error>({
    queryKey: ['articles', { date, days, page, pageSize }],
    queryFn: () => api.getArticles({ date, days, page, pageSize }),
    enabled,
    staleTime: 5 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
    retry: (failureCount, error) => {
      if (error instanceof AuthError) return false;
      return failureCount < 1;
    },
  });
}
