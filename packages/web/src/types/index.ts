export type SourceType = 'openai' | 'anthropic';

export interface Article {
  id: string;
  source: SourceType;
  title: string;
  summary_md: string;
  source_url: string;
  published_at: string;
}

export interface ArticlesResponse {
  success: true;
  data: {
    articles: Article[];
  };
  meta: {
    page: number;
    page_size: number;
    total_count: number;
    total_pages: number;
    sources_included: SourceType[];
    date_range: {
      from: string;
      to: string;
    };
    last_refreshed_at: string | null;
  };
}

export interface LoginRequest {
  username: string;
  password: string;
}

export interface LoginResponse {
  success: true;
  data: {
    username: string;
  };
}

export interface MeResponse {
  success: true;
  data: {
    username: string;
  };
}

export interface LogoutResponse {
  success: true;
  data: null;
}

export interface RefreshResponse {
  success: true;
  data: {
    refreshed_sources: SourceType[];
    articles_found: number;
    articles_summarized: number;
    articles_skipped: {
      duplicate: number;
      incomplete_metadata: number;
    };
    errors: string[];
  };
}

export interface ApiErrorResponse {
  success: false;
  error: {
    code: string;
    code_num: number;
    message: string;
    retryable: boolean;
  };
}

export class AuthError extends Error {
  constructor(message: string = 'Authentication required') {
    super(message);
    this.name = 'AuthError';
  }
}

export class ApiError extends Error {
  public readonly code: string;
  public readonly codeNum: number;
  public readonly retryable: boolean;

  constructor(response: ApiErrorResponse) {
    super(response.error.message);
    this.name = 'ApiError';
    this.code = response.error.code;
    this.codeNum = response.error.code_num;
    this.retryable = response.error.retryable;
  }
}
