# 首页来源筛选与刷新功能实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在首页新增来源多选筛选和刷新按钮功能

**Architecture:** 后端 API 支持 sources 多选参数，前端使用 FilterBar 组件管理筛选状态，通过 React Query 自动重新获取数据

**Tech Stack:** React 18, TypeScript, Tailwind CSS, React Query, Cloudflare Workers

**Spec:** `docs/superpowers/specs/2026-03-18-source-filter-refresh-design.md`

---

## Task 1: 后端类型定义修改

**Files:**
- Modify: `packages/api/src/types.ts`

> **注意**: 后端 `SourceType` 已包含 4 种来源（第 26 行），无需修改。

- [ ] **Step 1: 添加 sources 参数到 ArticlesQueryParams**

在 `ArticlesQueryParams` 接口（第 36-42 行）中添加 `sources` 字段：

```typescript
export interface ArticlesQueryParams {
  date?: string;
  source?: SourceType;      // 保留兼容
  sources?: SourceType[];   // 新增：多选
  days?: number;
  page?: number;
  pageSize?: number;
}
```

- [ ] **Step 2: 验证类型编译通过**

Run: `cd packages/api && pnpm tsc --noEmit`
Expected: 无错误

- [ ] **Step 3: 提交**

```bash
git add packages/api/src/types.ts
git commit -m "feat(api): add sources array to ArticlesQueryParams"
```

---

## Task 2: 后端路由处理修改

**Files:**
- Modify: `packages/api/src/routes/articles.ts`

- [ ] **Step 1: 修复 VALID_SOURCES 常量**

将第 7 行的 VALID_SOURCES 更新为包含所有 4 种来源：

```typescript
const VALID_SOURCES: SourceType[] = ['openai', 'anthropic', 'codex', 'opencode'];
```

- [ ] **Step 2: 添加 sources 参数解析**

在 `parseQueryParams` 函数中，在 `source` 参数处理之后（第 105 行后），添加 sources 参数解析：

```typescript
// sources 参数（多选）
const sourcesParam = searchParams.get('sources');
if (sourcesParam) {
  const sources = sourcesParam.split(',').filter(s =>
    VALID_SOURCES.includes(s as SourceType)
  ) as SourceType[];
  params.sources = sources.length > 0 ? sources : undefined;
}
```

- [ ] **Step 3: 更新 parseQueryParams 返回值**

修改第 137-143 行的返回对象，添加 sources 字段：

```typescript
return {
  date: params.date,
  source: params.source,
  sources: params.sources,  // 新增
  days: params.days ?? 1,
  page: params.page ?? 1,
  pageSize: params.pageSize ?? DEFAULT_PAGE_SIZE,
};
```

- [ ] **Step 4: 修改 handleArticles 传递 sources 到存储层**

修改第 32-36 行的调用：

```typescript
const summaries = await storage.getSummariesByDateRange(
  fromDate,
  toDate,
  params.sources || params.source  // 支持多选或单选
);
```

- [ ] **Step 5: 更新 sources_included 逻辑**

修改第 54-56 行：

```typescript
const sourcesIncluded = params.sources
  ? params.sources
  : params.source
    ? [params.source]
    : [...new Set(summaries.map(s => s.source))];
```

- [ ] **Step 6: 验证编译通过**

Run: `cd packages/api && pnpm tsc --noEmit`
Expected: 无错误

- [ ] **Step 7: 提交**

```bash
git add packages/api/src/routes/articles.ts
git commit -m "feat(api): support sources multi-select in articles endpoint"
```

---

## Task 3: 后端存储服务修改

**Files:**
- Modify: `packages/api/src/services/storage.ts:144-171`

- [ ] **Step 1: 修改 getSummariesByDateRange 支持多选**

修改方法签名和实现（第 144-171 行）：

```typescript
async getSummariesByDateRange(
  fromDate: string,
  toDate: string,
  sourceFilter?: SourceType | SourceType[]
): Promise<ArticleSummary[]> {
  const indexes = await this.getIndexRange(fromDate, toDate);
  const summaries: ArticleSummary[] = [];

  // 标准化为数组
  const sourceList = sourceFilter
    ? (Array.isArray(sourceFilter) ? sourceFilter : [sourceFilter])
    : undefined;

  for (const [date, index] of indexes) {
    const sources = sourceList || Object.keys(index) as SourceType[];

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
```

- [ ] **Step 2: 验证编译通过**

Run: `cd packages/api && pnpm tsc --noEmit`
Expected: 无错误

- [ ] **Step 3: 提交**

```bash
git add packages/api/src/services/storage.ts
git commit -m "feat(api): support multi-source filter in storage service"
```

---

## Task 4: 前端类型定义修改

**Files:**
- Modify: `packages/web/src/types/index.ts`

- [ ] **Step 1: 更新 SourceType 定义**

修改第 1 行：

```typescript
export type SourceType = 'openai' | 'anthropic' | 'codex' | 'opencode';
```

- [ ] **Step 2: 添加 SOURCE_LABELS 常量**

在第 1 行后添加：

```typescript
export const SOURCE_LABELS: Record<SourceType, string> = {
  openai: 'OpenAI',
  anthropic: 'Anthropic',
  codex: 'Codex',
  opencode: 'OpenCode',
};

export const ALL_SOURCES: SourceType[] = ['openai', 'anthropic', 'codex', 'opencode'];
```

- [ ] **Step 3: 验证编译通过**

Run: `cd packages/web && pnpm tsc --noEmit`
Expected: 无错误

- [ ] **Step 4: 提交**

```bash
git add packages/web/src/types/index.ts
git commit -m "feat(web): update SourceType to include all 4 sources"
```

---

## Task 5: 前端 API 客户端修改

**Files:**
- Modify: `packages/web/src/api/client.ts:74-83`

- [ ] **Step 1: 添加 sources 参数到 getArticles 方法**

修改 getArticles 方法：

```typescript
async getArticles(params: {
  date?: string;
  days?: number;
  page?: number;
  pageSize?: number;
  sources?: SourceType[];
}): Promise<ArticlesResponse> {
  const searchParams = new URLSearchParams();
  if (params.date) searchParams.set('date', params.date);
  if (params.days) searchParams.set('days', String(params.days));
  if (params.page) searchParams.set('page', String(params.page));
  if (params.pageSize) searchParams.set('page_size', String(params.pageSize));
  if (params.sources && params.sources.length > 0) {
    searchParams.set('sources', params.sources.join(','));
  }

  const query = searchParams.toString();
  return this.request<ArticlesResponse>(`/articles${query ? `?${query}` : ''}`);
}
```

- [ ] **Step 2: 添加 SourceType 导入**

在文件顶部导入区添加 SourceType：

```typescript
import type {
  ArticlesResponse,
  LoginRequest,
  LoginResponse,
  MeResponse,
  LogoutResponse,
  RefreshResponse,
  ApiErrorResponse,
  SourceType,
} from '../types';
```

- [ ] **Step 3: 验证编译通过**

Run: `cd packages/web && pnpm tsc --noEmit`
Expected: 无错误

- [ ] **Step 4: 提交**

```bash
git add packages/web/src/api/client.ts
git commit -m "feat(web): add sources parameter to getArticles API"
```

---

## Task 6: 前端 useArticles Hook 修改

**Files:**
- Modify: `packages/web/src/hooks/useArticles.ts`

- [ ] **Step 1: 添加 sources 参数到接口**

修改 UseArticlesParams 接口：

```typescript
interface UseArticlesParams {
  date?: string;
  days?: number;
  page?: number;
  pageSize?: number;
  sources?: SourceType[];
  enabled?: boolean;
}
```

- [ ] **Step 2: 添加 SourceType 导入**

在文件顶部添加导入：

```typescript
import type { ArticlesResponse, SourceType } from '../types';
```

- [ ] **Step 3: 更新 useArticles 实现**

修改函数实现：

```typescript
export function useArticles(params: UseArticlesParams = {}) {
  const { date, days = 7, page = 1, pageSize = 50, sources, enabled = true } = params;

  return useQuery<ArticlesResponse, Error>({
    queryKey: ['articles', { date, days, page, pageSize, sources }],
    queryFn: () => api.getArticles({ date, days, page, pageSize, sources }),
    enabled,
    staleTime: 5 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
    retry: (failureCount, error) => {
      if (error instanceof AuthError) return false;
      return failureCount < 1;
    },
  });
}
```

- [ ] **Step 4: 验证编译通过**

Run: `cd packages/web && pnpm tsc --noEmit`
Expected: 无错误

- [ ] **Step 5: 提交**

```bash
git add packages/web/src/hooks/useArticles.ts
git commit -m "feat(web): add sources parameter to useArticles hook"
```

---

## Task 7: 前端 FilterBar 组件创建

**Files:**
- Create: `packages/web/src/components/Articles/FilterBar.tsx`

- [ ] **Step 1: 创建 FilterBar 组件**

```tsx
import { SourceType, SOURCE_LABELS, ALL_SOURCES } from '../../types';

interface FilterBarProps {
  selectedSources: SourceType[];
  onSourcesChange: (sources: SourceType[]) => void;
  onRefresh: () => void;
  isRefreshing: boolean;
}

export function FilterBar({
  selectedSources,
  onSourcesChange,
  onRefresh,
  isRefreshing,
}: FilterBarProps) {
  const toggleSource = (source: SourceType) => {
    if (selectedSources.includes(source)) {
      // 至少保留一个选中
      if (selectedSources.length > 1) {
        onSourcesChange(selectedSources.filter(s => s !== source));
      }
    } else {
      onSourcesChange([...selectedSources, source]);
    }
  };

  const selectAll = () => {
    onSourcesChange(ALL_SOURCES);
  };

  const isAllSelected = selectedSources.length === ALL_SOURCES.length;

  return (
    <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
      {/* 左侧：来源筛选芯片 */}
      <div className="flex flex-wrap items-center gap-2">
        {ALL_SOURCES.map(source => {
          const isSelected = selectedSources.includes(source);
          return (
            <button
              key={source}
              onClick={() => toggleSource(source)}
              className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
                isSelected
                  ? 'bg-blue-600 text-white'
                  : 'bg-transparent border border-gray-300 text-gray-600 hover:border-gray-400'
              }`}
            >
              {SOURCE_LABELS[source]}
            </button>
          );
        })}
        {/* 全选按钮 */}
        {!isAllSelected && (
          <button
            onClick={selectAll}
            className="px-3 py-1.5 text-sm text-blue-600 hover:text-blue-700"
          >
            全选
          </button>
        )}
      </div>

      {/* 右侧：刷新按钮 */}
      <button
        onClick={onRefresh}
        disabled={isRefreshing}
        className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
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
        <span>刷新</span>
      </button>
    </div>
  );
}
```

- [ ] **Step 2: 验证编译通过**

Run: `cd packages/web && pnpm tsc --noEmit`
Expected: 无错误

- [ ] **Step 3: 提交**

```bash
git add packages/web/src/components/Articles/FilterBar.tsx
git commit -m "feat(web): add FilterBar component with multi-select sources"
```

---

## Task 8: 前端 App.tsx 集成

**Files:**
- Modify: `packages/web/src/App.tsx`

- [ ] **Step 1: 添加导入**

在第 8 行后添加 FilterBar 导入：

```typescript
import { FilterBar } from './components/Articles/FilterBar';
```

在第 10 行后添加 ALL_SOURCES 导入：

```typescript
import { ALL_SOURCES, SourceType } from './types';
```

- [ ] **Step 2: 添加 sources 状态**

在第 14 行后添加状态定义：

```typescript
const [selectedSources, setSelectedSources] = useState<SourceType[]>(ALL_SOURCES);
```

- [ ] **Step 3: 修改 useArticles 调用**

修改第 16-25 行：

```typescript
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
```

- [ ] **Step 4: 修改 handleRefresh 使用 isFetching**

修改第 27-37 行：

```typescript
const handleRefresh = useCallback(async () => {
  try {
    await api.refresh();
    refetch();
  } catch (error) {
    console.error('刷新失败:', error);
  }
}, [refetch]);
```

- [ ] **Step 5: 在文章列表上方添加 FilterBar**

在第 58 行的 `<main>` 标签后添加：

```tsx
<main className="max-w-content mx-auto px-4 py-8">
  <FilterBar
    selectedSources={selectedSources}
    onSourcesChange={setSelectedSources}
    onRefresh={handleRefresh}
    isRefreshing={isFetching}
  />
```

- [ ] **Step 6: 删除 isRefreshing 状态**

删除第 14 行的 `isRefreshing` 状态定义（已改用 isFetching）。

- [ ] **Step 7: 验证编译通过**

Run: `cd packages/web && pnpm tsc --noEmit`
Expected: 无错误

- [ ] **Step 8: 提交**

```bash
git add packages/web/src/App.tsx
git commit -m "feat(web): integrate FilterBar into home page"
```

---

## Task 9: 集成测试与验证

- [ ] **Step 1: 验证后端 API 编译**

Run: `cd packages/api && pnpm tsc --noEmit`
Expected: 无错误

- [ ] **Step 2: 验证前端编译**

Run: `cd packages/web && pnpm tsc --noEmit`
Expected: 无错误

- [ ] **Step 3: 启动后端开发服务器**

Run: `cd packages/api && pnpm dev`
Expected: 服务正常启动

- [ ] **Step 4: 启动前端开发服务器**

Run: `cd packages/web && pnpm dev`
Expected: 服务正常启动

- [ ] **Step 5: 手动测试功能**

1. 登录后查看首页
2. 验证 FilterBar 显示正常（4 个来源芯片 + 刷新按钮）
3. 点击来源芯片，验证筛选功能（列表只显示选中来源的文章）
4. 点击"全选"按钮，验证恢复全选
5. 点击刷新按钮，验证刷新动画和数据更新

- [ ] **Step 6: 最终提交（如有遗漏）**

```bash
git add -A
git commit -m "chore: final cleanup for source filter feature"
```
