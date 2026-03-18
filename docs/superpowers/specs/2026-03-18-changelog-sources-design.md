# Coding Agent Changelog 数据源设计

## 概述

为 Monopage 添加三个 coding agent 工具的 changelog 追踪功能：
- **Claude Code** (Anthropic)
- **Codex** (OpenAI)
- **OpenCode**

用户可以查看这三个产品最近 7 天内的版本更新，每个版本更新作为一个独立卡片展示在前端。

## 目标

- 追踪三个 coding agent 工具的版本更新
- 显示最近 7 天内的更新内容
- 遵循现有的 `BaseSourceParser` 架构模式
- 每个小版本更新作为独立的 Article 展示

## 架构

### 文件结构

```
packages/api/src/sources/
├── base.ts                 # 现有基类（无需修改）
├── openai.ts               # 现有 OpenAI 解析器
├── anthropic.ts            # 新增：Claude Code changelog
├── codex.ts                # 新增：Codex changelog
└── opencode.ts             # 新增：OpenCode changelog

packages/api/src/utils/
├── html-parser.ts          # 新增：通用 HTML 解析工具
└── ...
```

### 类设计

所有新解析器继承 `BaseSourceParser`，实现：
- `fetchArticles(timeoutMs)`: 抓取并解析 changelog
- `fetchArticleContent(url, timeoutMs)`: 获取单个更新的详细内容

## 数据源详情

### 1. Anthropic (Claude Code)

| 属性 | 值 |
|-----|-----|
| URL | `https://code.claude.com/docs/en/changelog` |
| 格式 | Markdown 风格的 HTML |
| 解析策略 | 识别版本标题，提取版本块内容 |

**解析流程：**
1. 抓取 changelog 页面
2. 识别版本标题模式（如 `## March 14, 2025` 或 `v1.2.3`）
3. 提取每个版本块的更新内容
4. 生成 Article

### 2. Codex (OpenAI)

| 属性 | 值 |
|-----|-----|
| URL | `https://developers.openai.com/codex/changelog` |
| 格式 | 结构化 Markdown，分为 CLI 和 App 版本 |
| 解析策略 | 分别解析两个版本区域，提取版本号和 PR 链接 |

**解析流程：**
1. 抓取 changelog 页面
2. 识别 CLI 和 App 两个版本区域
3. 提取版本号、日期、PR 链接
4. 生成 Article（CLI 和 App 版本分开）

### 3. OpenCode

| 属性 | 值 |
|-----|-----|
| URL | `https://opencode.ai/changelog` |
| 格式 | 中文日期分组，包含多个组件 |
| 解析策略 | 解析中文日期，提取各组件更新 |

**解析流程：**
1. 抓取 changelog 页面
2. 识别日期分组（如 `2024年3月15日`）
3. 提取 Core/Desktop/TUI/SDK 各组件的更新
4. 每个组件更新作为独立 Article

## 数据模型

每个版本更新转换为标准 `Article` 类型：

```typescript
interface Article {
  id: string;           // 基于源名+版本号+日期生成
  source: SourceType;   // 'anthropic' | 'codex' | 'opencode'
  title: string;        // 版本号或更新标题
  url: string;          // changelog 页面或具体版本链接
  publishedAt: string;  // ISO 8601 日期
  content?: string;     // 更新内容摘要
}
```

### ID 生成策略

使用现有的 `generateArticleId(source, url, title)` 函数，确保：
- 同一版本更新不会重复
- 不同源的同名版本可区分

## 通用工具函数

新增 `utils/html-parser.ts`，提供共享功能：

```typescript
/**
 * 清理 HTML 标签，保留纯文本
 */
export function cleanHtmlTags(html: string): string;

/**
 * 解析 HTML 实体
 */
export function cleanHtmlEntities(text: string): string;

/**
 * 灵活解析多种日期格式
 * 支持: ISO, RFC 2822, 中文日期
 */
export function parseDateFlexible(dateStr: string): Date | null;

/**
 * 从 HTML 片段提取属性值
 */
export function extractAttribute(html: string, attr: string): string | null;
```

## 7天过滤逻辑

在 API 路由层统一处理：

```typescript
const hours = 24 * 7; // 168 小时
const recentArticles = parser.filterRecentArticles(articles, hours);
```

使用 `BaseSourceParser` 提供的 `filterRecentArticles` 方法。

## 错误处理

遵循现有错误处理模式：

| 错误类型 | 触发条件 |
|---------|---------|
| `SOURCE_FETCH_FAILED` | 网络请求失败 |
| `SOURCE_TIMEOUT` | 请求超时 |
| `SOURCE_PARSE_FAILED` | 解析失败 |
| `SOURCE_EMPTY_ARTICLES` | 未找到任何文章 |

## 类型扩展

需要在 `types.ts` 中扩展 `SourceType`：

```typescript
export type SourceType =
  | 'openai'
  | 'anthropic'  // 新增
  | 'codex'      // 新增
  | 'opencode';  // 新增
```

## 前端影响

前端无需修改，新增的数据源会自动通过现有组件展示：
- `ArticleCard`: 显示每个版本更新
- `ArticleList`: 按时间排序展示所有更新

## 实现步骤

1. 创建 `utils/html-parser.ts` 工具模块
2. 扩展 `types.ts` 中的 `SourceType`
3. 实现 `AnthropicSourceParser`
4. 实现 `CodexSourceParser`
5. 实现 `OpenCodeSourceParser`
6. 更新 `sources/index.ts` 注册新解析器
7. 测试各数据源的抓取和解析

## 测试策略

- 单元测试：测试各解析器的日期解析、内容提取逻辑
- 集成测试：测试完整的抓取流程
- 边缘情况：空内容、格式变化、网络错误

## 风险与缓解

| 风险 | 缓解措施 |
|-----|---------|
| 源页面格式变化 | 使用灵活的正则匹配，添加详细日志 |
| 网络不稳定 | 重试机制，优雅降级 |
| 日期格式不一致 | `parseDateFlexible` 支持多种格式 |
