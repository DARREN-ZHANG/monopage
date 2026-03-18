# 前端交互优化设计

## 概述

本次优化包含三个部分：
1. FilterBar 重构 - 下拉多选 + Tag 展示，支持全不选
2. Toast 系统 - 使用 sonner 库，为刷新操作提供反馈
3. 刷新状态管理 - 异步刷新 + 状态轮询

---

## 1. FilterBar 重构

### 当前问题

- 横向平铺按钮，源数量增加时占用大量空间
- 强制至少选一个，不支持全不选状态

### 新设计

```
┌─────────────────────────────────────────────────────────────────┐
│  [▾ 选择源]  [OpenAI ✕] [Anthropic ✕]        [刷新按钮]        │
└─────────────────────────────────────────────────────────────────┘
                    │
                    ▼ 点击展开
┌─────────────────────────────────────────────────────────────────┐
│  [▾ 选择源]  [OpenAI ✕] [Anthropic ✕]        [刷新按钮]        │
│  ┌─────────────────────────────────────┐                        │
│  │ ☑ OpenAI                           │                        │
│  │ ☑ Anthropic                        │                        │
│  │ ☐ Codex                            │                        │
│  │ ☐ OpenCode                         │                        │
│  │ ─────────────────────────────────── │                        │
│  │ [清空选择]            [全选]        │                        │
│  └─────────────────────────────────────┘                        │
└─────────────────────────────────────────────────────────────────┘
```

### 组件结构

```
FilterBar/
├── FilterBar.tsx          # 主组件
├── SourceDropdown.tsx     # 下拉多选面板
└── SelectedTags.tsx       # 已选源 Tag 展示
```

### 行为规范

- 下拉面板显示所有源，支持多选（复选框）
- 选中的源以 Tag 形式显示在触发按钮旁，可点击 ✕ 移除
- 支持"清空选择"（全不选）和"全选"操作
- 点击下拉面板外部自动收起
- 全不选时，文章列表显示空状态提示："请选择至少一个数据源"
- 按钮文字：
  - 无选中: "选择源"
  - 有选中: "▾ 选择源" (固定文案，不显示数量)

---

## 2. Toast 系统

### 技术选型

使用 [sonner](https://sonner-emilk.vercel.app/) 库：
- 现代化设计
- 体积小 (~3KB gzipped)
- API 简洁
- 与 Tailwind CSS 配合良好

### 集成方式

1. 在 `App.tsx` 根组件添加 `<Toaster />`
2. 通过 `useToast` hook 或直接调用 `toast()` 方法

### 刷新相关 Toast

| 时机 | 类型 | 内容 |
|------|------|------|
| 点击刷新 | loading | "正在刷新..." |
| 刷新成功 | success | "刷新完成，新增 X 篇文章" |
| 刷新失败 | error | "刷新失败: {错误信息}" |

---

## 3. 刷新状态管理

### 技术方案：Cloudflare Queues

使用 Cloudflare Queues 实现异步刷新，解决 Workers 30 秒超时限制。

**免费额度：**
- 10,000 operations/day
- 消息保留 24 小时
- 预计每天消耗 ~63 operations（远低于限额）

**架构：**
```
┌─────────────┐     ┌─────────────────┐     ┌─────────────────┐
│  Client     │     │  API Worker     │     │  Queue Consumer │
│  (前端)     │     │  (fetch)        │     │  (queue)        │
├─────────────┤     ├─────────────────┤     ├─────────────────┤
│ POST /refresh────▶│ send message    │     │                 │
│              │     │ to Queue        │     │                 │
│              │     │ return taskId   │     │                 │
│              │     │                 │     │                 │
│ GET /status ◀────▶│ read status     │     │ process refresh │
│              │     │ from KV         │     │ update KV status│
│              │     │                 │     │                 │
└─────────────┘     └─────────────────┘     └─────────────────┘
                              │                      │
                              ▼                      ▼
                       ┌─────────────────────────────────┐
                       │        KV Storage               │
                       │  refresh:status:{taskId}        │
                       └─────────────────────────────────┘
```

### 后端配置

#### wrangler.jsonc

```jsonc
{
  "queues": {
    "producers": [
      {
        "queue": "refresh-queue",
        "binding": "REFRESH_QUEUE"
      }
    ],
    "consumers": [
      {
        "queue": "refresh-queue",
        "max_batch_size": 1,
        "max_batch_timeout": 1
      }
    ]
  }
}
```

#### 类型定义 (types.ts)

```typescript
// 扩展 Env 接口
export interface Env {
  KV: KVNamespace;
  REFRESH_QUEUE: Queue<RefreshMessage>;
  // ... 其他字段
}

// Queue 消息
export interface RefreshMessage {
  taskId: string;
  timestamp: string;
}

// 刷新状态
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

### 后端 API 设计

#### POST /refresh

触发异步刷新任务，立即返回。

**Response:**
```json
{
  "success": true,
  "data": {
    "taskId": "rf_xxx",
    "status": "pending"
  }
}
```

#### GET /refresh/status?taskId=xxx

查询刷新任务状态。

**Response:**
```json
{
  "success": true,
  "data": {
    "taskId": "rf_xxx",
    "status": "running",
    "startedAt": "2026-03-18T10:00:00Z",
    "progress": {
      "current": 1,
      "total": 4,
      "currentSource": "anthropic"
    }
  }
}
```

**完成时:**
```json
{
  "success": true,
  "data": {
    "taskId": "rf_xxx",
    "status": "completed",
    "startedAt": "2026-03-18T10:00:00Z",
    "completedAt": "2026-03-18T10:01:30Z",
    "result": {
      "refreshed_sources": ["openai", "anthropic"],
      "articles_found": 10,
      "articles_summarized": 8,
      "articles_skipped": { "duplicate": 2, "incomplete_metadata": 0 },
      "errors": []
    }
  }
}
```

### 状态流转

```
pending → running → completed
                  ↘ failed
```

### 状态存储 (KV)

```
Key:   refresh:status:{taskId}
TTL:   1 hour

Value: {
  taskId: string,
  status: "pending" | "running" | "completed" | "failed",
  startedAt: string,
  completedAt?: string,
  progress?: {
    current: number,
    total: number,
    currentSource: string
  },
  result?: RefreshResult,
  error?: string
}
```

### 并发控制

- 同一时刻只允许一个刷新任务
- 若已有进行中的任务，`POST /refresh` 返回现有 taskId，不创建新任务
- 使用 KV key `refresh:current` 存储当前进行中的 taskId

### 后端实现

#### index.ts (Worker 入口)

```typescript
export default {
  // HTTP 请求处理
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    // ... 现有路由

    // POST /refresh - 触发异步刷新
    if (path === '/refresh' && request.method === 'POST') {
      return handleRefreshTrigger(request, env);
    }

    // GET /refresh/status - 查询刷新状态
    if (path === '/refresh/status' && request.method === 'GET') {
      return handleRefreshStatus(request, env);
    }
  },

  // Queue 消息处理 (Consumer)
  async queue(batch: Message<RefreshMessage>[], env: Env, ctx: ExecutionContext): Promise<void> {
    for (const message of batch.messages) {
      await processRefreshTask(message.body, env);
    }
  },

  // Cron 定时任务
  async scheduled(event: ScheduledEvent, env: Env, ctx: ExecutionContext): Promise<void> {
    // Cron 仍然直接执行，不经过队列
    await runRefresh(env);
  },
} satisfies ExportedHandler<Env>;
```

#### refresh.ts (核心逻辑)

```typescript
// 触发异步刷新
export async function handleRefreshTrigger(request: Request, env: Env): Promise<Response> {
  // 检查是否有进行中的任务
  const currentTask = await env.KV.get('refresh:current');
  if (currentTask) {
    const state = await env.KV.get(`refresh:status:${currentTask}`);
    if (state) {
      const task = JSON.parse(state) as RefreshTaskState;
      if (task.status === 'pending' || task.status === 'running') {
        return Response.json({ success: true, data: { taskId: currentTask, status: task.status } });
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
  await env.KV.put(`refresh:status:${taskId}`, JSON.stringify(taskState), { expirationTtl: 3600 });
  await env.KV.put('refresh:current', taskId, { expirationTtl: 3600 });

  // 发送到队列
  await env.REFRESH_QUEUE.send({ taskId, timestamp: new Date().toISOString() });

  return Response.json({ success: true, data: { taskId, status: 'pending' } });
}

// 查询刷新状态
export async function handleRefreshStatus(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url);
  const taskId = url.searchParams.get('taskId');

  if (!taskId) {
    return Response.json({ success: false, error: { code: 'MISSING_TASK_ID' } }, { status: 400 });
  }

  const state = await env.KV.get(`refresh:status:${taskId}`);
  if (!state) {
    return Response.json({ success: false, error: { code: 'TASK_NOT_FOUND' } }, { status: 404 });
  }

  return Response.json({ success: true, data: JSON.parse(state) });
}

// 处理刷新任务 (Queue Consumer)
async function processRefreshTask(message: RefreshMessage, env: Env): Promise<void> {
  const { taskId } = message;

  // 更新状态为 running
  await updateTaskStatus(env, taskId, 'running');

  try {
    // 执行刷新逻辑，带进度更新
    const result = await runRefreshWithProgress(env, taskId);

    // 更新状态为 completed
    await updateTaskStatus(env, taskId, 'completed', result);
  } catch (error) {
    // 更新状态为 failed
    await updateTaskStatus(env, taskId, 'failed', undefined, error instanceof Error ? error.message : 'Unknown error');
  }

  // 清除当前任务标记
  await env.KV.delete('refresh:current');
}

// 带进度更新的刷新
async function runRefreshWithProgress(env: Env, taskId: string): Promise<RefreshResponse['data']> {
  const sources = VALID_SOURCES;
  const total = sources.length;
  let current = 0;

  // ... 刷新逻辑，每处理完一个源更新进度
  for (const source of sources) {
    current++;
    await updateTaskProgress(env, taskId, { current, total, currentSource: source });
    // ... 处理源
  }

  return result;
}
```

### 前端实现

#### 新增 Hook: useRefreshStatus

```typescript
interface UseRefreshStatusOptions {
  onCompleted?: (result: RefreshResult) => void;
  onFailed?: (error: string) => void;
}

interface UseRefreshStatusReturn {
  isRefreshing: boolean;
  progress: { current: number; total: number; currentSource: string } | null;
  startRefresh: () => Promise<void>;
}

function useRefreshStatus(options?: UseRefreshStatusOptions): UseRefreshStatusReturn;
```

#### 刷新流程

```
用户点击刷新
    │
    ▼
┌─────────────────────────────────────────┐
│ 1. 调用 POST /refresh                    │
│ 2. 显示 Toast: "正在刷新..."             │
│ 3. 禁用刷新按钮                          │
└─────────────────────────────────────────┘
    │
    ▼
┌─────────────────────────────────────────┐
│ 轮询 GET /refresh/status (每 2 秒)       │
│ - 可选：更新按钮显示进度                  │
└─────────────────────────────────────────┘
    │
    ▼
┌─────────────────────────────────────────┐
│ 状态变为 completed / failed              │
│ - 成功: Toast "刷新完成，新增 X 篇文章"   │
│ - 失败: Toast "刷新失败: {错误信息}"      │
│ - 重新获取文章列表                        │
│ - 恢复刷新按钮                           │
└─────────────────────────────────────────┘
```

---

## 4. 文件变更清单

### 前端 (packages/web)

| 文件 | 操作 | 说明 |
|------|------|------|
| `package.json` | 修改 | 添加 sonner 依赖 |
| `src/App.tsx` | 修改 | 添加 Toaster 组件，集成 useRefreshStatus |
| `src/components/Articles/FilterBar.tsx` | 重写 | 下拉多选 + Tag 展示 |
| `src/components/Articles/SourceDropdown.tsx` | 新增 | 下拉多选面板组件 |
| `src/components/Articles/SelectedTags.tsx` | 新增 | 已选源 Tag 展示组件 |
| `src/hooks/useRefreshStatus.ts` | 新增 | 刷新状态轮询 Hook |
| `src/api/client.ts` | 修改 | 添加 getRefreshStatus 方法 |
| `src/types/index.ts` | 修改 | 添加刷新状态相关类型 |

### 后端 (packages/api)

| 文件 | 操作 | 说明 |
|------|------|------|
| `wrangler.jsonc` | 修改 | 添加 Queues 配置 (producer + consumer) |
| `src/index.ts` | 修改 | 添加 queue handler + 新路由 |
| `src/routes/refresh.ts` | 重构 | 异步刷新 + 状态管理 |
| `src/services/storage.ts` | 修改 | 添加刷新状态存储方法 |
| `src/types.ts` | 修改 | 添加刷新状态相关类型 |

### 部署前准备

1. **创建 Queue**:
   ```bash
   npx wrangler queues create refresh-queue
   ```

2. **更新 wrangler.jsonc** (见上文配置)

---

## 5. 验收标准

1. **FilterBar**
   - [ ] 下拉面板正常展开/收起
   - [ ] 选中的源以 Tag 形式显示
   - [ ] 支持"清空选择"和"全选"
   - [ ] 全不选时不调用 API，显示空状态提示 "请选择至少一个数据源"
   - [ ] 点击外部自动收起面板

2. **Toast**
   - [ ] 刷新时显示 loading toast
   - [ ] 成功/失败时显示对应 toast
   - [ ] toast 样式正常，不影响布局

3. **刷新状态**
   - [ ] 点击刷新后按钮禁用
   - [ ] 轮询状态正常工作（每 2 秒）
   - [ ] 完成后自动恢复按钮
   - [ ] 完成后自动刷新文章列表
   - [ ] 并发控制生效（已有任务时返回现有 taskId）
   - [ ] 刷新进行中时，再次点击不创建新任务
   - [ ] 轮询失败时正确重试（最多 3 次）
