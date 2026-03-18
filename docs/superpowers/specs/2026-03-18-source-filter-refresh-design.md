# 首页来源筛选与刷新功能设计

## 概述

在项目首页新增两个功能：
1. **来源筛选** - 多选数据来源，可同时查看多个来源的文章
2. **刷新按钮** - 手动刷新当前文章列表

## 需求

- **来源筛选**：多选筛选，支持同时选择多个来源
- **刷新功能**：手动刷新按钮，图标 + 文字样式
- **位置**：文章列表上方，独立一行

## 组件结构

```
packages/web/src/
├── components/
│   └── Articles/
│       ├── ArticleList.tsx      # 现有，需修改
│       └── FilterBar.tsx        # 新建 - 筛选栏组件
└── types/
    └── index.ts                 # 更新 SourceType 定义

packages/api/src/
├── types.ts                     # 更新查询参数类型
├── routes/
│   └── articles.ts              # 支持 sources 多选
└── services/
    └── storage.ts               # 支持多选筛选
```

## 后端修改

### 1. 类型定义 (`packages/api/src/types.ts`)

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

### 2. 路由处理 (`packages/api/src/routes/articles.ts`)

- 修复 `VALID_SOURCES` 常量，包含全部 4 种来源
- 支持 `sources` 多选参数解析（逗号分隔）

```typescript
const VALID_SOURCES: SourceType[] = ['openai', 'anthropic', 'codex', 'opencode'];

// 解析 sources 参数
const sourcesParam = searchParams.get('sources');
if (sourcesParam) {
  const sources = sourcesParam.split(',').filter(s =>
    VALID_SOURCES.includes(s as SourceType)
  ) as SourceType[];
  params.sources = sources.length > 0 ? sources : undefined;
}
```

### 3. 存储服务 (`packages/api/src/services/storage.ts`)

```typescript
async getSummariesByDateRange(
  fromDate: string,
  toDate: string,
  sourceFilter?: SourceType | SourceType[]  // 支持单选或多选
): Promise<ArticleSummary[]>
```

## 前端修改

### 1. 类型定义 (`packages/web/src/types/index.ts`)

```typescript
export type SourceType = 'openai' | 'anthropic' | 'codex' | 'opencode';

export const SOURCE_LABELS: Record<SourceType, string> = {
  openai: 'OpenAI',
  anthropic: 'Anthropic',
  codex: 'Codex',
  opencode: 'OpenCode',
};
```

### 2. API 客户端 (`packages/web/src/api/client.ts`)

```typescript
async getArticles(params: {
  date?: string;
  days?: number;
  page?: number;
  pageSize?: number;
  sources?: SourceType[];  // 新增
}): Promise<ArticlesResponse>
```

### 3. FilterBar 组件 (`packages/web/src/components/Articles/FilterBar.tsx`)

```tsx
interface FilterBarProps {
  selectedSources: SourceType[];
  onSourcesChange: (sources: SourceType[]) => void;
  onRefresh: () => void;
  isRefreshing: boolean;
}
```

**UI 结构**：
- 左侧：来源多选芯片（4 个按钮）
- 右侧：刷新按钮（图标 + 文字）

**样式**：
- 芯片：未选中灰色边框，选中时填充主题色
- 刷新按钮：点击时图标旋转动画
- 响应式：小屏幕芯片可换行

### 4. App.tsx 集成

```tsx
const [selectedSources, setSelectedSources] = useState<SourceType[]>(
  ['openai', 'anthropic', 'codex', 'opencode']
);

const { data, isLoading, refetch, isFetching } = useQuery({
  queryKey: ['articles', selectedSources],
  queryFn: () => apiClient.getArticles({ sources: selectedSources }),
});
```

## 数据流

```
用户点击芯片 → setSelectedSources()
    → React Query 重新请求 (sources 参数变化)
    → ArticleList 显示新数据

用户点击刷新 → refetch()
    → 重新获取当前筛选条件下的数据
```

## 实现清单

| 序号 | 文件 | 操作 | 说明 |
|------|------|------|------|
| 1 | `packages/api/src/types.ts` | 修改 | 添加 `sources?: SourceType[]` |
| 2 | `packages/api/src/routes/articles.ts` | 修改 | 支持 `sources` 多选参数 |
| 3 | `packages/api/src/services/storage.ts` | 修改 | 支持多选筛选 |
| 4 | `packages/web/src/types/index.ts` | 修改 | 同步 SourceType，添加 SOURCE_LABELS |
| 5 | `packages/web/src/api/client.ts` | 修改 | 支持 sources 参数 |
| 6 | `packages/web/src/components/Articles/FilterBar.tsx` | 新建 | 筛选栏组件 |
| 7 | `packages/web/src/App.tsx` | 修改 | 集成 FilterBar |
