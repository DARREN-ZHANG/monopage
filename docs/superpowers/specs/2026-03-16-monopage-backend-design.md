# Monopage Backend 设计文档

> **版本**: 1.0.0
> **日期**: 2026-03-16
> **状态**: 已批准

---

## 1. 项目概述

### 1.1 产品定位

**Monopage** - 基于 Cloudflare 的 AI 新闻聚合服务，帮助用户每天早晨通过单页阅读了解 OpenAI 和 Anthropic 的最新动态。

### 1.2 核心功能

- 每日自动抓取 OpenAI 和 Anthropic 的新闻页面
- 使用 LLM 生成中文 Markdown 格式摘要
- 提供 REST API 供外部调用，支持历史查询（7天）
- 支持手动触发刷新

### 1.3 技术栈

| 组件 | 技术选型 |
|------|---------|
| 运行时 | Cloudflare Workers |
| 存储 | Cloudflare Workers KV |
| 定时任务 | Cloudflare Cron Triggers |
| LLM（默认） | Cloudflare Workers AI - Llama 4 Scout 17B |
| 语言 | TypeScript |
| 包管理 | pnpm (monorepo) |

---

## 2. 系统架构

### 2.1 架构图

```
┌─────────────────────────────────────────────────────────────────┐
│                        Cloudflare Workers                         │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────────┐  │
│  │   API 路由   │  │  定时任务    │  │      抓取 & 总结      │  │
│  │  /articles   │  │ Cron Trigger │  │   Scraper + Summarizer │  │
│  │  /refresh   │  │  (每日早晨)   │  │                         │  │
│  └──────┬──────┘  └──────┬──────┘  └───────────┬─────────────┘  │
│         │                  │                      │               │
│         ▼                  ▼                      ▼               │
│  ┌────────────────────────────────────────────────────────────┐  │
│  │                    Workers KV (存储层)                        │  │
│  │  • summary:{source}:{date}:{id} → 摘要内容 + 原文链接       │  │
│  │  • index:{date} → 按来源分类的文章 ID                        │  │
│  │  • config → API Token、限流计数器等配置                      │  │
│  └────────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
```

### 2.2 核心组件

| 组件 | 职责 |
|------|------|
| API Worker | 处理 HTTP 请求，Token 认证、限流、查询历史 |
| Cron Trigger | 每天固定时间触发抓取任务 |
| Scraper | 抓取网页、解析内容 |
| Summarizer | 调用 LLM 生成摘要 |
| Workers KV | 存储文章数据和历史索引 |

---

## 3. 数据存储设计

### 3.1 KV 存储结构

| Key | Value 示例 | 说明 |
|-----|-------------|------|
| `summary:openai:2024-03-16:abc123` | `{"title": "...", "summary_md": "...", "source_url": "...", "published_at": "..."}` | 文章摘要 |
| `summary:anthropic:2024-03-16:def456` | 同上 | 文章摘要 |
| `index:2024-03-16` | `{"openai": ["abc123", "def456"], "anthropic": ["ghi789"]}` | 按来源分类的索引 |
| `config` | `{"api_token": "...", "rate_limit": {"limit": 100, "current": 0, "reset_at": "..."}}` | 配置信息 |

### 3.2 存储原则

- 仅存储摘要 + 原文链接，不存储文章正文
- 历史数据保留 7 天
- 索引按来源分类，便于扩展新数据源

---

## 4. API 设计

### 4.1 端点概览

| 端点 | 方法 | 说明 |
|------|------|------|
| `/articles` | GET | 获取文章摘要列表（分页） |
| `/refresh` | POST | 手动触发刷新（按需抓取） |

### 4.2 GET /articles

**请求参数：**

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `date` | string | 否 | 日期，格式 `YYYY-MM-DD`，默认今天 |
| `source` | string | 否 | 数据源，可选 `openai`/`anthropic`，不传返回全部 |
| `days` | number | 否 | 查询最近 N 天，默认 1，最大 7 |
| `page` | number | 否 | 页码，默认 1 |
| `page_size` | number | 否 | 每页条数，默认 10，最大 50 |

**请求头：**

```
Authorization: Bearer <token>
```

**响应示例：**

```json
{
  "success": true,
  "data": {
    "articles": [
      {
        "id": "openai:2024-03-16:abc123",
        "source": "openai",
        "title": "Introducing GPT-5",
        "summary_md": "OpenAI 发布了 GPT-5，主要更新包括：\n\n- 更强的推理能力\n- 多模态支持增强\n- ...",
        "source_url": "https://openai.com/news/gpt-5",
        "published_at": "2024-03-16T10:00:00Z"
      }
    ]
  },
  "meta": {
    "page": 1,
    "page_size": 10,
    "total_count": 15,
    "total_pages": 2,
    "sources_included": ["openai", "anthropic"],
    "date_range": {
      "from": "2024-03-15",
      "to": "2024-03-16"
    },
    "last_refreshed_at": "2024-03-16T06:00:00Z"
  }
}
```

**分页逻辑：**
- 按 `published_at` 倒序排列（最新的在前）
- 跨日期、跨来源混合排序

### 4.3 POST /refresh

**请求头：**

```
Authorization: Bearer <token>
```

**请求体（可选）：**

```json
{
  "source": "openai"
}
```

**响应示例：**

```json
{
  "success": true,
  "data": {
    "refreshed_sources": ["openai", "anthropic"],
    "articles_found": 5,
    "articles_summarized": 5,
    "articles_skipped": {
      "duplicate": 2,
      "incomplete_metadata": 1
    },
    "errors": []
  }
}
```

---

## 5. 认证与限流

### 5.1 Token 认证

**存储方式：**
- Token 存储在 KV 的 `config` key 中

**认证流程：**
```
请求 → 检查 Authorization Header → 验证 Token → 通过/拒绝
```

### 5.2 全局限流

| 指标 | 值 |
|------|-----|
| 限流维度 | 全局（不区分 Token/IP） |
| 限制 | 100 次/小时 |
| 重置周期 | 每小时整点重置 |

**KV 存储：**
```json
{
  "api_token": "your-secret-token",
  "rate_limit": {
    "limit": 100,
    "current": 45,
    "reset_at": "2024-03-16T11:00:00Z"
  }
}
```

---

## 6. 数据抓取与总结流程

### 6.1 流程图

```
┌─────────────┐    ┌─────────────┐    ┌─────────────┐    ┌─────────────┐
│  请求新闻页  │ → │  解析文章列表 │ → │  过滤24h内  │ → │  去重检查   │
└─────────────┘    └─────────────┘    └─────────────┘    └─────────────┘
                                                                ↓
┌─────────────┐    ┌─────────────┐    ┌─────────────┐    ┌─────────────┐
│   返回结果   │ ← │  存储到KV   │ ← │  生成摘要   │ ← │  调用LLM总结 │
└─────────────┘    └─────────────┘    └─────────────┘    └─────────────┘
```

### 6.2 步骤说明

| 步骤 | 说明 |
|------|------|
| 请求新闻页 | 使用 `fetch` 请求页面 HTML |
| 解析文章列表 | 提取文章标题、链接、发布时间 |
| 过滤 24h 内 | 只保留最近 24 小时的文章 |
| **去重检查** | 检查 KV 是否已存在，跳过已处理的文章 |
| 调用 LLM 总结 | 只对新文章调用 LLM |
| 生成摘要 | 生成 Markdown 格式摘要 |
| 存储到 KV | 写入摘要数据和索引 |
| 返回结果 | 返回本次处理统计 |

---

## 7. 错误处理

### 7.1 错误码规则

**格式：** `模块前缀(2位) + 错误序号(2位) = 4位数字`

| 模块 | 前缀 |
|------|------|
| 认证 | 10 |
| 参数验证 | 20 |
| 限流 | 30 |
| 数据源 | 40 |
| LLM | 50 |
| 存储 | 60 |
| 系统 | 90 |

### 7.2 认证错误 (10xx)

| 错误码 | 常量 | HTTP | 说明 | 可重试 |
|--------|------|------|------|--------|
| 1001 | `AUTH_MISSING` | 401 | 缺少 Authorization Header | 否 |
| 1002 | `AUTH_INVALID_FORMAT` | 401 | Token 格式错误（非 Bearer 格式） | 否 |
| 1003 | `AUTH_INVALID_TOKEN` | 401 | Token 无效或不匹配 | 否 |

### 7.3 参数验证错误 (20xx)

| 错误码 | 常量 | HTTP | 说明 | 可重试 |
|--------|------|------|------|--------|
| 2001 | `VALIDATION_INVALID_DATE` | 400 | date 参数格式错误，期望 YYYY-MM-DD | 否 |
| 2002 | `VALIDATION_INVALID_SOURCE` | 400 | source 参数值无效，期望 openai/anthropic | 否 |
| 2003 | `VALIDATION_INVALID_PAGE` | 400 | page 参数必须是正整数 | 否 |
| 2004 | `VALIDATION_INVALID_PAGE_SIZE` | 400 | page_size 必须在 1-50 之间 | 否 |
| 2005 | `VALIDATION_INVALID_DAYS` | 400 | days 必须在 1-7 之间 | 否 |

### 7.4 限流错误 (30xx)

| 错误码 | 常量 | HTTP | 说明 | 可重试 |
|--------|------|------|------|--------|
| 3001 | `RATE_LIMITED` | 429 | 超过全局限流阈值 | 是 |

### 7.5 数据源错误 (40xx)

| 错误码 | 常量 | HTTP | 说明 | 可重试 |
|--------|------|------|------|--------|
| 4001 | `SOURCE_FETCH_FAILED` | - | 页面请求失败（网络错误） | 是 |
| 4002 | `SOURCE_HTTP_ERROR` | - | 页面返回非 2xx 状态码 | 4xx 否，5xx 是 |
| 4003 | `SOURCE_TIMEOUT` | - | 页面请求超时 | 是 |
| 4004 | `SOURCE_PARSE_FAILED` | - | HTML 解析失败，未找到预期结构 | 否 |
| 4005 | `SOURCE_EMPTY_ARTICLES` | - | 解析成功但未找到任何文章 | 是 |
| 4006 | `SOURCE_ARTICLE_INCOMPLETE` | - | 文章缺少必要元数据（标题/链接/时间） | 否 |
| 4007 | `SOURCE_CONTENT_FETCH_FAILED` | - | 获取文章正文失败 | 是 |

### 7.6 LLM 错误 (50xx)

| 错误码 | 常量 | HTTP | 说明 | 可重试 |
|--------|------|------|------|--------|
| 5001 | `LLM_REQUEST_FAILED` | - | LLM API 请求失败（网络错误） | 是 |
| 5002 | `LLM_TIMEOUT` | - | LLM API 超时 | 是 |
| 5003 | `LLM_RATE_LIMITED` | - | LLM API 限流 | 是（等待后） |
| 5004 | `LLM_QUOTA_EXCEEDED` | - | LLM 配额耗尽 | 是（配额重置后） |
| 5005 | `LLM_INVALID_RESPONSE` | - | LLM 返回内容格式不符合预期 | 是 |
| 5006 | `LLM_EMPTY_RESPONSE` | - | LLM 返回空内容 | 是 |
| 5007 | `LLM_AUTH_FAILED` | - | LLM API Key 无效或过期 | 否 |

### 7.7 存储错误 (60xx)

| 错误码 | 常量 | HTTP | 说明 | 可重试 |
|--------|------|------|------|--------|
| 6001 | `KV_READ_FAILED` | - | KV 读取操作失败 | 是 |
| 6002 | `KV_WRITE_FAILED` | - | KV 写入操作失败 | 是 |
| 6003 | `KV_TIMEOUT` | - | KV 操作超时 | 是 |
| 6004 | `KV_DELETE_FAILED` | - | KV 删除操作失败（清理过期数据时） | 是 |

### 7.8 系统错误 (90xx)

| 错误码 | 常量 | HTTP | 说明 | 可重试 |
|--------|------|------|------|--------|
| 9001 | `INTERNAL_ERROR` | 500 | 未预期的内部错误 | 是 |
| 9002 | `SERVICE_UNAVAILABLE` | 503 | 服务暂时不可用 | 是 |
| 9003 | `CONFIG_MISSING` | 500 | 必需的配置/环境变量缺失 | 否 |
| 9004 | `CONFIG_INVALID` | 500 | 配置格式错误 | 否 |

### 7.9 错误响应格式

```json
{
  "success": false,
  "error": {
    "code": "AUTH_INVALID_TOKEN",
    "code_num": 1003,
    "message": "The provided API token is invalid",
    "retryable": false
  }
}
```

---

## 8. 数据源解析器

### 8.1 接口定义

```typescript
interface Article {
  id: string           // 唯一标识，用于去重
  title: string        // 文章标题
  url: string          // 原文链接
  published_at: Date   // 发布时间
  content?: string     // 正文内容（可选，用于总结）
}

interface SourceConfig {
  name: string         // 数据源名称
  baseUrl: string      // 基础 URL
  newsUrl: string      // 新闻页面 URL
}
```

### 8.2 OpenAI News 解析器

| 配置项 | 值 |
|--------|-----|
| name | `openai` |
| baseUrl | `https://openai.com` |
| newsUrl | `https://openai.com/news` |

**解析策略：**

| 项目 | 选择器/方法 | 备选方案 |
|------|-------------|---------|
| 文章列表 | RSS Feed `/blog/rss.xml` | HTML 解析页面文章卡片 |
| 标题 | `<item>/<title>` | 文章卡片标题元素 |
| 链接 | `<item>/<link>` | 文章卡片链接属性 |
| 发布时间 | `<item>/<pubDate>` | 页面日期元素或 URL 日期 |
| 正文 | 抓取文章页面正文 | 使用 RSS description |

### 8.3 Anthropic News 解析器

| 配置项 | 值 |
|--------|-----|
| name | `anthropic` |
| baseUrl | `https://www.anthropic.com` |
| newsUrl | `https://www.anthropic.com/news` |

**解析策略：**

| 项目 | 选择器/方法 | 备选方案 |
|------|-------------|---------|
| 文章列表 | 页面文章卡片列表 | - |
| 标题 | 文章标题元素 | meta og:title |
| 链接 | 文章链接属性 | - |
| 发布时间 | 页面日期元素 | URL 日期 / meta date |
| 正文 | 抓取文章页面正文 | 页面描述文本 |

### 8.4 ID 生成规则

**格式：** `{来源}_{内容哈希}`

```typescript
function generateId(source: string, article: Article): string {
  const content = article.url || article.title
  const hash = sha256(content).slice(0, 12)
  return `${source}_${hash}`
}
```

**示例：**
- `openai_a1b2c3d4e5f6`
- `anthropic_7g8h9i0j1k2`

---

## 9. LLM Prompt 设计

### 9.1 系统提示词

```
你是一个科技新闻摘要助手。你的任务是将 AI 公司的新闻文章总结为简洁、信息量大的中文摘要。

要求：
1. 使用 Markdown 格式
2. 保持客观，不添加个人观点
3. 突出关键信息：产品名称、核心功能、技术亮点、影响范围
4. 省略营销性描述和无关细节
5. 如果是更新/版本发布，列出主要变更点（使用无序列表）
6. 确保核心内容完整传达，不要为了压缩字数而丢失关键信息
7. 字数控制在 300 词以内，但优先保证内容完整性
```

### 9.2 用户提示词模板

```
请总结以下文章：

标题：{article_title}
链接：{article_url}
内容：
{article_content}
```

### 9.3 期望输出示例

```markdown
OpenAI 发布 GPT-4.5，推理能力大幅提升

OpenAI 正式发布 GPT-4.5，这是其最新的旗舰模型。

**核心更新：**
- 推理能力提升 40%，复杂任务表现显著改善
- 支持 1M tokens 上下文窗口
- 多模态能力增强，支持图像、音频、视频理解
- 新增工具调用能力，支持并行函数调用
- 幻觉率降低 50%

**定价：** 输入 $15/1M tokens，输出 $60/1M tokens

**可用性：** 即日起向 Plus 用户开放，API 将于下周推出。
```

### 9.4 LLM 提供商配置

| 提供商 | 默认模型 | 推荐升级模型 | 备注 |
|--------|---------|-------------|------|
| Cloudflare | `@cf/meta/llama-4-scout-17b-16e-instruct` | - | 17B 参数，128K 上下文，免费额度内可用 |
| OpenAI | `gpt-4o-mini` | `gpt-4o` | 平衡成本与质量 |
| Anthropic | `claude-3-5-haiku-20241022` | `claude-sonnet-4-20250514` | 高质量摘要 |

### 9.5 LLM 调用参数

```typescript
interface LLMRequest {
  max_tokens: 800      // 输出限制
  temperature: 0.3     // 稍低温度保证稳定性
}
```

### 9.6 重试策略

| 参数 | 值 |
|------|-----|
| 最大重试次数 | 2 |
| 重试延迟 | [1000ms, 3000ms] |
| 可重试错误 | REQUEST_FAILED, TIMEOUT, RATE_LIMITED, INVALID_RESPONSE, EMPTY_RESPONSE |

---

## 10. 配置与部署

### 10.1 Monorepo 文件结构

```
monopage/
├── packages/
│   ├── api/                          # 后端 API 服务
│   │   ├── src/
│   │   │   ├── index.ts              # Worker 入口，路由分发
│   │   │   ├── routes/
│   │   │   │   ├── articles.ts       # GET /articles 处理
│   │     │   │   └── refresh.ts      # POST /refresh 处理
│   │   │   ├── services/
│   │   │   │   ├── scraper.ts        # 页面抓取与解析
│   │   │   │   ├── summarizer.ts     # LLM 总结服务
│   │   │   │   └── storage.ts        # KV 存储封装
│   │   │   ├── providers/
│   │   │   │   ├── base.ts           # LLM Provider 接口定义
│   │   │   │   ├── cloudflare.ts     # Cloudflare Workers AI 实现
│   │   │   │   ├── openai.ts         # OpenAI API 实现
│   │   │   │   └── anthropic.ts      # Anthropic API 实现
│   │   │   ├── sources/
│   │   │   │   ├── base.ts           # 数据源接口定义
│   │   │   │   ├── openai.ts         # OpenAI News 解析器
│   │   │   │   └── anthropic.ts      # Anthropic News 解析器
│   │   │   ├── middleware/
│   │   │   │   ├── auth.ts           # Token 认证中间件
│   │   │   │   └── rateLimit.ts      # 限流中间件
│   │   │   ├── utils/
│   │   │   │   ├── errors.ts         # 错误码定义与错误类
│   │   │   │   └── response.ts       # 响应格式化工具
│   │   │   └── types.ts              # TypeScript 类型定义
│   │   ├── wrangler.toml             # Cloudflare Workers 配置
│   │   ├── package.json
│   │   └── tsconfig.json
│   │
│   └── web/                          # Web 前端（预留）
│       ├── src/
│       ├── package.json
│       └── tsconfig.json
│
├── package.json                      # Monorepo 根配置
├── pnpm-workspace.yaml               # pnpm workspace 配置
└── tsconfig.json                     # 共享 TypeScript 配置
```

### 10.2 根目录 package.json

```json
{
  "name": "monopage",
  "private": true,
  "scripts": {
    "dev": "pnpm -F @monopage/api dev",
    "deploy": "pnpm -F @monopage/api deploy",
    "build": "pnpm -r build"
  },
  "devDependencies": {
    "typescript": "^5.0.0"
  }
}
```

### 10.3 pnpm-workspace.yaml

```yaml
packages:
  - 'packages/*'
```

### 10.4 packages/api/wrangler.toml

```toml
name = "monopage-api"
main = "src/index.ts"
compatibility_date = "2024-03-16"

# KV 命名空间绑定
[[kv_namespaces]]
binding = "KV"
id = "your-kv-namespace-id"

# 定时任务
[triggers]
crons = ["0 6 * * *"]

# 环境变量
[vars]
LLM_PROVIDER = "cloudflare"
LLM_MODEL = "@cf/meta/llama-4-scout-17b-16e-instruct"
RATE_LIMIT_PER_HOUR = "100"

# 开发环境
[env.development]
[env.development.vars]
LLM_PROVIDER = "cloudflare"
```

### 10.5 packages/api/package.json

```json
{
  "name": "@monopage/api",
  "version": "1.0.0",
  "main": "src/index.ts",
  "scripts": {
    "dev": "wrangler dev",
    "deploy": "wrangler deploy",
    "build": "wrangler build"
  }
}
```

### 10.6 Secrets（敏感配置）

| Secret | 说明 | 必需 |
|--------|------|------|
| `API_TOKEN` | API 认证 Token | 是 |
| `OPENAI_API_KEY` | OpenAI API Key | 仅当 LLM_PROVIDER=openai |
| `ANTHROPIC_API_KEY` | Anthropic API Key | 仅当 LLM_PROVIDER=anthropic |

**设置方式：**
```bash
wrangler secret put API_TOKEN
wrangler secret put OPENAI_API_KEY
wrangler secret put ANTHROPIC_API_KEY
```

### 10.7 环境变量完整列表

| 变量名 | 类型 | 默认值 | 说明 |
|--------|------|--------|------|
| `LLM_PROVIDER` | string | `cloudflare` | LLM 提供商：cloudflare/openai/anthropic |
| `LLM_MODEL` | string | - | 使用的模型（各提供商不同） |
| `LLM_TIMEOUT_MS` | number | `30000` | LLM 请求超时时间（毫秒） |
| `RATE_LIMIT_PER_HOUR` | number | `100` | 每小时请求限制 |
| `SCRAPER_TIMEOUT_MS` | number | `15000` | 页面抓取超时时间（毫秒） |
| `HISTORY_DAYS` | number | `7` | 历史数据保留天数 |

### 10.8 数据清理策略

| 时机 | 操作 |
|------|------|
| 每次刷新后 | 检查并删除超过 `HISTORY_DAYS` 天的数据 |
| KV Key 模式 | `summary:*:{过期日期}:*` |
| 索引清理 | 删除 `index:{过期日期}` |

---

## 11. 定时任务

### 11.1 Cron 配置

```
0 6 * * *  # 每天 UTC 时间 06:00（北京时间 14:00）
```

### 11.2 触发方式

| 方式 | 说明 |
|------|------|
| Cron Trigger | 每天自动触发 |
| POST /refresh | 手动触发，支持指定来源 |

### 11.3 Cron 处理逻辑

```
Cron 触发 → 遍历所有数据源 → 依次抓取总结 → 更新 KV → 清理过期数据 → 结束
```

---

## 12. 关键设计决策

| 决策 | 选择 | 理由 |
|------|------|------|
| 存储内容 | 仅摘要 + 原链接 | 节省存储，满足需求 |
| 索引结构 | 按来源分类 | 便于扩展新数据源 |
| 去重时机 | LLM 调用前 | 避免重复消耗资源 |
| 限流策略 | 全局限流 | 防止免费额度被滥用 |
| 默认 LLM | Llama 4 Scout 17B | 免费额度、128K 上下文、多语言支持 |
| 项目结构 | Monorepo | 便于后续扩展 Web 前端 |
