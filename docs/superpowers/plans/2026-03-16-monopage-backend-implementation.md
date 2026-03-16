# Monopage Backend Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 构建基于 Cloudflare Workers 的 AI 新闻聚合服务，每日抓取 OpenAI 和 Anthropic 新闻并生成中文摘要，提供 REST API 供外部调用。

**Architecture:** 采用 Monorepo 结构，使用 pnpm workspace 管理。后端运行在 Cloudflare Workers，使用 Workers KV 存储摘要数据和索引，Cron Trigger 定时触发抓取任务，LLM 生成中文 Markdown 摘要。

**Tech Stack:** TypeScript, Cloudflare Workers, Workers KV, Cloudflare Workers AI (Llama 4 Scout), pnpm, Wrangler

---

## 文件结构概览

```
packages/api/
├── src/
│   ├── index.ts              # Worker 入口，路由分发
│   ├── types.ts              # TypeScript 类型定义
│   ├── utils/
│   │   ├── errors.ts         # 错误码定义与错误类
│   │   ├── response.ts       # 响应格式化工具
│   │   └── id.ts             # ID 生成工具
│   ├── middleware/
│   │   ├── auth.ts           # Token 认证中间件
│   │   └── rateLimit.ts      # 限流中间件
│   ├── services/
│   │   ├── storage.ts        # KV 存储封装
│   │   ├── scraper.ts        # 页面抓取与解析
│   │   └── summarizer.ts     # LLM 总结服务
│   ├── providers/
│   │   ├── base.ts           # LLM Provider 接口定义
│   │   └── cloudflare.ts     # Cloudflare Workers AI 实现
│   ├── sources/
│   │   ├── base.ts           # 数据源接口定义
│   │   ├── openai.ts         # OpenAI News 解析器
│   │   └── anthropic.ts      # Anthropic News 解析器
│   └── routes/
│       ├── articles.ts       # GET /articles 处理
│       └── refresh.ts        # POST /refresh 处理
├── wrangler.toml             # Cloudflare Workers 配置
├── package.json
└── tsconfig.json
```

---

## Chunk 1: 项目基础结构

### Task 1: 创建 Monorepo 根配置

**Files:**
- Create: `package.json` (根目录)
- Create: `pnpm-workspace.yaml`
- Create: `tsconfig.json` (根目录)

- [ ] **Step 1: 创建根 package.json**

```json
{
  "name": "monopage",
  "version": "1.0.0",
  "private": true,
  "description": "Catch up in the morning with a mono page of reading.",
  "scripts": {
    "dev": "pnpm -F @monopage/api dev",
    "deploy": "pnpm -F @monopage/api deploy",
    "build": "pnpm -r build"
  },
  "devDependencies": {
    "typescript": "^5.0.0"
  },
  "packageManager": "pnpm@9.0.0"
}
```

- [ ] **Step 2: 创建 pnpm-workspace.yaml**

```yaml
packages:
  - 'packages/*'
```

- [ ] **Step 3: 创建根 tsconfig.json**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true
  }
}
```

- [ ] **Step 4: Commit**

```bash
git add package.json pnpm-workspace.yaml tsconfig.json
git commit -m "chore: setup monorepo structure"
```

### Task 2: 创建 API 包基础结构

**Files:**
- Create: `packages/api/package.json`
- Create: `packages/api/tsconfig.json`

- [ ] **Step 1: 创建 packages/api/package.json**

```json
{
  "name": "@monopage/api",
  "version": "1.0.0",
  "type": "module",
  "main": "src/index.ts",
  "scripts": {
    "dev": "wrangler dev",
    "deploy": "wrangler deploy",
    "build": "wrangler build"
  },
  "dependencies": {
    "zod": "^3.22.0"
  },
  "devDependencies": {
    "@cloudflare/workers-types": "^4.20240316.0",
    "typescript": "^5.0.0",
    "wrangler": "^3.0.0"
  }
}
```

- [ ] **Step 2: 创建 packages/api/tsconfig.json**

```json
{
  "extends": "../../tsconfig.json",
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "lib": ["ES2022"],
    "types": ["@cloudflare/workers-types"],
    "outDir": "./dist",
    "rootDir": "./src",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "moduleResolution": "bundler"
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist"]
}
```

- [ ] **Step 3: Commit**

```bash
git add packages/api/package.json packages/api/tsconfig.json
git commit -m "chore: setup api package structure"
```

### Task 3: 创建 Wrangler 配置

**Files:**
- Create: `packages/api/wrangler.toml`

- [ ] **Step 1: 创建 wrangler.toml**

```toml
name = "monopage-api"
main = "src/index.ts"
compatibility_date = "2024-03-16"

# KV 命名空间绑定
[[kv_namespaces]]
binding = "KV"
id = "your-kv-namespace-id"
preview_id = "your-preview-kv-namespace-id"

# 定时任务 - 每天 UTC 06:00 运行
[triggers]
crons = ["0 6 * * *"]

# 环境变量
[vars]
LLM_PROVIDER = "cloudflare"
LLM_MODEL = "@cf/meta/llama-4-scout-17b-16e-instruct"
RATE_LIMIT_PER_HOUR = "100"
LLM_TIMEOUT_MS = "30000"
SCRAPER_TIMEOUT_MS = "15000"
HISTORY_DAYS = "7"

# 开发环境
[env.development]
[env.development.vars]
LLM_PROVIDER = "cloudflare"
```

- [ ] **Step 2: Commit**

```bash
git add packages/api/wrangler.toml
git commit -m "chore: add wrangler configuration"
```

---

## Chunk 2: 类型定义与错误处理

### Task 4: 创建 TypeScript 类型定义

**Files:**
- Create: `packages/api/src/types.ts`

- [ ] **Step 1: 创建类型定义文件**

```typescript
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
```

- [ ] **Step 2: Commit**

```bash
git add packages/api/src/types.ts
git commit -m "feat: add typescript type definitions"
```

### Task 5: 创建错误处理系统

**Files:**
- Create: `packages/api/src/utils/errors.ts`

- [ ] **Step 1: 创建错误码常量**

```typescript
// ===== 错误码定义 =====
// 格式：模块前缀(2位) + 错误序号(2位) = 4位数字

export const ErrorCodes = {
  // 认证错误 (10xx)
  AUTH_MISSING: { code: 'AUTH_MISSING', num: 1001, http: 401, message: '缺少 Authorization Header', retryable: false },
  AUTH_INVALID_FORMAT: { code: 'AUTH_INVALID_FORMAT', num: 1002, http: 401, message: 'Token 格式错误，期望 Bearer 格式', retryable: false },
  AUTH_INVALID_TOKEN: { code: 'AUTH_INVALID_TOKEN', num: 1003, http: 401, message: 'Token 无效或不匹配', retryable: false },

  // 参数验证错误 (20xx)
  VALIDATION_INVALID_DATE: { code: 'VALIDATION_INVALID_DATE', num: 2001, http: 400, message: 'date 参数格式错误，期望 YYYY-MM-DD', retryable: false },
  VALIDATION_INVALID_SOURCE: { code: 'VALIDATION_INVALID_SOURCE', num: 2002, http: 400, message: 'source 参数值无效，期望 openai/anthropic', retryable: false },
  VALIDATION_INVALID_PAGE: { code: 'VALIDATION_INVALID_PAGE', num: 2003, http: 400, message: 'page 参数必须是正整数', retryable: false },
  VALIDATION_INVALID_PAGE_SIZE: { code: 'VALIDATION_INVALID_PAGE_SIZE', num: 2004, http: 400, message: 'page_size 必须在 1-50 之间', retryable: false },
  VALIDATION_INVALID_DAYS: { code: 'VALIDATION_INVALID_DAYS', num: 2005, http: 400, message: 'days 必须在 1-7 之间', retryable: false },

  // 限流错误 (30xx)
  RATE_LIMITED: { code: 'RATE_LIMITED', num: 3001, http: 429, message: '超过全局限流阈值', retryable: true },

  // 数据源错误 (40xx) - 这些在刷新流程中处理，不直接返回给客户端
  SOURCE_FETCH_FAILED: { code: 'SOURCE_FETCH_FAILED', num: 4001, http: 0, message: '页面请求失败（网络错误）', retryable: true },
  SOURCE_HTTP_ERROR: { code: 'SOURCE_HTTP_ERROR', num: 4002, http: 0, message: '页面返回非 2xx 状态码', retryable: true },
  SOURCE_TIMEOUT: { code: 'SOURCE_TIMEOUT', num: 4003, http: 0, message: '页面请求超时', retryable: true },
  SOURCE_PARSE_FAILED: { code: 'SOURCE_PARSE_FAILED', num: 4004, http: 0, message: 'HTML 解析失败，未找到预期结构', retryable: false },
  SOURCE_EMPTY_ARTICLES: { code: 'SOURCE_EMPTY_ARTICLES', num: 4005, http: 0, message: '解析成功但未找到任何文章', retryable: true },
  SOURCE_ARTICLE_INCOMPLETE: { code: 'SOURCE_ARTICLE_INCOMPLETE', num: 4006, http: 0, message: '文章缺少必要元数据（标题/链接/时间）', retryable: false },
  SOURCE_CONTENT_FETCH_FAILED: { code: 'SOURCE_CONTENT_FETCH_FAILED', num: 4007, http: 0, message: '获取文章正文失败', retryable: true },

  // LLM 错误 (50xx)
  LLM_REQUEST_FAILED: { code: 'LLM_REQUEST_FAILED', num: 5001, http: 0, message: 'LLM API 请求失败（网络错误）', retryable: true },
  LLM_TIMEOUT: { code: 'LLM_TIMEOUT', num: 5002, http: 0, message: 'LLM API 超时', retryable: true },
  LLM_RATE_LIMITED: { code: 'LLM_RATE_LIMITED', num: 5003, http: 0, message: 'LLM API 限流', retryable: true },
  LLM_QUOTA_EXCEEDED: { code: 'LLM_QUOTA_EXCEEDED', num: 5004, http: 0, message: 'LLM 配额耗尽', retryable: true },
  LLM_INVALID_RESPONSE: { code: 'LLM_INVALID_RESPONSE', num: 5005, http: 0, message: 'LLM 返回内容格式不符合预期', retryable: true },
  LLM_EMPTY_RESPONSE: { code: 'LLM_EMPTY_RESPONSE', num: 5006, http: 0, message: 'LLM 返回空内容', retryable: true },
  LLM_AUTH_FAILED: { code: 'LLM_AUTH_FAILED', num: 5007, http: 0, message: 'LLM API Key 无效或过期', retryable: false },

  // 存储错误 (60xx)
  KV_READ_FAILED: { code: 'KV_READ_FAILED', num: 6001, http: 0, message: 'KV 读取操作失败', retryable: true },
  KV_WRITE_FAILED: { code: 'KV_WRITE_FAILED', num: 6002, http: 0, message: 'KV 写入操作失败', retryable: true },
  KV_TIMEOUT: { code: 'KV_TIMEOUT', num: 6003, http: 0, message: 'KV 操作超时', retryable: true },
  KV_DELETE_FAILED: { code: 'KV_DELETE_FAILED', num: 6004, http: 0, message: 'KV 删除操作失败', retryable: true },

  // 系统错误 (90xx)
  INTERNAL_ERROR: { code: 'INTERNAL_ERROR', num: 9001, http: 500, message: '未预期的内部错误', retryable: true },
  SERVICE_UNAVAILABLE: { code: 'SERVICE_UNAVAILABLE', num: 9002, http: 503, message: '服务暂时不可用', retryable: true },
  CONFIG_MISSING: { code: 'CONFIG_MISSING', num: 9003, http: 500, message: '必需的配置/环境变量缺失', retryable: false },
  CONFIG_INVALID: { code: 'CONFIG_INVALID', num: 9004, http: 500, message: '配置格式错误', retryable: false },
} as const;

export type ErrorCodeKey = keyof typeof ErrorCodes;
export type ErrorCodeInfo = typeof ErrorCodes[ErrorCodeKey];
```

- [ ] **Step 2: 创建 AppError 类**

```typescript
export class AppError extends Error {
  public readonly code: string;
  public readonly codeNum: number;
  public readonly httpStatus: number;
  public readonly retryable: boolean;
  public readonly originalError?: Error;

  constructor(errorKey: ErrorCodeKey, originalError?: Error) {
    const errorInfo = ErrorCodes[errorKey];
    super(errorInfo.message);

    this.name = 'AppError';
    this.code = errorInfo.code;
    this.codeNum = errorInfo.num;
    this.httpStatus = errorInfo.http;
    this.retryable = errorInfo.retryable;
    this.originalError = originalError;
  }

  toJSON() {
    return {
      success: false as const,
      error: {
        code: this.code,
        code_num: this.codeNum,
        message: this.message,
        retryable: this.retryable,
      },
    };
  }
}

// 辅助函数：根据错误码前缀判断错误类型
export function isAuthError(error: AppError): boolean {
  return error.codeNum >= 1000 && error.codeNum < 2000;
}

export function isValidationError(error: AppError): boolean {
  return error.codeNum >= 2000 && error.codeNum < 3000;
}

export function isRateLimitError(error: AppError): boolean {
  return error.codeNum >= 3000 && error.codeNum < 4000;
}

export function isSourceError(error: AppError): boolean {
  return error.codeNum >= 4000 && error.codeNum < 5000;
}

export function isLLMError(error: AppError): boolean {
  return error.codeNum >= 5000 && error.codeNum < 6000;
}

export function isKVError(error: AppError): boolean {
  return error.codeNum >= 6000 && error.codeNum < 7000;
}
```

- [ ] **Step 3: Commit**

```bash
git add packages/api/src/utils/errors.ts
git commit -m "feat: add error handling system"
```

### Task 6: 创建响应格式化工具

**Files:**
- Create: `packages/api/src/utils/response.ts`

- [ ] **Step 1: 创建响应工具**

```typescript
import { AppError } from './errors.js';
import type { ArticlesResponse, RefreshResponse, ErrorResponse } from '../types.js';

export function successResponse<T>(data: T): Response {
  return new Response(JSON.stringify({ success: true, data }), {
    status: 200,
    headers: {
      'Content-Type': 'application/json',
    },
  });
}

export function articlesResponse(response: ArticlesResponse): Response {
  return new Response(JSON.stringify(response), {
    status: 200,
    headers: {
      'Content-Type': 'application/json',
    },
  });
}

export function refreshResponse(response: RefreshResponse): Response {
  return new Response(JSON.stringify(response), {
    status: 200,
    headers: {
      'Content-Type': 'application/json',
    },
  });
}

export function errorResponse(error: AppError): Response {
  const json = error.toJSON();
  return new Response(JSON.stringify(json), {
    status: error.httpStatus || 500,
    headers: {
      'Content-Type': 'application/json',
    },
  });
}

export function validationErrorResponse(message: string): Response {
  return new Response(
    JSON.stringify({
      success: false,
      error: {
        code: 'VALIDATION_ERROR',
        code_num: 2000,
        message,
        retryable: false,
      },
    }),
    {
      status: 400,
      headers: {
        'Content-Type': 'application/json',
      },
    }
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add packages/api/src/utils/response.ts
git commit -m "feat: add response formatting utilities"
```

---

## Chunk 3: 认证与限流中间件

### Task 7: 创建 Token 认证中间件

**Files:**
- Create: `packages/api/src/middleware/auth.ts`

- [ ] **Step 1: 创建认证中间件**

```typescript
import { AppError } from '../utils/errors.js';
import type { Env } from '../types.js';

/**
 * 从请求中提取并验证 Bearer Token
 * @param request - HTTP 请求对象
 * @param env - 环境变量，包含 API_TOKEN
 * @throws {AppError} 认证失败时抛出错误
 */
export async function authenticate(request: Request, env: Env): Promise<void> {
  const authHeader = request.headers.get('Authorization');

  // 检查 Header 是否存在
  if (!authHeader) {
    throw new AppError('AUTH_MISSING');
  }

  // 检查 Bearer 格式
  const parts = authHeader.split(' ');
  if (parts.length !== 2 || parts[0].toLowerCase() !== 'bearer') {
    throw new AppError('AUTH_INVALID_FORMAT');
  }

  const token = parts[1];

  // 验证 Token（从环境变量或 KV 中获取配置的 Token）
  const validToken = env.API_TOKEN;

  if (!validToken) {
    throw new AppError('CONFIG_MISSING');
  }

  if (token !== validToken) {
    throw new AppError('AUTH_INVALID_TOKEN');
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add packages/api/src/middleware/auth.ts
git commit -m "feat: add authentication middleware"
```

### Task 8: 创建限流中间件

**Files:**
- Create: `packages/api/src/middleware/rateLimit.ts`

- [ ] **Step 1: 创建限流中间件**

```typescript
import { AppError } from '../utils/errors.js';
import type { Env } from '../types.js';

interface RateLimitState {
  limit: number;
  current: number;
  resetAt: string;
}

const CONFIG_KEY = 'config';
const RATE_LIMIT_KEY = 'rate_limit';

/**
 * 检查并更新限流状态
 * @param env - 环境变量，包含 KV 绑定
 * @throws {AppError} 超过限流阈值时抛出错误
 */
export async function checkRateLimit(env: Env): Promise<void> {
  const limit = parseInt(env.RATE_LIMIT_PER_HOUR, 10) || 100;
  const now = new Date();

  // 计算下一个整点重置时间
  const nextHour = new Date(now);
  nextHour.setHours(nextHour.getHours() + 1, 0, 0, 0);

  try {
    // 从 KV 读取限流状态
    const rateLimitKey = RATE_LIMIT_KEY;
    const stored = await env.KV.get(rateLimitKey);

    let state: RateLimitState;

    if (stored) {
      state = JSON.parse(stored) as RateLimitState;
      const resetAt = new Date(state.resetAt);

      // 检查是否需要重置
      if (now >= resetAt) {
        state = {
          limit,
          current: 1,
          resetAt: nextHour.toISOString(),
        };
      } else if (state.current >= state.limit) {
        // 超过限流阈值
        throw new AppError('RATE_LIMITED');
      } else {
        // 增加计数
        state.current++;
      }
    } else {
      // 初始化限流状态
      state = {
        limit,
        current: 1,
        resetAt: nextHour.toISOString(),
      };
    }

    // 保存更新后的状态
    await env.KV.put(rateLimitKey, JSON.stringify(state));

  } catch (error) {
    if (error instanceof AppError) {
      throw error;
    }
    // KV 操作失败，允许请求继续（降级处理）
    console.error('Rate limit check failed:', error);
  }
}

/**
 * 获取当前限流状态（用于调试）
 */
export async function getRateLimitStatus(env: Env): Promise<RateLimitState | null> {
  try {
    const stored = await env.KV.get(RATE_LIMIT_KEY);
    return stored ? JSON.parse(stored) as RateLimitState : null;
  } catch {
    return null;
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add packages/api/src/middleware/rateLimit.ts
git commit -m "feat: add rate limiting middleware"
```

---

## Chunk 4: KV 存储服务

### Task 9: 创建 KV 存储服务

**Files:**
- Create: `packages/api/src/services/storage.ts`

- [ ] **Step 1: 创建存储服务**

```typescript
import { AppError } from '../utils/errors.js';
import type { ArticleSummary, SourceType, IndexEntry } from '../types.js';
import type { Env } from '../types.js';

const INDEX_PREFIX = 'index';
const SUMMARY_PREFIX = 'summary';

/**
 * KV 存储服务 - 封装所有 KV 操作
 */
export class StorageService {
  private kv: KVNamespace;
  private historyDays: number;

  constructor(env: Env) {
    this.kv = env.KV;
    this.historyDays = parseInt(env.HISTORY_DAYS, 10) || 7;
  }

  // ===== 摘要存储 =====

  /**
   * 生成摘要的 KV Key
   * 格式: summary:{source}:{date}:{id}
   */
  private getSummaryKey(source: SourceType, date: string, id: string): string {
    return `${SUMMARY_PREFIX}:${source}:${date}:${id}`;
  }

  /**
   * 保存文章摘要
   */
  async saveSummary(summary: ArticleSummary): Promise<void> {
    const date = summary.publishedAt.slice(0, 10); // YYYY-MM-DD
    const key = this.getSummaryKey(summary.source, date, summary.id);

    try {
      await this.kv.put(key, JSON.stringify(summary));
    } catch (error) {
      throw new AppError('KV_WRITE_FAILED', error instanceof Error ? error : undefined);
    }
  }

  /**
   * 检查摘要是否已存在
   */
  async hasSummary(source: SourceType, date: string, id: string): Promise<boolean> {
    const key = this.getSummaryKey(source, date, id);

    try {
      const value = await this.kv.get(key);
      return value !== null;
    } catch (error) {
      throw new AppError('KV_READ_FAILED', error instanceof Error ? error : undefined);
    }
  }

  /**
   * 获取单条摘要
   */
  async getSummary(source: SourceType, date: string, id: string): Promise<ArticleSummary | null> {
    const key = this.getSummaryKey(source, date, id);

    try {
      const value = await this.kv.get(key);
      return value ? JSON.parse(value) as ArticleSummary : null;
    } catch (error) {
      throw new AppError('KV_READ_FAILED', error instanceof Error ? error : undefined);
    }
  }

  // ===== 索引管理 =====

  /**
   * 生成索引的 KV Key
   * 格式: index:{date}
   */
  private getIndexKey(date: string): string {
    return `${INDEX_PREFIX}:${date}`;
  }

  /**
   * 更新索引 - 将文章 ID 添加到对应日期的索引中
   */
  async addToIndex(date: string, source: SourceType, articleId: string): Promise<void> {
    const key = this.getIndexKey(date);

    try {
      const stored = await this.kv.get(key);
      const index: IndexEntry = stored ? JSON.parse(stored) as IndexEntry : {};

      if (!index[source]) {
        index[source] = [];
      }

      // 避免重复添加
      if (!index[source].includes(articleId)) {
        index[source].push(articleId);
      }

      await this.kv.put(key, JSON.stringify(index));
    } catch (error) {
      throw new AppError('KV_WRITE_FAILED', error instanceof Error ? error : undefined);
    }
  }

  /**
   * 获取指定日期的索引
   */
  async getIndex(date: string): Promise<IndexEntry> {
    const key = this.getIndexKey(date);

    try {
      const stored = await this.kv.get(key);
      return stored ? JSON.parse(stored) as IndexEntry : {};
    } catch (error) {
      throw new AppError('KV_READ_FAILED', error instanceof Error ? error : undefined);
    }
  }

  /**
   * 获取指定日期范围的所有索引
   */
  async getIndexRange(fromDate: string, toDate: string): Promise<Map<string, IndexEntry>> {
    const results = new Map<string, IndexEntry>();

    const from = new Date(fromDate);
    const to = new Date(toDate);

    for (let d = new Date(from); d <= to; d.setDate(d.getDate() + 1)) {
      const dateStr = d.toISOString().slice(0, 10);
      const index = await this.getIndex(dateStr);
      results.set(dateStr, index);
    }

    return results;
  }

  // ===== 批量查询 =====

  /**
   * 获取指定日期范围的所有文章摘要
   */
  async getSummariesByDateRange(
    fromDate: string,
    toDate: string,
    sourceFilter?: SourceType
  ): Promise<ArticleSummary[]> {
    const indexes = await this.getIndexRange(fromDate, toDate);
    const summaries: ArticleSummary[] = [];

    for (const [date, index] of indexes) {
      const sources = sourceFilter ? [sourceFilter] : Object.keys(index) as SourceType[];

      for (const source of sources) {
        const ids = index[source] || [];

        for (const id of ids) {
          const summary = await this.getSummary(source, date, id);
          if (summary) {
            summaries.push(summary);
          }
        }
      }
    }

    // 按发布时间倒序排序
    return summaries.sort((a, b) =>
      new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime()
    );
  }

  // ===== 数据清理 =====

  /**
   * 清理过期数据
   */
  async cleanupOldData(): Promise<{ deletedKeys: number; errors: string[] }> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - this.historyDays);
    const cutoffStr = cutoffDate.toISOString().slice(0, 10);

    const errors: string[] = [];
    let deletedKeys = 0;

    // 获取所有 KV Key（限制：在生产环境中可能需要分页处理）
    try {
      const list = await this.kv.list({ prefix: `${SUMMARY_PREFIX}:` });

      for (const key of list.keys) {
        // 从 key 中提取日期: summary:{source}:{date}:{id}
        const parts = key.name.split(':');
        if (parts.length >= 3) {
          const date = parts[2];
          if (date < cutoffStr) {
            try {
              await this.kv.delete(key.name);
              deletedKeys++;
            } catch (error) {
              errors.push(`Failed to delete ${key.name}: ${error}`);
            }
          }
        }
      }

      // 清理过期索引
      const indexList = await this.kv.list({ prefix: `${INDEX_PREFIX}:` });
      for (const key of indexList.keys) {
        const parts = key.name.split(':');
        if (parts.length >= 2) {
          const date = parts[1];
          if (date < cutoffStr) {
            try {
              await this.kv.delete(key.name);
              deletedKeys++;
            } catch (error) {
              errors.push(`Failed to delete ${key.name}: ${error}`);
            }
          }
        }
      }
    } catch (error) {
      errors.push(`List operation failed: ${error}`);
    }

    return { deletedKeys, errors };
  }

  // ===== 最后刷新时间 =====

  private readonly LAST_REFRESH_KEY = 'meta:last_refreshed_at';

  async setLastRefreshed(timestamp: string): Promise<void> {
    try {
      await this.kv.put(this.LAST_REFRESH_KEY, timestamp);
    } catch (error) {
      console.error('Failed to set last refreshed timestamp:', error);
    }
  }

  async getLastRefreshed(): Promise<string | null> {
    try {
      return await this.kv.get(this.LAST_REFRESH_KEY);
    } catch {
      return null;
    }
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add packages/api/src/services/storage.ts
git commit -m "feat: add KV storage service"
```

---

## Chunk 5: ID 生成与数据源解析器

### Task 10: 创建 ID 生成工具

**Files:**
- Create: `packages/api/src/utils/id.ts`

- [ ] **Step 1: 创建 ID 生成工具**

```typescript
import type { SourceType } from '../types.js';

/**
 * 生成简单的哈希值（基于字符串内容）
 * 使用 FNV-1a 算法的简化版本
 */
function simpleHash(input: string): string {
  let hash = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i);
    hash += (hash << 1) + (hash << 4) + (hash << 7) + (hash << 8) + (hash << 24);
  }
  // 转换为 12 位十六进制字符串
  return (hash >>> 0).toString(16).padStart(8, '0').slice(0, 12);
}

/**
 * 生成文章唯一 ID
 * 格式: {source}_{hash}
 * 示例: openai_a1b2c3d4e5f6
 *
 * @param source - 数据源类型
 * @param url - 文章 URL
 * @param title - 文章标题（备选）
 */
export function generateArticleId(source: SourceType, url: string, title?: string): string {
  const content = url || title || '';
  const hash = simpleHash(content);
  return `${source}_${hash}`;
}
```

- [ ] **Step 2: Commit**

```bash
git add packages/api/src/utils/id.ts
git commit -m "feat: add article ID generation utility"
```

### Task 11: 创建数据源基础接口

**Files:**
- Create: `packages/api/src/sources/base.ts`

- [ ] **Step 1: 创建数据源基础接口**

```typescript
import { AppError } from '../utils/errors.js';
import type { Article, SourceConfig, SourceType } from '../types.js';

/**
 * 数据源解析器抽象类
 * 所有具体数据源解析器都需要继承此类
 */
export abstract class BaseSourceParser {
  protected config: SourceConfig;

  constructor(config: SourceConfig) {
    this.config = config;
  }

  /**
   * 获取数据源名称
   */
  get name(): SourceType {
    return this.config.name;
  }

  /**
   * 获取新闻页面 URL
   */
  get newsUrl(): string {
    return this.config.newsUrl;
  }

  /**
   * 抓取并解析文章列表
   * @param timeoutMs - 请求超时时间（毫秒）
   * @returns 文章列表
   * @throws {AppError} 抓取或解析失败时抛出错误
   */
  abstract fetchArticles(timeoutMs: number): Promise<Article[]>;

  /**
   * 获取单篇文章的完整内容
   * @param url - 文章 URL
   * @param timeoutMs - 请求超时时间（毫秒）
   * @returns 文章内容
   * @throws {AppError} 获取失败时抛出错误
   */
  abstract fetchArticleContent(url: string, timeoutMs: number): Promise<string>;

  /**
   * 辅助方法：带超时的 fetch
   */
  protected async fetchWithTimeout(url: string, timeoutMs: number): Promise<Response> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await fetch(url, {
        signal: controller.signal,
        headers: {
          'User-Agent': 'Monopage-Bot/1.0 (News Aggregator)',
        },
      });
      return response;
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        throw new AppError('SOURCE_TIMEOUT');
      }
      throw new AppError('SOURCE_FETCH_FAILED', error instanceof Error ? error : undefined);
    } finally {
      clearTimeout(timeoutId);
    }
  }

  /**
   * 辅助方法：验证文章数据完整性
   */
  protected validateArticle(article: Partial<Article>): article is Article {
    return !!(
      article.id &&
      article.source &&
      article.title &&
      article.url &&
      article.publishedAt
    );
  }

  /**
   * 过滤最近 N 小时内的文章
   */
  protected filterRecentArticles(articles: Article[], hours: number): Article[] {
    const cutoff = new Date();
    cutoff.setHours(cutoff.getHours() - hours);

    return articles.filter(article => {
      const published = new Date(article.publishedAt);
      return published >= cutoff;
    });
  }
}

/**
 * 数据源工厂 - 创建具体解析器实例
 */
export function createSourceParser(source: SourceType): BaseSourceParser {
  switch (source) {
    case 'openai':
      return new (require('./openai.js')).OpenAISourceParser();
    case 'anthropic':
      return new (require('./anthropic.js')).AnthropicSourceParser();
    default:
      throw new AppError('VALIDATION_INVALID_SOURCE');
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add packages/api/src/sources/base.ts
git commit -m "feat: add base source parser interface"
```

### Task 12: 创建 OpenAI 数据源解析器

**Files:**
- Create: `packages/api/src/sources/openai.ts`

- [ ] **Step 1: 创建 OpenAI 解析器**

```typescript
import { AppError } from '../utils/errors.js';
import { generateArticleId } from '../utils/id.js';
import { BaseSourceParser } from './base.js';
import type { Article, SourceConfig } from '../types.js';

export class OpenAISourceParser extends BaseSourceParser {
  constructor() {
    const config: SourceConfig = {
      name: 'openai',
      baseUrl: 'https://openai.com',
      newsUrl: 'https://openai.com/blog/rss.xml',
    };
    super(config);
  }

  async fetchArticles(timeoutMs: number): Promise<Article[]> {
    const response = await this.fetchWithTimeout(this.newsUrl, timeoutMs);

    if (!response.ok) {
      throw new AppError('SOURCE_HTTP_ERROR');
    }

    const xmlText = await response.text();
    return this.parseRSSFeed(xmlText);
  }

  private parseRSSFeed(xmlText: string): Article[] {
    const articles: Article[] = [];

    try {
      // 使用正则表达式解析 RSS XML（Cloudflare Workers 不支持 DOMParser）
      const itemRegex = /<item>([\s\S]*?)<\/item>/g;
      const items = xmlText.matchAll(itemRegex);

      for (const itemMatch of items) {
        const itemContent = itemMatch[1];

        const title = this.extractTagContent(itemContent, 'title');
        const link = this.extractTagContent(itemContent, 'link');
        const pubDate = this.extractTagContent(itemContent, 'pubDate');
        const description = this.extractTagContent(itemContent, 'description');

        if (title && link && pubDate) {
          const publishedAt = this.parseDate(pubDate);
          const article: Article = {
            id: generateArticleId('openai', link, title),
            source: 'openai',
            title: this.cleanHtmlEntities(title),
            url: link,
            publishedAt: publishedAt.toISOString(),
            content: description ? this.cleanHtmlTags(description) : undefined,
          };
          articles.push(article);
        }
      }
    } catch (error) {
      throw new AppError('SOURCE_PARSE_FAILED', error instanceof Error ? error : undefined);
    }

    if (articles.length === 0) {
      throw new AppError('SOURCE_EMPTY_ARTICLES');
    }

    return articles;
  }

  private extractTagContent(xml: string, tagName: string): string | null {
    const regex = new RegExp(`<${tagName}>([^<]*)<\/${tagName}>`, 'i');
    const match = xml.match(regex);
    return match ? match[1].trim() : null;
  }

  private parseDate(dateStr: string): Date {
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) {
      // 如果解析失败，返回当前时间
      return new Date();
    }
    return date;
  }

  private cleanHtmlEntities(text: string): string {
    return text
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/&nbsp;/g, ' ');
  }

  private cleanHtmlTags(html: string): string {
    return html
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  async fetchArticleContent(url: string, timeoutMs: number): Promise<string> {
    const response = await this.fetchWithTimeout(url, timeoutMs);

    if (!response.ok) {
      throw new AppError('SOURCE_CONTENT_FETCH_FAILED');
    }

    const html = await response.text();

    // 尝试提取文章正文
    // OpenAI 博客文章通常在 main 或 article 标签内
    const contentMatch = html.match(/<main[^>]*>([\s\S]*?)<\/main>/i) ||
                        html.match(/<article[^>]*>([\s\S]*?)<\/article>/i);

    if (contentMatch) {
      return this.cleanHtmlTags(contentMatch[1]);
    }

    // 备选方案：尝试提取所有段落
    const paragraphs: string[] = [];
    const pRegex = /<p[^>]*>([\s\S]*?)<\/p>/gi;
    let match;
    while ((match = pRegex.exec(html)) !== null) {
      const text = this.cleanHtmlTags(match[1]);
      if (text.length > 50) { // 过滤短文本
        paragraphs.push(text);
      }
    }

    return paragraphs.join('\n\n');
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add packages/api/src/sources/openai.ts
git commit -m "feat: add OpenAI RSS source parser"
```

### Task 13: 创建 Anthropic 数据源解析器

**Files:**
- Create: `packages/api/src/sources/anthropic.ts`

- [ ] **Step 1: 创建 Anthropic 解析器**

```typescript
import { AppError } from '../utils/errors.js';
import { generateArticleId } from '../utils/id.js';
import { BaseSourceParser } from './base.js';
import type { Article, SourceConfig } from '../types.js';

export class AnthropicSourceParser extends BaseSourceParser {
  constructor() {
    const config: SourceConfig = {
      name: 'anthropic',
      baseUrl: 'https://www.anthropic.com',
      newsUrl: 'https://www.anthropic.com/news',
    };
    super(config);
  }

  async fetchArticles(timeoutMs: number): Promise<Article[]> {
    const response = await this.fetchWithTimeout(this.newsUrl, timeoutMs);

    if (!response.ok) {
      throw new AppError('SOURCE_HTTP_ERROR');
    }

    const html = await response.text();
    return this.parseNewsPage(html);
  }

  private parseNewsPage(html: string): Article[] {
    const articles: Article[] = [];

    try {
      // Anthropic 新闻页面结构分析
      // 文章卡片通常包含：标题链接、发布时间、摘要

      // 尝试多种可能的文章卡片模式
      const patterns = [
        // 模式 1: 文章卡片包含 data-testid 或特定类名
        /<a[^>]*href="(\/news\/[^"]*)"[^>]*>\s*<[^>]*>\s*<h[1-6][^>]*>([^<]+)<\/h[1-6]>/gi,
        // 模式 2: 更通用的链接+标题模式
        /<article[^>]*>[\s\S]*?<a[^>]*href="(\/news\/[^"]*)"[^>]*>[\s\S]*?<h[1-6][^>]*>([^<]+)<\/h[1-6]>/gi,
      ];

      for (const pattern of patterns) {
        let match;
        while ((match = pattern.exec(html)) !== null) {
          const relativeUrl = match[1];
          const title = this.cleanHtmlEntities(match[2].trim());
          const url = `${this.config.baseUrl}${relativeUrl}`;

          // 尝试从 URL 或附近元素提取日期
          const publishedAt = this.extractDateFromUrl(relativeUrl) || new Date();

          const article: Article = {
            id: generateArticleId('anthropic', url, title),
            source: 'anthropic',
            title,
            url,
            publishedAt: publishedAt.toISOString(),
          };

          // 避免重复
          if (!articles.some(a => a.id === article.id)) {
            articles.push(article);
          }
        }
      }

      // 如果上述模式没有匹配，尝试更宽松的匹配
      if (articles.length === 0) {
        const linkPattern = /href="(\/news\/[^"]*)"[^>]*>/gi;
        let linkMatch;
        const seenUrls = new Set<string>();

        while ((linkMatch = linkPattern.exec(html)) !== null) {
          const url = linkMatch[1];
          if (seenUrls.has(url) || url.includes('/news?page=')) {
            continue;
          }
          seenUrls.add(url);

          // 查找对应的标题
          const fullUrl = `${this.config.baseUrl}${url}`;
          const titlePattern = new RegExp(`href="${url.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}"[^>]*>[\\s\\S]{0,200}?>([^<]{10,200})<`, 'i');
          const titleMatch = html.match(titlePattern);

          if (titleMatch) {
            const title = this.cleanHtmlEntities(titleMatch[1].trim());
            const publishedAt = this.extractDateFromUrl(url) || new Date();

            articles.push({
              id: generateArticleId('anthropic', fullUrl, title),
              source: 'anthropic',
              title,
              url: fullUrl,
              publishedAt: publishedAt.toISOString(),
            });
          }
        }
      }
    } catch (error) {
      throw new AppError('SOURCE_PARSE_FAILED', error instanceof Error ? error : undefined);
    }

    if (articles.length === 0) {
      throw new AppError('SOURCE_EMPTY_ARTICLES');
    }

    return articles;
  }

  private extractDateFromUrl(url: string): Date | null {
    // Anthropic URL 格式: /news/announcing-claude-3-5-sonnet
    // 有时 URL 中包含日期信息
    const dateMatch = url.match(/(\d{4})-(\d{2})-(\d{2})/);
    if (dateMatch) {
      const date = new Date(`${dateMatch[1]}-${dateMatch[2]}-${dateMatch[3]}`);
      if (!isNaN(date.getTime())) {
        return date;
      }
    }
    return null;
  }

  private cleanHtmlEntities(text: string): string {
    return text
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/&nbsp;/g, ' ');
  }

  private cleanHtmlTags(html: string): string {
    return html
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  async fetchArticleContent(url: string, timeoutMs: number): Promise<string> {
    const response = await this.fetchWithTimeout(url, timeoutMs);

    if (!response.ok) {
      throw new AppError('SOURCE_CONTENT_FETCH_FAILED');
    }

    const html = await response.text();

    // 尝试提取文章正文
    // Anthropic 文章通常在 main 或 article 标签内
    const contentMatch = html.match(/<main[^>]*>([\s\S]*?)<\/main>/i) ||
                        html.match(/<article[^>]*>([\s\S]*?)<\/article>/i) ||
                        html.match(/class="[^"]*post-content[^"]*"[^>]*>([\s\S]*?)<\/div>/i);

    if (contentMatch) {
      return this.cleanHtmlTags(contentMatch[1]);
    }

    // 备选方案：提取所有段落
    const paragraphs: string[] = [];
    const pRegex = /<p[^>]*>([\s\S]*?)<\/p>/gi;
    let match;
    while ((match = pRegex.exec(html)) !== null) {
      const text = this.cleanHtmlTags(match[1]);
      if (text.length > 50) {
        paragraphs.push(text);
      }
    }

    return paragraphs.join('\n\n');
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add packages/api/src/sources/anthropic.ts
git commit -m "feat: add Anthropic source parser"
```

---

## Chunk 6: LLM 提供商与总结服务

### Task 14: 创建 LLM Provider 接口

**Files:**
- Create: `packages/api/src/providers/base.ts`

- [ ] **Step 1: 创建 Provider 接口**

```typescript
import type { Article, LLMRequest, LLMResponse } from '../types.js';

/**
 * LLM Provider 抽象类
 */
export abstract class BaseLLMProvider {
  protected model: string;
  protected maxTokens: number;
  protected temperature: number;
  protected timeoutMs: number;

  constructor(model: string, timeoutMs: number) {
    this.model = model;
    this.maxTokens = 800;
    this.temperature = 0.3;
    this.timeoutMs = timeoutMs;
  }

  /**
   * 生成文章摘要
   */
  abstract summarize(article: Article): Promise<string>;

  /**
   * 构建系统提示词
   */
  protected getSystemPrompt(): string {
    return `你是一个科技新闻摘要助手。你的任务是将 AI 公司的新闻文章总结为简洁、信息量大的中文摘要。

要求：
1. 使用 Markdown 格式
2. 保持客观，不添加个人观点
3. 突出关键信息：产品名称、核心功能、技术亮点、影响范围
4. 省略营销性描述和无关细节
5. 如果是更新/版本发布，列出主要变更点（使用无序列表）
6. 确保核心内容完整传达，不要为了压缩字数而丢失关键信息
7. 字数控制在 300 词以内，但优先保证内容完整性`;
  }

  /**
   * 构建用户提示词
   */
  protected getUserPrompt(article: Article, content: string): string {
    return `请总结以下文章：

标题：${article.title}
链接：${article.url}
内容：
${content.slice(0, 8000)}`; // 限制内容长度避免超出上下文
  }

  /**
   * 辅助方法：带超时的 fetch
   */
  protected async fetchWithTimeout(url: string, options: RequestInit): Promise<Response> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeoutMs);

    try {
      const response = await fetch(url, {
        ...options,
        signal: controller.signal,
      });
      return response;
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        throw new Error('LLM_TIMEOUT');
      }
      throw error;
    } finally {
      clearTimeout(timeoutId);
    }
  }

  /**
   * 清理 LLM 输出
   */
  protected cleanOutput(content: string): string {
    return content
      .trim()
      .replace(/^```markdown\n?/i, '')
      .replace(/\n?```$/i, '')
      .trim();
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add packages/api/src/providers/base.ts
git commit -m "feat: add LLM provider base interface"
```

### Task 15: 创建 Cloudflare Workers AI Provider

**Files:**
- Create: `packages/api/src/providers/cloudflare.ts`

- [ ] **Step 1: 创建 Cloudflare Provider**

```typescript
import { AppError } from '../utils/errors.js';
import { BaseLLMProvider } from './base.js';
import type { Article, Env, LLMMessage } from '../types.js';

/**
 * Cloudflare Workers AI Provider
 * 使用 Cloudflare 托管的 Llama 模型
 */
export class CloudflareLLMProvider extends BaseLLMProvider {
  private env: Env;

  constructor(env: Env) {
    const model = env.LLM_MODEL || '@cf/meta/llama-4-scout-17b-16e-instruct';
    const timeoutMs = parseInt(env.LLM_TIMEOUT_MS, 10) || 30000;
    super(model, timeoutMs);
    this.env = env;
  }

  async summarize(article: Article): Promise<string> {
    const content = article.content || '';

    if (!content) {
      // 如果没有内容，返回简单的标题摘要
      return `# ${article.title}\n\n原文链接：${article.url}`;
    }

    const messages: LLMMessage[] = [
      { role: 'system', content: this.getSystemPrompt() },
      { role: 'user', content: this.getUserPrompt(article, content) },
    ];

    try {
      // 使用 Cloudflare Workers AI API
      const response = await this.env.AI.run(this.model as any, {
        messages,
        max_tokens: this.maxTokens,
        temperature: this.temperature,
      });

      if (!response || !response.response) {
        throw new AppError('LLM_EMPTY_RESPONSE');
      }

      return this.cleanOutput(response.response);
    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }

      const errorMessage = error instanceof Error ? error.message : String(error);

      // 根据错误类型分类
      if (errorMessage.includes('timeout') || errorMessage.includes('TIMEOUT')) {
        throw new AppError('LLM_TIMEOUT', error instanceof Error ? error : undefined);
      }

      if (errorMessage.includes('rate limit') || errorMessage.includes('RATE_LIMIT')) {
        throw new AppError('LLM_RATE_LIMITED', error instanceof Error ? error : undefined);
      }

      throw new AppError('LLM_REQUEST_FAILED', error instanceof Error ? error : undefined);
    }
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add packages/api/src/providers/cloudflare.ts
git commit -m "feat: add Cloudflare Workers AI provider"
```

### Task 16: 创建 Scraper 服务

**Files:**
- Create: `packages/api/src/services/scraper.ts`

- [ ] **Step 1: 创建 Scraper 服务**

```typescript
import { AppError } from '../utils/errors.js';
import { OpenAISourceParser } from '../sources/openai.js';
import { AnthropicSourceParser } from '../sources/anthropic.js';
import type { Article, SourceType, Env } from '../types.js';

export interface ScrapingResult {
  source: SourceType;
  articles: Article[];
  errors: AppError[];
}

/**
 * 抓取服务 - 负责从各个数据源抓取文章
 */
export class ScraperService {
  private timeoutMs: number;

  constructor(env: Env) {
    this.timeoutMs = parseInt(env.SCRAPER_TIMEOUT_MS, 10) || 15000;
  }

  /**
   * 从指定数据源抓取文章
   * @param source - 数据源类型
   * @param filterRecentHours - 只保留最近 N 小时的文章
   */
  async scrapeSource(source: SourceType, filterRecentHours: number = 24): Promise<ScrapingResult> {
    const errors: AppError[] = [];

    try {
      const parser = this.createParser(source);
      let articles = await parser.fetchArticles(this.timeoutMs);

      // 获取文章正文（如果 RSS 中没有）
      for (const article of articles) {
        if (!article.content) {
          try {
            article.content = await parser.fetchArticleContent(article.url, this.timeoutMs);
          } catch (error) {
            // 正文获取失败不是致命错误，继续处理
            console.warn(`Failed to fetch content for ${article.url}:`, error);
          }
        }
      }

      // 过滤最近的文章
      const cutoff = new Date();
      cutoff.setHours(cutoff.getHours() - filterRecentHours);

      articles = articles.filter(article => {
        const published = new Date(article.publishedAt);
        return published >= cutoff;
      });

      return { source, articles, errors };
    } catch (error) {
      if (error instanceof AppError) {
        errors.push(error);
      } else {
        errors.push(new AppError('SOURCE_FETCH_FAILED', error instanceof Error ? error : undefined));
      }
      return { source, articles: [], errors };
    }
  }

  /**
   * 从所有数据源抓取文章
   */
  async scrapeAll(filterRecentHours: number = 24): Promise<ScrapingResult[]> {
    const sources: SourceType[] = ['openai', 'anthropic'];

    // 顺序抓取，避免并发限制
    const results: ScrapingResult[] = [];
    for (const source of sources) {
      const result = await this.scrapeSource(source, filterRecentHours);
      results.push(result);
    }

    return results;
  }

  private createParser(source: SourceType) {
    switch (source) {
      case 'openai':
        return new OpenAISourceParser();
      case 'anthropic':
        return new AnthropicSourceParser();
      default:
        throw new AppError('VALIDATION_INVALID_SOURCE');
    }
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add packages/api/src/services/scraper.ts
git commit -m "feat: add scraper service"
```

### Task 17: 创建 Summarizer 服务

**Files:**
- Create: `packages/api/src/services/summarizer.ts`

- [ ] **Step 1: 创建 Summarizer 服务**

```typescript
import { AppError } from '../utils/errors.js';
import { CloudflareLLMProvider } from '../providers/cloudflare.js';
import type { Article, ArticleSummary, SourceType, Env } from '../types.js';

export interface SummarizationResult {
  summary: ArticleSummary;
  isNew: boolean;
}

export interface SummarizerStats {
  totalFound: number;
  summarized: number;
  skippedDuplicate: number;
  skippedIncomplete: number;
  errors: string[];
}

/**
 * 总结服务 - 负责调用 LLM 生成摘要
 */
export class SummarizerService {
  private provider: CloudflareLLMProvider;
  private maxRetries: number = 2;
  private retryDelays: number[] = [1000, 3000]; // ms

  constructor(env: Env) {
    this.provider = new CloudflareLLMProvider(env);
  }

  /**
   * 为单篇文章生成摘要
   * @param article - 原始文章
   * @param isDuplicate - 是否已存在（如果存在则跳过 LLM 调用）
   */
  async summarize(
    article: Article,
    isDuplicate: boolean = false
  ): Promise<SummarizationResult | null> {
    // 如果已存在，直接返回原摘要
    if (isDuplicate) {
      return null; // 表示跳过
    }

    // 验证文章数据完整性
    if (!article.title || !article.url) {
      throw new AppError('SOURCE_ARTICLE_INCOMPLETE');
    }

    // 重试逻辑
    let lastError: AppError | null = null;

    for (let attempt = 0; attempt <= this.maxRetries; attempt++) {
      try {
        const summaryText = await this.provider.summarize(article);

        const summary: ArticleSummary = {
          ...article,
          summaryMd: summaryText,
          summarizedAt: new Date().toISOString(),
        };

        return { summary, isNew: true };
      } catch (error) {
        if (error instanceof AppError) {
          lastError = error;

          // 只有可重试的错误才重试
          if (!error.retryable || attempt >= this.maxRetries) {
            break;
          }

          // 等待后重试
          if (attempt < this.maxRetries) {
            await this.delay(this.retryDelays[attempt] || 3000);
          }
        } else {
          lastError = new AppError('LLM_REQUEST_FAILED', error instanceof Error ? error : undefined);
          break;
        }
      }
    }

    throw lastError || new AppError('LLM_REQUEST_FAILED');
  }

  /**
   * 批量总结文章
   * @param articles - 文章列表
   * @param existingIds - 已存在的文章 ID 集合
   */
  async summarizeBatch(
    articles: Article[],
    existingIds: Set<string>
  ): Promise<{ results: ArticleSummary[]; stats: SummarizerStats }> {
    const results: ArticleSummary[] = [];
    const stats: SummarizerStats = {
      totalFound: articles.length,
      summarized: 0,
      skippedDuplicate: 0,
      skippedIncomplete: 0,
      errors: [],
    };

    for (const article of articles) {
      try {
        // 检查是否已存在
        if (existingIds.has(article.id)) {
          stats.skippedDuplicate++;
          continue;
        }

        // 验证完整性
        if (!article.title || !article.url) {
          stats.skippedIncomplete++;
          continue;
        }

        // 生成摘要
        const result = await this.summarize(article, false);

        if (result && result.isNew) {
          results.push(result.summary);
          stats.summarized++;
        }
      } catch (error) {
        const errorMsg = error instanceof AppError
          ? `${error.code}: ${error.message}`
          : String(error);
        stats.errors.push(`Article "${article.title}": ${errorMsg}`);
      }
    }

    return { results, stats };
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add packages/api/src/services/summarizer.ts
git commit -m "feat: add summarizer service with retry logic"
```

---

## Chunk 7: API 路由

### Task 18: 创建 /articles 路由处理

**Files:**
- Create: `packages/api/src/routes/articles.ts`

- [ ] **Step 1: 创建 articles 路由**

```typescript
import { AppError } from '../utils/errors.js';
import { articlesResponse, errorResponse } from '../utils/response.js';
import { StorageService } from '../services/storage.js';
import type { ArticlesQueryParams, ArticlesResponse, Env, SourceType } from '../types.js';

// 查询参数验证
const VALID_SOURCES: SourceType[] = ['openai', 'anthropic'];
const MAX_PAGE_SIZE = 50;
const DEFAULT_PAGE_SIZE = 10;
const MAX_DAYS = 7;

/**
 * 处理 GET /articles 请求
 */
export async function handleArticles(request: Request, env: Env): Promise<Response> {
  try {
    // 解析查询参数
    const url = new URL(request.url);
    const params = parseQueryParams(url.searchParams);

    // 计算日期范围
    const { fromDate, toDate } = calculateDateRange(params);

    // 查询存储
    const storage = new StorageService(env);
    const summaries = await storage.getSummariesByDateRange(
      fromDate,
      toDate,
      params.source
    );

    // 分页
    const totalCount = summaries.length;
    const totalPages = Math.ceil(totalCount / params.pageSize);
    const startIndex = (params.page - 1) * params.pageSize;
    const endIndex = startIndex + params.pageSize;
    const paginatedArticles = summaries.slice(startIndex, endIndex);

    // 确定包含的数据源
    const sourcesIncluded = params.source
      ? [params.source]
      : [...new Set(summaries.map(s => s.source))];

    // 获取最后刷新时间
    const lastRefreshedAt = await storage.getLastRefreshed();

    const response: ArticlesResponse = {
      success: true,
      data: {
        articles: paginatedArticles,
      },
      meta: {
        page: params.page,
        pageSize: params.pageSize,
        totalCount,
        totalPages,
        sourcesIncluded,
        dateRange: { from: fromDate, to: toDate },
        lastRefreshedAt,
      },
    };

    return articlesResponse(response);
  } catch (error) {
    if (error instanceof AppError) {
      return errorResponse(error);
    }
    return errorResponse(new AppError('INTERNAL_ERROR', error instanceof Error ? error : undefined));
  }
}

function parseQueryParams(searchParams: URLSearchParams): ArticlesQueryParams {
  const params: ArticlesQueryParams = {};

  // date 参数
  const date = searchParams.get('date');
  if (date) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || isNaN(new Date(date).getTime())) {
      throw new AppError('VALIDATION_INVALID_DATE');
    }
    params.date = date;
  }

  // source 参数
  const source = searchParams.get('source');
  if (source) {
    if (!VALID_SOURCES.includes(source as SourceType)) {
      throw new AppError('VALIDATION_INVALID_SOURCE');
    }
    params.source = source as SourceType;
  }

  // days 参数
  const days = searchParams.get('days');
  if (days) {
    const daysNum = parseInt(days, 10);
    if (isNaN(daysNum) || daysNum < 1 || daysNum > MAX_DAYS) {
      throw new AppError('VALIDATION_INVALID_DAYS');
    }
    params.days = daysNum;
  }

  // page 参数
  const page = searchParams.get('page');
  if (page) {
    const pageNum = parseInt(page, 10);
    if (isNaN(pageNum) || pageNum < 1) {
      throw new AppError('VALIDATION_INVALID_PAGE');
    }
    params.page = pageNum;
  }

  // page_size 参数
  const pageSize = searchParams.get('page_size');
  if (pageSize) {
    const sizeNum = parseInt(pageSize, 10);
    if (isNaN(sizeNum) || sizeNum < 1 || sizeNum > MAX_PAGE_SIZE) {
      throw new AppError('VALIDATION_INVALID_PAGE_SIZE');
    }
    params.pageSize = sizeNum;
  }

  return params;
}

function calculateDateRange(params: ArticlesQueryParams): { fromDate: string; toDate: string } {
  const days = params.days || 1;

  if (params.date) {
    // 指定了具体日期，返回该日期当天
    return { fromDate: params.date, toDate: params.date };
  }

  // 计算最近 N 天的范围
  const toDate = new Date();
  const fromDate = new Date();
  fromDate.setDate(fromDate.getDate() - days + 1);

  return {
    fromDate: fromDate.toISOString().slice(0, 10),
    toDate: toDate.toISOString().slice(0, 10),
  };
}
```

- [ ] **Step 2: Commit**

```bash
git add packages/api/src/routes/articles.ts
git commit -m "feat: add GET /articles endpoint with pagination"
```

### Task 19: 创建 /refresh 路由处理

**Files:**
- Create: `packages/api/src/routes/refresh.ts`

- [ ] **Step 1: 创建 refresh 路由**

```typescript
import { AppError } from '../utils/errors.js';
import { refreshResponse, errorResponse } from '../utils/response.js';
import { StorageService } from '../services/storage.js';
import { ScraperService } from '../services/scraper.js';
import { SummarizerService } from '../services/summarizer.js';
import type { RefreshRequest, RefreshResponse, Env, SourceType } from '../types.js';

const VALID_SOURCES: SourceType[] = ['openai', 'anthropic'];

/**
 * 处理 POST /refresh 请求
 */
export async function handleRefresh(request: Request, env: Env): Promise<Response> {
  try {
    // 解析请求体
    const body = await parseRequestBody(request);

    // 确定要刷新的数据源
    const sourcesToRefresh = body.source
      ? [body.source]
      : VALID_SOURCES;

    const storage = new StorageService(env);
    const scraper = new ScraperService(env);
    const summarizer = new SummarizerService(env);

    const refreshedSources: SourceType[] = [];
    let totalFound = 0;
    let totalSummarized = 0;
    let totalSkippedDuplicate = 0;
    let totalSkippedIncomplete = 0;
    const allErrors: string[] = [];

    // 依次处理每个数据源
    for (const source of sourcesToRefresh) {
      try {
        // 1. 抓取文章
        const scrapeResult = await scraper.scrapeSource(source, 24);

        if (scrapeResult.errors.length > 0) {
          allErrors.push(...scrapeResult.errors.map(e => `[${source}] ${e.code}: ${e.message}`));
        }

        if (scrapeResult.articles.length === 0) {
          continue;
        }

        totalFound += scrapeResult.articles.length;
        refreshedSources.push(source);

        // 2. 检查重复
        const existingIds = new Set<string>();
        for (const article of scrapeResult.articles) {
          const date = article.publishedAt.slice(0, 10);
          const exists = await storage.hasSummary(source, date, article.id);
          if (exists) {
            existingIds.add(article.id);
          }
        }

        // 3. 生成摘要
        const { results, stats } = await summarizer.summarizeBatch(
          scrapeResult.articles,
          existingIds
        );

        // 4. 保存到 KV
        for (const summary of results) {
          const date = summary.publishedAt.slice(0, 10);
          await storage.saveSummary(summary);
          await storage.addToIndex(date, source, summary.id);
        }

        totalSummarized += stats.summarized;
        totalSkippedDuplicate += stats.skippedDuplicate;
        totalSkippedIncomplete += stats.skippedIncomplete;
        allErrors.push(...stats.errors);
      } catch (error) {
        const errorMsg = error instanceof AppError
          ? `${error.code}: ${error.message}`
          : String(error);
        allErrors.push(`[${source}] ${errorMsg}`);
      }
    }

    // 5. 更新最后刷新时间
    await storage.setLastRefreshed(new Date().toISOString());

    // 6. 清理过期数据
    try {
      const cleanupResult = await storage.cleanupOldData();
      if (cleanupResult.errors.length > 0) {
        console.warn('Cleanup errors:', cleanupResult.errors);
      }
    } catch (error) {
      console.error('Cleanup failed:', error);
    }

    const response: RefreshResponse = {
      success: true,
      data: {
        refreshedSources,
        articlesFound: totalFound,
        articlesSummarized: totalSummarized,
        articlesSkipped: {
          duplicate: totalSkippedDuplicate,
          incompleteMetadata: totalSkippedIncomplete,
        },
        errors: allErrors,
      },
    };

    return refreshResponse(response);
  } catch (error) {
    if (error instanceof AppError) {
      return errorResponse(error);
    }
    return errorResponse(new AppError('INTERNAL_ERROR', error instanceof Error ? error : undefined));
  }
}

async function parseRequestBody(request: Request): Promise<RefreshRequest> {
  try {
    const body = await request.json() as RefreshRequest;

    // 验证 source 参数
    if (body.source && !VALID_SOURCES.includes(body.source)) {
      throw new AppError('VALIDATION_INVALID_SOURCE');
    }

    return body;
  } catch (error) {
    if (error instanceof AppError) {
      throw error;
    }
    // 空请求体或解析错误，返回空对象（刷新所有源）
    return {};
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add packages/api/src/routes/refresh.ts
git commit -m "feat: add POST /refresh endpoint"
```

---

## Chunk 8: Worker 入口与 Cron 处理

### Task 20: 创建 Worker 入口

**Files:**
- Create: `packages/api/src/index.ts`

- [ ] **Step 1: 创建 Worker 入口**

```typescript
import { authenticate } from './middleware/auth.js';
import { checkRateLimit } from './middleware/rateLimit.js';
import { handleArticles } from './routes/articles.js';
import { handleRefresh } from './routes/refresh.js';
import { errorResponse } from './utils/response.js';
import { AppError } from './utils/errors.js';
import type { Env } from './types.js';

// 导出默认对象，包含 fetch 和 scheduled 处理器
export default {
  /**
   * HTTP 请求处理器
   */
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    try {
      // CORS 预检请求处理
      if (request.method === 'OPTIONS') {
        return new Response(null, {
          status: 204,
          headers: {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
            'Access-Control-Allow-Headers': 'Authorization, Content-Type',
          },
        });
      }

      // 认证检查
      await authenticate(request, env);

      // 限流检查
      await checkRateLimit(env);

      // 路由分发
      const url = new URL(request.url);
      const path = url.pathname;

      // GET /articles
      if (path === '/articles' && request.method === 'GET') {
        return handleArticles(request, env);
      }

      // POST /refresh
      if (path === '/refresh' && request.method === 'POST') {
        return handleRefresh(request, env);
      }

      // 404 处理
      return new Response(
        JSON.stringify({ success: false, error: { message: 'Not Found' } }),
        { status: 404, headers: { 'Content-Type': 'application/json' } }
      );
    } catch (error) {
      if (error instanceof AppError) {
        return errorResponse(error);
      }

      console.error('Unhandled error:', error);
      return errorResponse(new AppError('INTERNAL_ERROR'));
    }
  },

  /**
   * Cron 定时任务处理器
   * 每天 UTC 06:00 自动触发
   */
  async scheduled(event: ScheduledEvent, env: Env, ctx: ExecutionContext): Promise<void> {
    console.log('Cron triggered at:', new Date().toISOString());

    try {
      // 创建一个模拟的 POST /refresh 请求
      const refreshRequest = new Request('https://monopage-api.workers.dev/refresh', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${env.API_TOKEN}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({}),
      });

      const response = await this.fetch(refreshRequest, env, ctx);

      if (response.ok) {
        const result = await response.json();
        console.log('Cron refresh completed:', JSON.stringify(result, null, 2));
      } else {
        const error = await response.json();
        console.error('Cron refresh failed:', JSON.stringify(error, null, 2));
      }
    } catch (error) {
      console.error('Cron execution error:', error);
    }
  },
};
```

- [ ] **Step 2: Commit**

```bash
git add packages/api/src/index.ts
git commit -m "feat: add worker entry point with routing and cron handler"
```

---

## Chunk 9: 开发环境配置

### Task 21: 安装依赖并配置开发环境

**Files:**
- Modify: `packages/api/package.json` (添加 scripts)

- [ ] **Step 1: 安装依赖**

```bash
cd packages/api && pnpm install
```

Expected: 安装 zod、@cloudflare/workers-types、wrangler 等依赖

- [ ] **Step 2: 更新 package.json 添加类型检查脚本**

Modify `packages/api/package.json`:

```json
{
  "name": "@monopage/api",
  "version": "1.0.0",
  "type": "module",
  "main": "src/index.ts",
  "scripts": {
    "dev": "wrangler dev",
    "deploy": "wrangler deploy",
    "build": "wrangler build",
    "typecheck": "tsc --noEmit"
  },
  "dependencies": {
    "zod": "^3.22.0"
  },
  "devDependencies": {
    "@cloudflare/workers-types": "^4.20240316.0",
    "typescript": "^5.0.0",
    "wrangler": "^3.0.0"
  }
}
```

- [ ] **Step 3: 创建 .dev.vars 模板文件**

Create `packages/api/.dev.vars`:

```
API_TOKEN=your-dev-api-token
```

- [ ] **Step 4: Commit**

```bash
git add packages/api/.dev.vars packages/api/package.json
git commit -m "chore: configure development environment"
```

---

## 实施完成

所有任务完成后，Monopage Backend 将具备以下功能：

1. **Monorepo 结构**: pnpm workspace 管理
2. **类型安全**: 完整的 TypeScript 类型定义
3. **错误处理**: 统一的错误码和响应格式
4. **认证与限流**: Bearer Token 认证 + 全局限流
5. **数据抓取**: OpenAI RSS + Anthropic 页面解析
6. **LLM 摘要**: Cloudflare Workers AI (Llama 4 Scout)
7. **KV 存储**: 文章摘要、索引、元数据存储
8. **REST API**:
   - GET /articles - 分页查询摘要列表
   - POST /refresh - 手动触发抓取刷新
9. **定时任务**: Cron Trigger 每日自动抓取
10. **数据清理**: 自动清理 7 天前的过期数据

---

**Plan complete and saved to `docs/superpowers/plans/2026-03-16-monopage-backend-implementation.md`. Ready to execute?**

执行路径：
- 使用 superpowers:subagent-driven-development (如果有 subagents)
- 或在当前会话使用 superpowers:executing-plans
