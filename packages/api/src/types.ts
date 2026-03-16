// ===== 文章相关类型 =====

export interface Article {
  id: string;
  source: SourceType;
  title: string;
  url: string;
  publishedAt: string; // ISO 8601 format
  content?: string; // 正文内容（用于摘要生成）
}

export interface ArticleSummary extends Article {
  summaryMd: string;
  summarizedAt: string;
}

export type SourceType = 'openai' | 'anthropic';

export interface SourceConfig {
  name: SourceType;
  baseUrl: string;
  newsUrl: string;
}

// ===== API 请求/响应类型 =====

export interface ArticlesQueryParams {
  date?: string; // YYYY-MM-DD
  source?: SourceType;
  days?: number; // 1-7
  page?: number; // >= 1
  pageSize?: number; // 1-50
}

export interface ArticlesResponse {
  success: true;
  data: {
    articles: ArticleSummary[];
  };
  meta: {
    page: number;
    pageSize: number;
    totalCount: number;
    totalPages: number;
    sourcesIncluded: SourceType[];
    dateRange: {
      from: string;
      to: string;
    };
    lastRefreshedAt: string | null;
  };
}

export interface RefreshRequest {
  source?: SourceType;
}

export interface RefreshResponse {
  success: true;
  data: {
    refreshedSources: SourceType[];
    articlesFound: number;
    articlesSummarized: number;
    articlesSkipped: {
      duplicate: number;
      incompleteMetadata: number;
    };
    errors: string[];
  };
}

export interface ErrorResponse {
  success: false;
  error: {
    code: string;
    codeNum: number;
    message: string;
    retryable: boolean;
  };
}

// ===== KV 存储类型 =====

export interface IndexEntry {
  [source: string]: string[]; // source -> article IDs
}

export interface ConfigData {
  apiToken: string;
  rateLimit: {
    limit: number;
    current: number;
    resetAt: string; // ISO 8601 format
  };
}

// ===== LLM 相关类型 =====

export interface LLMMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface LLMRequest {
  messages: LLMMessage[];
  maxTokens: number;
  temperature: number;
}

export interface LLMResponse {
  content: string;
  usage?: {
    promptTokens?: number;
    completionTokens?: number;
  };
}

export interface LLMProvider {
  summarize(article: Article): Promise<string>;
}

// ===== Worker 环境类型 =====

export interface Env {
  KV: KVNamespace;
  AI: Ai; // Cloudflare Workers AI binding
  API_TOKEN: string;
  OPENAI_API_KEY?: string;
  ANTHROPIC_API_KEY?: string;
  LLM_PROVIDER: string;
  LLM_MODEL: string;
  RATE_LIMIT_PER_HOUR: string;
  LLM_TIMEOUT_MS: string;
  SCRAPER_TIMEOUT_MS: string;
  HISTORY_DAYS: string;
}
