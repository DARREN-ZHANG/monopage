# 前端交互优化实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 实现 FilterBar 下拉多选重构、Toast 系统集成、异步刷新状态管理

**Architecture:** 前端使用 React + TanStack Query + sonner，后端使用 Cloudflare Workers + Queues + KV 实现异步刷新

**Tech Stack:** React 18, TypeScript, TanStack Query, Tailwind CSS, sonner, Cloudflare Workers, Cloudflare Queues, KV

**Spec:** `docs/superpowers/specs/2026-03-18-frontend-interaction-design.md`

---

## File Structure

```
packages/
├── api/
│   ├── wrangler.toml              # [Modify] 添加 Queue 配置
│   ├── src/
│   │   ├── index.ts               # [Modify] 添加 queue handler + 路由
│   │   ├── types.ts               # [Modify] 添加刷新状态类型
│   │   ├── routes/
│   │   │   └── refresh.ts         # [Modify] 重构为异步刷新
│   │   └── services/
│   │       └── storage.ts         # [Modify] 添加刷新状态存储方法
│
└── web/
    ├── package.json               # [Modify] 添加 sonner
    ├── src/
    │   ├── App.tsx                # [Modify] 添加 Toaster + 集成刷新逻辑
    │   ├── types/
    │   │   └── index.ts           # [Modify] 添加刷新状态类型
    │   ├── api/
    │   │   └── client.ts          # [Modify] 添加 getRefreshStatus
    │   ├── hooks/
    │   │   └── useRefreshStatus.ts # [Create] 刷新状态轮询 Hook
    │   └── components/
    │       └── Articles/
    │           ├── FilterBar.tsx       # [Rewrite] 下拉多选 + Tag
    │           ├── SourceDropdown.tsx  # [Create] 下拉面板组件
    │           └── SelectedTags.tsx    # [Create] Tag 展示组件
```

---

## Phase 1: 后端 - Cloudflare Queue 配置

### Task 1.1: 创建 Cloudflare Queue

**Files:** None (Cloudflare CLI)

- [ ] **Step 1: 创建 refresh-queue**

Run:
```bash
cd packages/api && npx wrangler queues create refresh-queue
```

Expected: 输出 "Created queue refresh-queue"

---

### Task 1.2: 更新 wrangler.toml 配置

**Files:** Modify `packages/api/wrangler.toml`

- [ ] **Step 1: 添加 Queue 配置到 wrangler.toml**

在 `packages/api/wrangler.toml` 末尾添加：

```toml
# Queue 配置 - 异步刷新
[[queues.producers]]
queue = "refresh-queue"
binding = "REFRESH_QUEUE"

[[queues.consumers]]
queue = "refresh-queue"
max_batch_size = 1
max_batch_timeout = 1
```

- [ ] **Step 2: Commit 配置变更**

```bash
git add packages/api/wrangler.toml
git commit -m "chore(api): add Cloudflare Queue configuration for async refresh"
```

---

### Task 1.3: 添加后端类型定义

**Files:** Modify `packages/api/src/types.ts`

- [ ] **Step 1: 添加刷新状态相关类型**

在 `packages/api/src/types.ts` 末尾添加：

```typescript
// ===== 刷新队列相关类型 =====

// Queue 消息
export interface RefreshMessage {
  taskId: string;
  timestamp: string;
}

// 刷新任务状态
export type RefreshTaskStatus = 'pending' | 'running' | 'completed' | 'failed';

// 刷新进度
export interface RefreshTaskProgress {
  current: number;
  total: number;
  currentSource: SourceType;
}

// 刷新任务状态
export interface RefreshTaskState {
  taskId: string;
  status: RefreshTaskStatus;
  startedAt: string;
  completedAt?: string;
  progress?: RefreshTaskProgress;
  result?: RefreshResponse['data'];
  error?: string;
}

// API 响应类型
export interface RefreshTriggerResponse {
  success: true;
  data: {
    taskId: string;
    status: 'pending';
  };
}

export interface RefreshStatusResponse {
  success: true;
  data: RefreshTaskState;
}
```

- [ ] **Step 2: 更新 Env 接口**

修改 `packages/api/src/types.ts` 中的 `Env` 接口，添加：

```typescript
export interface Env {
  KV: KVNamespace;
  AI: Ai;
  REFRESH_QUEUE: Queue<RefreshMessage>;  // 新增
  API_TOKEN?: string;
  JWT_SECRET?: string;
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

- [ ] **Step 3: Commit 类型定义**

```bash
git add packages/api/src/types.ts
git commit -m "feat(api): add refresh queue types"
```

---

### Task 1.4: 添加刷新状态存储方法

**Files:** Modify `packages/api/src/services/storage.ts`

- [ ] **Step 1: 添加刷新状态相关常量和方法**

在 `packages/api/src/services/storage.ts` 中添加：

```typescript
// 在类的顶部添加常量
private readonly REFRESH_STATUS_PREFIX = 'refresh:status';
private readonly REFRESH_CURRENT_KEY = 'refresh:current';
private readonly REFRESH_STATUS_TTL = 3600; // 1 hour
private readonly REFRESH_TIMEOUT_MS = 5 * 60 * 1000; // 5 minutes

// ===== 刷新状态管理 =====

/**
 * 保存刷新任务状态
 */
async saveRefreshTaskState(state: RefreshTaskState): Promise<void> {
  const key = `${this.REFRESH_STATUS_PREFIX}:${state.taskId}`;
  try {
    await this.kv.put(key, JSON.stringify(state), {
      expirationTtl: this.REFRESH_STATUS_TTL,
    });
  } catch (error) {
    throw new AppError('KV_WRITE_FAILED', error instanceof Error ? error : undefined);
  }
}

/**
 * 获取刷新任务状态
 */
async getRefreshTaskState(taskId: string): Promise<RefreshTaskState | null> {
  const key = `${this.REFRESH_STATUS_PREFIX}:${taskId}`;
  try {
    const value = await this.kv.get(key);
    return value ? JSON.parse(value) as RefreshTaskState : null;
  } catch (error) {
    throw new AppError('KV_READ_FAILED', error instanceof Error ? error : undefined);
  }
}

/**
 * 设置当前刷新任务 ID
 */
async setCurrentRefreshTask(taskId: string): Promise<void> {
  try {
    await this.kv.put(this.REFRESH_CURRENT_KEY, taskId, {
      expirationTtl: this.REFRESH_STATUS_TTL,
    });
  } catch (error) {
    throw new AppError('KV_WRITE_FAILED', error instanceof Error ? error : undefined);
  }
}

/**
 * 获取当前刷新任务 ID
 */
async getCurrentRefreshTask(): Promise<string | null> {
  try {
    return await this.kv.get(this.REFRESH_CURRENT_KEY);
  } catch {
    return null;
  }
}

/**
 * 清除当前刷新任务 ID
 */
async clearCurrentRefreshTask(): Promise<void> {
  try {
    await this.kv.delete(this.REFRESH_CURRENT_KEY);
  } catch {
    // 忽略删除错误
  }
}

/**
 * 检查刷新任务是否超时
 */
isRefreshTimedOut(startedAt: string): boolean {
  const started = new Date(startedAt).getTime();
  return Date.now() - started > this.REFRESH_TIMEOUT_MS;
}
```

- [ ] **Step 2: 添加必要的导入**

在文件顶部添加：

```typescript
import type { RefreshTaskState } from '../types.js';
import { AppError } from '../utils/errors.js';
```

- [ ] **Step 3: Commit 存储方法**

```bash
git add packages/api/src/services/storage.ts
git commit -m "feat(api): add refresh task state storage methods"
```

---

## Phase 2: 后端 - 异步刷新 API

### Task 2.1: 重构 refresh.ts - 触发刷新

**Files:** Modify `packages/api/src/routes/refresh.ts`

- [ ] **Step 1: 重写 refresh.ts**

完全重写 `packages/api/src/routes/refresh.ts`：

```typescript
import { AppError } from '../utils/errors.js';
import { errorResponse, jsonResponse } from '../utils/response.js';
import { StorageService } from '../services/storage.js';
import { ScraperService } from '../services/scraper.js';
import { SummarizerService } from '../services/summarizer.js';
import type {
  RefreshTaskState,
  RefreshTaskProgress,
  RefreshTriggerResponse,
  RefreshStatusResponse,
  RefreshResponse,
  Env,
  SourceType,
} from '../types.js';

const VALID_SOURCES: SourceType[] = ['openai', 'anthropic', 'codex', 'opencode'];

/**
 * POST /refresh - 触发异步刷新任务
 */
export async function handleRefreshTrigger(
  request: Request,
  env: Env
): Promise<Response> {
  try {
    const storage = new StorageService(env);

    // 检查是否有进行中的任务
    const currentTaskId = await storage.getCurrentRefreshTask();
    if (currentTaskId) {
      const existingState = await storage.getRefreshTaskState(currentTaskId);
      if (existingState) {
        // 检查是否超时
        if (storage.isRefreshTimedOut(existingState.startedAt)) {
          // 超时，清除并继续创建新任务
          await storage.clearCurrentRefreshTask();
        } else if (
          existingState.status === 'pending' ||
          existingState.status === 'running'
        ) {
          // 返回现有任务
          const response: RefreshTriggerResponse = {
            success: true,
            data: { taskId: currentTaskId, status: existingState.status },
          };
          return jsonResponse(response);
        }
      }
    }

    // 创建新任务
    const taskId = `rf_${Date.now()}`;
    const taskState: RefreshTaskState = {
      taskId,
      status: 'pending',
      startedAt: new Date().toISOString(),
    };

    // 存储状态
    await storage.saveRefreshTaskState(taskState);
    await storage.setCurrentRefreshTask(taskId);

    // 发送到队列
    await env.REFRESH_QUEUE.send({
      taskId,
      timestamp: new Date().toISOString(),
    });

    const response: RefreshTriggerResponse = {
      success: true,
      data: { taskId, status: 'pending' },
    };
    return jsonResponse(response);
  } catch (error) {
    if (error instanceof AppError) {
      return errorResponse(error);
    }
    return errorResponse(
      new AppError('INTERNAL_ERROR', error instanceof Error ? error : undefined)
    );
  }
}

/**
 * GET /refresh/status - 查询刷新状态
 */
export async function handleRefreshStatus(
  request: Request,
  env: Env
): Promise<Response> {
  try {
    const url = new URL(request.url);
    const taskId = url.searchParams.get('taskId');

    if (!taskId) {
      return errorResponse(new AppError('MISSING_TASK_ID', 'taskId is required'));
    }

    const storage = new StorageService(env);
    const state = await storage.getRefreshTaskState(taskId);

    if (!state) {
      return errorResponse(new AppError('TASK_NOT_FOUND', 'Task not found'));
    }

    const response: RefreshStatusResponse = {
      success: true,
      data: state,
    };
    return jsonResponse(response);
  } catch (error) {
    if (error instanceof AppError) {
      return errorResponse(error);
    }
    return errorResponse(
      new AppError('INTERNAL_ERROR', error instanceof Error ? error : undefined)
    );
  }
}

/**
 * 处理队列消息 - 执行刷新任务
 */
export async function processRefreshMessage(
  message: { taskId: string; timestamp: string },
  env: Env
): Promise<void> {
  const { taskId } = message;
  const storage = new StorageService(env);

  // 更新状态为 running
  let state = await storage.getRefreshTaskState(taskId);
  if (!state) {
    console.error(`Task ${taskId} not found`);
    return;
  }

  state = { ...state, status: 'running' };
  await storage.saveRefreshTaskState(state);

  try {
    // 执行刷新逻辑
    const result = await runRefreshWithProgress(env, taskId, storage);

    // 更新状态为 completed
    state = await storage.getRefreshTaskState(taskId);
    if (state) {
      state = {
        ...state,
        status: 'completed',
        completedAt: new Date().toISOString(),
        result,
      };
      await storage.saveRefreshTaskState(state);
    }
  } catch (error) {
    // 更新状态为 failed
    state = await storage.getRefreshTaskState(taskId);
    if (state) {
      state = {
        ...state,
        status: 'failed',
        completedAt: new Date().toISOString(),
        error: error instanceof Error ? error.message : 'Unknown error',
      };
      await storage.saveRefreshTaskState(state);
    }
  } finally {
    // 清除当前任务标记
    await storage.clearCurrentRefreshTask();
  }
}

/**
 * 带进度更新的刷新逻辑
 */
async function runRefreshWithProgress(
  env: Env,
  taskId: string,
  storage: StorageService
): Promise<RefreshResponse['data']> {
  const scraper = new ScraperService(env);
  const summarizer = new SummarizerService(env);

  const sourcesToRefresh = VALID_SOURCES;
  const total = sourcesToRefresh.length;
  let current = 0;

  const refreshedSources: SourceType[] = [];
  let totalFound = 0;
  let totalSummarized = 0;
  let totalSkippedDuplicate = 0;
  let totalSkippedIncomplete = 0;
  const allErrors: string[] = [];

  for (const source of sourcesToRefresh) {
    current++;

    // 更新进度
    const progress: RefreshTaskProgress = {
      current,
      total,
      currentSource: source,
    };
    let state = await storage.getRefreshTaskState(taskId);
    if (state) {
      state = { ...state, progress };
      await storage.saveRefreshTaskState(state);
    }

    try {
      const scrapeResult = await scraper.scrapeSource(source, 24 * 7);

      if (scrapeResult.errors.length > 0) {
        allErrors.push(
          ...scrapeResult.errors.map((e) => `[${source}] ${e.code}: ${e.message}`)
        );
      }

      if (scrapeResult.articles.length === 0) {
        continue;
      }

      totalFound += scrapeResult.articles.length;
      refreshedSources.push(source);

      const existingIds = await storage.getExistingIdsBySource(source);
      const { results, stats } = await summarizer.summarizeBatch(
        scrapeResult.articles,
        existingIds
      );

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
      const errorMsg =
        error instanceof AppError
          ? `${error.code}: ${error.message}`
          : String(error);
      allErrors.push(`[${source}] ${errorMsg}`);
    }
  }

  await storage.setLastRefreshed(new Date().toISOString());

  // 清理旧数据
  try {
    const cleanupResult = await storage.cleanupOldData();
    if (cleanupResult.errors.length > 0) {
      console.warn('Cleanup errors:', cleanupResult.errors);
    }
  } catch (error) {
    console.error('Cleanup failed:', error);
  }

  return {
    refreshed_sources: refreshedSources,
    articles_found: totalFound,
    articles_summarized: totalSummarized,
    articles_skipped: {
      duplicate: totalSkippedDuplicate,
      incomplete_metadata: totalSkippedIncomplete,
    },
    errors: allErrors,
  };
}

// 保留原有的 runRefresh 用于 cron
export async function runRefresh(
  env: Env,
  sourceFilter?: SourceType
): Promise<RefreshResponse['data']> {
  const sourcesToRefresh = sourceFilter ? [sourceFilter] : VALID_SOURCES;
  const storage = new StorageService(env);
  const scraper = new ScraperService(env);
  const summarizer = new SummarizerService(env);

  const refreshedSources: SourceType[] = [];
  let totalFound = 0;
  let totalSummarized = 0;
  let totalSkippedDuplicate = 0;
  let totalSkippedIncomplete = 0;
  const allErrors: string[] = [];

  for (const source of sourcesToRefresh) {
    try {
      const scrapeResult = await scraper.scrapeSource(source, 24 * 7);

      if (scrapeResult.errors.length > 0) {
        allErrors.push(
          ...scrapeResult.errors.map((e) => `[${source}] ${e.code}: ${e.message}`)
        );
      }

      if (scrapeResult.articles.length === 0) {
        continue;
      }

      totalFound += scrapeResult.articles.length;
      refreshedSources.push(source);

      const existingIds = await storage.getExistingIdsBySource(source);
      const { results, stats } = await summarizer.summarizeBatch(
        scrapeResult.articles,
        existingIds
      );

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
      const errorMsg =
        error instanceof AppError
          ? `${error.code}: ${error.message}`
          : String(error);
      allErrors.push(`[${source}] ${errorMsg}`);
    }
  }

  await storage.setLastRefreshed(new Date().toISOString());

  try {
    const cleanupResult = await storage.cleanupOldData();
    if (cleanupResult.errors.length > 0) {
      console.warn('Cleanup errors:', cleanupResult.errors);
    }
  } catch (error) {
    console.error('Cleanup failed:', error);
  }

  return {
    refreshed_sources: refreshedSources,
    articles_found: totalFound,
    articles_summarized: totalSummarized,
    articles_skipped: {
      duplicate: totalSkippedDuplicate,
      incomplete_metadata: totalSkippedIncomplete,
    },
    errors: allErrors,
  };
}
```

- [ ] **Step 2: 更新 utils/response.ts 添加 jsonResponse**

在 `packages/api/src/utils/response.ts` 中添加：

```typescript
/**
 * 通用 JSON 响应
 */
export function jsonResponse<T>(data: T, status: number = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
    },
  });
}
```

- [ ] **Step 3: 添加错误码到 errors.ts**

在 `packages/api/src/utils/errors.ts` 的错误码映射中添加：

```typescript
'MISSING_TASK_ID': { code_num: 40001, message: 'taskId is required', retryable: false },
'TASK_NOT_FOUND': { code_num: 40002, message: 'Task not found', retryable: false },
```

- [ ] **Step 4: Commit 刷新路由重构**

```bash
git add packages/api/src/routes/refresh.ts packages/api/src/utils/response.ts packages/api/src/utils/errors.ts
git commit -m "refactor(api): implement async refresh with queue support"
```

---

### Task 2.2: 更新 index.ts - 添加路由和 queue handler

**Files:** Modify `packages/api/src/index.ts`

- [ ] **Step 1: 更新导入**

修改 `packages/api/src/index.ts` 的导入：

```typescript
import { authenticate } from './middleware/auth.js';
import { checkRateLimit } from './middleware/rateLimit.js';
import { handleArticles } from './routes/articles.js';
import { handleLogin } from './routes/login.js';
import { handleLogout } from './routes/logout.js';
import { handleMe } from './routes/me.js';
import {
  handleRefresh,
  handleRefreshTrigger,
  handleRefreshStatus,
  processRefreshMessage,
} from './routes/refresh.js';
import { errorResponse, notFoundResponse } from './utils/response.js';
import { AppError } from './utils/errors.js';
import type { Env, RefreshMessage } from './types.js';
```

- [ ] **Step 2: 更新 Worker 导出**

修改 `packages/api/src/index.ts` 的导出对象：

```typescript
export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    try {
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

      const url = new URL(request.url);
      const path = url.pathname;

      // POST /login - 无需认证
      if (path === '/login' && request.method === 'POST') {
        return handleLogin(request, env);
      }

      // POST /logout - 无需认证
      if (path === '/logout' && request.method === 'POST') {
        return handleLogout(request, env);
      }

      // GET /me
      if (path === '/me' && request.method === 'GET') {
        return handleMe(request, env);
      }

      // 以下路由需要认证和限流
      await authenticate(request, env);
      await checkRateLimit(env);

      // GET /articles
      if (path === '/articles' && request.method === 'GET') {
        return handleArticles(request, env);
      }

      // POST /refresh - 触发异步刷新
      if (path === '/refresh' && request.method === 'POST') {
        return handleRefreshTrigger(request, env);
      }

      // GET /refresh/status - 查询刷新状态
      if (path === '/refresh/status' && request.method === 'GET') {
        return handleRefreshStatus(request, env);
      }

      return notFoundResponse();
    } catch (error) {
      if (error instanceof AppError) {
        return errorResponse(error);
      }
      console.error('Unhandled error:', error);
      return errorResponse(new AppError('INTERNAL_ERROR'));
    }
  },

  async queue(batch: Message<RefreshMessage>[], env: Env, ctx: ExecutionContext): Promise<void> {
    for (const message of batch.messages) {
      try {
        await processRefreshMessage(message.body, env);
      } catch (error) {
        console.error('Queue processing error:', error);
      }
    }
  },

  async scheduled(event: ScheduledEvent, env: Env, ctx: ExecutionContext): Promise<void> {
    console.log('Cron triggered at:', new Date().toISOString());
    try {
      const result = await handleRefresh(env);
      console.log('Cron refresh completed:', JSON.stringify(result, null, 2));
    } catch (error) {
      console.error('Cron execution error:', error);
    }
  },
} satisfies ExportedHandler<Env>;
```

- [ ] **Step 3: Commit index 更新**

```bash
git add packages/api/src/index.ts
git commit -m "feat(api): add queue handler and refresh status routes"
```

---

### Task 2.3: 本地测试后端

**Files:** None

- [ ] **Step 1: 启动本地开发服务器**

Run:
```bash
cd packages/api && pnpm dev
```

Expected: 服务器启动在 http://localhost:8787

- [ ] **Step 2: 测试 POST /refresh**

Run:
```bash
curl -X POST http://localhost:8787/refresh -H "Content-Type: application/json" -H "Authorization: Bearer test"
```

Expected: 返回 `{"success":true,"data":{"taskId":"rf_xxx","status":"pending"}}`

- [ ] **Step 3: 测试 GET /refresh/status**

Run:
```bash
curl "http://localhost:8787/refresh/status?taskId=rf_xxx" -H "Authorization: Bearer test"
```

Expected: 返回任务状态

---

## Phase 3: 前端 - Toast 系统

### Task 3.1: 安装 sonner 依赖

**Files:** Modify `packages/web/package.json`

- [ ] **Step 1: 安装 sonner**

Run:
```bash
cd packages/web && pnpm add sonner
```

Expected: sonner 添加到 dependencies

- [ ] **Step 2: Commit 依赖更新**

```bash
git add packages/web/package.json pnpm-lock.yaml
git commit -m "chore(web): add sonner for toast notifications"
```

---

### Task 3.2: 添加前端类型定义

**Files:** Modify `packages/web/src/types/index.ts`

- [ ] **Step 1: 添加刷新状态类型**

在 `packages/web/src/types/index.ts` 末尾添加：

```typescript
// ===== 刷新状态类型 =====

export type RefreshTaskStatus = 'pending' | 'running' | 'completed' | 'failed';

export interface RefreshTaskProgress {
  current: number;
  total: number;
  currentSource: SourceType;
}

export interface RefreshTaskState {
  taskId: string;
  status: RefreshTaskStatus;
  startedAt: string;
  completedAt?: string;
  progress?: RefreshTaskProgress;
  result?: RefreshResponse['data'];
  error?: string;
}

export interface RefreshTriggerResponse {
  success: true;
  data: {
    taskId: string;
    status: 'pending';
  };
}

export interface RefreshStatusResponse {
  success: true;
  data: RefreshTaskState;
}
```

- [ ] **Step 2: Commit 类型定义**

```bash
git add packages/web/src/types/index.ts
git commit -m "feat(web): add refresh status types"
```

---

### Task 3.3: 更新 API Client

**Files:** Modify `packages/web/src/api/client.ts`

- [ ] **Step 1: 添加触发刷新和查询状态方法**

在 `packages/web/src/api/client.ts` 的 `ApiClient` 类中添加：

```typescript
import type {
  // ... 现有导入
  RefreshTriggerResponse,
  RefreshStatusResponse,
} from '../types';

// 在类中添加方法:

async triggerRefresh(): Promise<RefreshTriggerResponse> {
  return this.request<RefreshTriggerResponse>('/refresh', { method: 'POST' });
}

async getRefreshStatus(taskId: string): Promise<RefreshStatusResponse> {
  return this.request<RefreshStatusResponse>(`/refresh/status?taskId=${taskId}`);
}
```

- [ ] **Step 2: Commit API Client 更新**

```bash
git add packages/web/src/api/client.ts
git commit -m "feat(web): add triggerRefresh and getRefreshStatus methods"
```

---

### Task 3.4: 创建 useRefreshStatus Hook

**Files:** Create `packages/web/src/hooks/useRefreshStatus.ts`

- [ ] **Step 1: 创建 Hook 文件**

创建 `packages/web/src/hooks/useRefreshStatus.ts`：

```typescript
import { useState, useCallback, useRef, useEffect } from 'react';
import { toast } from 'sonner';
import { api } from '../api/client';
import type { RefreshTaskState, RefreshResponse } from '../types';

interface UseRefreshStatusOptions {
  onCompleted?: (result: RefreshResponse['data']) => void;
  onFailed?: (error: string) => void;
}

interface UseRefreshStatusReturn {
  isRefreshing: boolean;
  progress: { current: number; total: number; currentSource: string } | null;
  startRefresh: () => Promise<void>;
}

const POLL_INTERVAL = 2000; // 2 seconds
const MAX_RETRIES = 3;

export function useRefreshStatus(
  options: UseRefreshStatusOptions = {}
): UseRefreshStatusReturn {
  const { onCompleted, onFailed } = options;

  const [isRefreshing, setIsRefreshing] = useState(false);
  const [progress, setProgress] = useState<{
    current: number;
    total: number;
    currentSource: string;
  } | null>(null);

  const pollingRef = useRef<NodeJS.Timeout | null>(null);
  const retryCountRef = useRef(0);
  const toastIdRef = useRef<string | number | null>(null);

  const stopPolling = useCallback(() => {
    if (pollingRef.current) {
      clearInterval(pollingRef.current);
      pollingRef.current = null;
    }
  }, []);

  const pollStatus = useCallback(
    async (taskId: string) => {
      try {
        const response = await api.getRefreshStatus(taskId);
        const state: RefreshTaskState = response.data;

        // 更新进度
        if (state.progress) {
          setProgress(state.progress);
        }

        if (state.status === 'completed') {
          stopPolling();
          setIsRefreshing(false);
          setProgress(null);
          retryCountRef.current = 0;

          // 更新 toast
          if (toastIdRef.current !== null) {
            const newCount = state.result?.articles_summarized ?? 0;
            toast.success(`刷新完成，新增 ${newCount} 篇文章`, {
              id: toastIdRef.current,
            });
            toastIdRef.current = null;
          }

          onCompleted?.(state.result!);
        } else if (state.status === 'failed') {
          stopPolling();
          setIsRefreshing(false);
          setProgress(null);
          retryCountRef.current = 0;

          // 更新 toast
          if (toastIdRef.current !== null) {
            toast.error(`刷新失败: ${state.error ?? '未知错误'}`, {
              id: toastIdRef.current,
            });
            toastIdRef.current = null;
          }

          onFailed?.(state.error ?? '未知错误');
        }

        // 重置重试计数
        retryCountRef.current = 0;
      } catch (error) {
        retryCountRef.current++;

        if (retryCountRef.current >= MAX_RETRIES) {
          stopPolling();
          setIsRefreshing(false);
          setProgress(null);
          retryCountRef.current = 0;

          if (toastIdRef.current !== null) {
            toast.error('刷新状态查询失败，请稍后重试', { id: toastIdRef.current });
            toastIdRef.current = null;
          }

          onFailed?.('状态查询失败');
        }
      }
    },
    [stopPolling, onCompleted, onFailed]
  );

  const startRefresh = useCallback(async () => {
    if (isRefreshing) return;

    setIsRefreshing(true);
    setProgress(null);

    // 显示 loading toast
    toastIdRef.current = toast.loading('正在刷新...');

    try {
      const response = await api.triggerRefresh();
      const taskId = response.data.taskId;

      // 开始轮询
      pollingRef.current = setInterval(() => {
        pollStatus(taskId);
      }, POLL_INTERVAL);

      // 立即查询一次
      pollStatus(taskId);
    } catch (error) {
      setIsRefreshing(false);
      if (toastIdRef.current !== null) {
        toast.error('触发刷新失败，请稍后重试', { id: toastIdRef.current });
        toastIdRef.current = null;
      }
    }
  }, [isRefreshing, pollStatus]);

  // 清理：页面刷新/关闭时取消轮询
  useEffect(() => {
    return () => {
      stopPolling();
    };
  }, [stopPolling]);

  return {
    isRefreshing,
    progress,
    startRefresh,
  };
}
```

- [ ] **Step 2: Commit Hook**

```bash
git add packages/web/src/hooks/useRefreshStatus.ts
git commit -m "feat(web): add useRefreshStatus hook with polling"
```

---

### Task 3.5: 在 App.tsx 中集成 Toaster

**Files:** Modify `packages/web/src/App.tsx`

- [ ] **Step 1: 添加 Toaster 组件**

修改 `packages/web/src/App.tsx`：

```typescript
import { useState, useCallback } from 'react';
import { Toaster } from 'sonner';
import { useAuth } from './hooks/useAuth';
import { useArticles } from './hooks/useArticles';
import { useRefreshStatus } from './hooks/useRefreshStatus';
import { api } from './api/client';
import { LoadingScreen } from './components/Layout/LoadingScreen';
import { Header } from './components/Layout/Header';
import { LoginPage } from './components/Auth/LoginPage';
import { ArticleList } from './components/Articles/ArticleList';
import { EmptyState } from './components/Articles/EmptyState';
import { ErrorState } from './components/Articles/ErrorState';
import { FilterBar } from './components/Articles/FilterBar';
import { ALL_SOURCES, SourceType } from './types';

function App() {
  const { user, isLoading: authLoading, login, logout, error: authError } = useAuth();
  const [selectedSources, setSelectedSources] = useState<SourceType[]>(ALL_SOURCES);

  const {
    data: articlesData,
    isLoading: articlesLoading,
    error: articlesError,
    refetch,
    isFetching,
  } = useArticles({
    days: 7,
    pageSize: 50,
    sources: selectedSources.length < ALL_SOURCES.length ? selectedSources : undefined,
    enabled: !!user,
  });

  // 使用刷新状态 Hook
  const { isRefreshing, progress, startRefresh } = useRefreshStatus({
    onCompleted: () => {
      refetch();
    },
  });

  const handleLogout = useCallback(async () => {
    await logout();
  }, [logout]);

  if (authLoading) {
    return <LoadingScreen />;
  }

  if (!user) {
    return <LoginPage onLogin={login} isLoading={authLoading} error={authError} />;
  }

  const articles = articlesData?.data?.articles || [];
  const hasNoSources = selectedSources.length === 0;

  return (
    <div className="min-h-screen bg-bg-primary">
      <Toaster position="top-center" richColors />

      <Header username={user} onLogout={handleLogout} />

      <main className="max-w-content mx-auto px-4 py-8">
        <FilterBar
          selectedSources={selectedSources}
          onSourcesChange={setSelectedSources}
          onRefresh={startRefresh}
          isRefreshing={isRefreshing}
          progress={progress}
        />

        {hasNoSources && (
          <div className="text-center py-16">
            <p className="text-secondary">请选择至少一个数据源</p>
          </div>
        )}

        {!hasNoSources && articlesLoading && (
          <div className="space-y-6">
            {[1, 2, 3].map((i) => (
              <div key={i} className="bg-bg-primary border border-border rounded-lg p-6">
                <div className="h-4 bg-gray-200 rounded w-16 mb-4 animate-pulse"></div>
                <div className="h-5 bg-gray-200 rounded w-3/4 mb-2 animate-pulse"></div>
                <div className="h-3 bg-gray-200 rounded w-24 mb-4 animate-pulse"></div>
                <div className="space-y-2">
                  <div className="h-3 bg-gray-200 rounded w-full animate-pulse"></div>
                  <div className="h-3 bg-gray-200 rounded w-full animate-pulse"></div>
                  <div className="h-3 bg-gray-200 rounded w-2/3 animate-pulse"></div>
                </div>
              </div>
            ))}
          </div>
        )}

        {!hasNoSources && !articlesLoading && articlesError && (
          <ErrorState
            message={articlesError.message || '加载失败'}
            onRetry={() => refetch()}
          />
        )}

        {!hasNoSources && !articlesLoading && !articlesError && articles.length === 0 && (
          <EmptyState
            message="暂无文章"
            onRefresh={startRefresh}
            isRefreshing={isRefreshing}
          />
        )}

        {!hasNoSources && !articlesLoading && !articlesError && articles.length > 0 && (
          <ArticleList articles={articles} />
        )}
      </main>
    </div>
  );
}

export default App;
```

- [ ] **Step 2: Commit App 更新**

```bash
git add packages/web/src/App.tsx
git commit -m "feat(web): integrate Toaster and useRefreshStatus"
```

---

## Phase 4: 前端 - FilterBar 重构

### Task 4.1: 创建 SelectedTags 组件

**Files:** Create `packages/web/src/components/Articles/SelectedTags.tsx`

- [ ] **Step 1: 创建组件**

创建 `packages/web/src/components/Articles/SelectedTags.tsx`：

```typescript
import { SourceType, SOURCE_LABELS } from '../../types';

interface SelectedTagsProps {
  sources: SourceType[];
  onRemove: (source: SourceType) => void;
}

export function SelectedTags({ sources, onRemove }: SelectedTagsProps) {
  if (sources.length === 0) {
    return null;
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      {sources.map((source) => (
        <span
          key={source}
          className="inline-flex items-center gap-1 px-2 py-1 text-sm bg-blue-100 text-blue-800 rounded-full"
        >
          {SOURCE_LABELS[source]}
          <button
            onClick={(e) => {
              e.stopPropagation();
              onRemove(source);
            }}
            className="ml-1 text-blue-600 hover:text-blue-800"
            aria-label={`移除 ${SOURCE_LABELS[source]}`}
          >
            <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
              <path
                fillRule="evenodd"
                d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
                clipRule="evenodd"
              />
            </svg>
          </button>
        </span>
      ))}
    </div>
  );
}
```

- [ ] **Step 2: Commit 组件**

```bash
git add packages/web/src/components/Articles/SelectedTags.tsx
git commit -m "feat(web): add SelectedTags component"
```

---

### Task 4.2: 创建 SourceDropdown 组件

**Files:** Create `packages/web/src/components/Articles/SourceDropdown.tsx`

- [ ] **Step 1: 创建组件**

创建 `packages/web/src/components/Articles/SourceDropdown.tsx`：

```typescript
import { useEffect, useRef } from 'react';
import { SourceType, SOURCE_LABELS, ALL_SOURCES } from '../../types';

interface SourceDropdownProps {
  isOpen: boolean;
  selectedSources: SourceType[];
  onToggle: (source: SourceType) => void;
  onSelectAll: () => void;
  onClear: () => void;
  onClose: () => void;
}

export function SourceDropdown({
  isOpen,
  selectedSources,
  onToggle,
  onSelectAll,
  onClear,
  onClose,
}: SourceDropdownProps) {
  const dropdownRef = useRef<HTMLDivElement>(null);

  // 点击外部关闭
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        onClose();
      }
    }

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen, onClose]);

  if (!isOpen) {
    return null;
  }

  const isAllSelected = selectedSources.length === ALL_SOURCES.length;
  const isNoneSelected = selectedSources.length === 0;

  return (
    <div
      ref={dropdownRef}
      className="absolute top-full left-0 mt-2 w-56 bg-white border border-gray-200 rounded-lg shadow-lg z-20"
    >
      <div className="p-2">
        {ALL_SOURCES.map((source) => {
          const isSelected = selectedSources.includes(source);
          return (
            <label
              key={source}
              className="flex items-center gap-2 px-3 py-2 rounded cursor-pointer hover:bg-gray-50"
            >
              <input
                type="checkbox"
                checked={isSelected}
                onChange={() => onToggle(source)}
                className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
              />
              <span className="text-sm text-gray-700">{SOURCE_LABELS[source]}</span>
            </label>
          );
        })}
      </div>

      <div className="border-t border-gray-200 p-2 flex justify-between">
        <button
          onClick={onClear}
          disabled={isNoneSelected}
          className="px-3 py-1.5 text-sm text-gray-600 hover:text-gray-800 disabled:text-gray-300 disabled:cursor-not-allowed"
        >
          清空选择
        </button>
        <button
          onClick={onSelectAll}
          disabled={isAllSelected}
          className="px-3 py-1.5 text-sm text-blue-600 hover:text-blue-700 disabled:text-blue-300 disabled:cursor-not-allowed"
        >
          全选
        </button>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Commit 组件**

```bash
git add packages/web/src/components/Articles/SourceDropdown.tsx
git commit -m "feat(web): add SourceDropdown component"
```

---

### Task 4.3: 重写 FilterBar 组件

**Files:** Rewrite `packages/web/src/components/Articles/FilterBar.tsx`

- [ ] **Step 1: 重写组件**

完全重写 `packages/web/src/components/Articles/FilterBar.tsx`：

```typescript
import { useState } from 'react';
import { SourceType, ALL_SOURCES } from '../../types';
import { SourceDropdown } from './SourceDropdown';
import { SelectedTags } from './SelectedTags';

interface FilterBarProps {
  selectedSources: SourceType[];
  onSourcesChange: (sources: SourceType[]) => void;
  onRefresh: () => void;
  isRefreshing: boolean;
  progress?: { current: number; total: number; currentSource: string } | null;
}

export function FilterBar({
  selectedSources,
  onSourcesChange,
  onRefresh,
  isRefreshing,
  progress,
}: FilterBarProps) {
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);

  const toggleSource = (source: SourceType) => {
    if (selectedSources.includes(source)) {
      onSourcesChange(selectedSources.filter((s) => s !== source));
    } else {
      onSourcesChange([...selectedSources, source]);
    }
  };

  const selectAll = () => {
    onSourcesChange(ALL_SOURCES);
  };

  const clearSelection = () => {
    onSourcesChange([]);
  };

  const removeSource = (source: SourceType) => {
    onSourcesChange(selectedSources.filter((s) => s !== source));
  };

  const getButtonText = () => {
    return '选择源';
  };

  return (
    <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
      <div className="flex flex-wrap items-center gap-3">
        {/* 下拉选择器 */}
        <div className="relative">
          <button
            onClick={() => setIsDropdownOpen(!isDropdownOpen)}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
          >
            <span>{getButtonText()}</span>
            <svg
              className={`w-4 h-4 transition-transform ${isDropdownOpen ? 'rotate-180' : ''}`}
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>

          <SourceDropdown
            isOpen={isDropdownOpen}
            selectedSources={selectedSources}
            onToggle={toggleSource}
            onSelectAll={selectAll}
            onClear={clearSelection}
            onClose={() => setIsDropdownOpen(false)}
          />
        </div>

        {/* 已选标签 */}
        <SelectedTags sources={selectedSources} onRemove={removeSource} />
      </div>

      {/* 刷新按钮 */}
      <button
        onClick={onRefresh}
        disabled={isRefreshing}
        className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        title={isRefreshing && progress ? `正在处理 ${progress.currentSource}...` : undefined}
      >
        <svg
          className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
          />
        </svg>
        <span>
          {isRefreshing && progress
            ? `刷新中 (${progress.current}/${progress.total})`
            : '刷新'}
        </span>
      </button>
    </div>
  );
}
```

- [ ] **Step 2: Commit FilterBar 重写**

```bash
git add packages/web/src/components/Articles/FilterBar.tsx
git commit -m "refactor(web): rewrite FilterBar with dropdown and tags"
```

---

## Phase 5: 集成测试

### Task 5.1: 前端开发服务器测试

**Files:** None

- [ ] **Step 1: 启动前端开发服务器**

Run:
```bash
cd packages/web && pnpm dev
```

Expected: 服务器启动在 http://localhost:5173

- [ ] **Step 2: 手动测试 FilterBar**

测试内容：
1. 点击"选择源"按钮，下拉面板正常展开
2. 选择/取消选择源，Tag 正确显示
3. 点击 Tag 上的 ✕ 移除源
4. 点击"清空选择"，所有源被清空
5. 点击"全选"，所有源被选中
6. 点击下拉面板外部，面板自动收起
7. 全不选时，显示"请选择至少一个数据源"

- [ ] **Step 3: 手动测试 Toast 和刷新**

测试内容：
1. 点击刷新按钮，显示 loading toast
2. 刷新过程中按钮禁用
3. 刷新完成后显示成功 toast
4. 文章列表自动更新

---

### Task 5.2: 后端部署前检查

**Files:** None

- [ ] **Step 1: 检查 TypeScript 编译**

Run:
```bash
cd packages/api && pnpm build
```

Expected: 无编译错误

- [ ] **Step 2: 检查 wrangler 配置**

Run:
```bash
cd packages/api && npx wrangler deploy --dry-run
```

Expected: 配置验证通过

---

## Phase 6: 部署

### Task 6.1: 部署后端

**Files:** None

- [ ] **Step 1: 部署 API**

Run:
```bash
cd packages/api && pnpm deploy
```

Expected: 部署成功

---

### Task 6.2: 部署前端

**Files:** None

- [ ] **Step 1: 部署 Web**

Run:
```bash
cd packages/web && pnpm deploy
```

Expected: 部署成功

---

## 验收清单

- [ ] **FilterBar**
  - [ ] 下拉面板正常展开/收起
  - [ ] 选中的源以 Tag 形式显示
  - [ ] 支持"清空选择"和"全选"
  - [ ] 全不选时显示空状态提示
  - [ ] 点击外部自动收起面板

- [ ] **Toast**
  - [ ] 刷新时显示 loading toast
  - [ ] 成功/失败时显示对应 toast
  - [ ] toast 样式正常

- [ ] **刷新状态**
  - [ ] 点击刷新后按钮禁用
  - [ ] 轮询状态正常工作
  - [ ] 完成后自动恢复按钮
  - [ ] 完成后自动刷新文章列表
  - [ ] 并发控制生效
  - [ ] 页面刷新时取消轮询
