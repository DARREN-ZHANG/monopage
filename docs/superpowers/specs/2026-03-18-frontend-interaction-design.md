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
| `src/index.ts` | 修改 | 添加 GET /refresh/status 路由 |
| `src/routes/refresh.ts` | 重构 | 异步刷新 + 状态管理 |
| `src/services/storage.ts` | 修改 | 添加刷新状态存储方法 |
| `src/types.ts` | 修改 | 添加刷新状态相关类型 |

---

## 5. 验收标准

1. **FilterBar**
   - [ ] 下拉面板正常展开/收起
   - [ ] 选中的源以 Tag 形式显示
   - [ ] 支持"清空选择"和"全选"
   - [ ] 全不选时显示空状态提示
   - [ ] 点击外部自动收起面板

2. **Toast**
   - [ ] 刷新时显示 loading toast
   - [ ] 成功/失败时显示对应 toast
   - [ ] toast 样式正常，不影响布局

3. **刷新状态**
   - [ ] 点击刷新后按钮禁用
   - [ ] 轮询状态正常工作
   - [ ] 完成后自动恢复按钮
   - [ ] 完成后自动刷新文章列表
   - [ ] 并发控制生效（已有任务时不创建新任务）
