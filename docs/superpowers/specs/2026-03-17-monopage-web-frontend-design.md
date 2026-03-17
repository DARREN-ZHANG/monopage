# Monopage Web 前端设计文档

> **版本**: 1.0.0
> **日期**: 2026-03-17
> **状态**: 待批准

---

## 1. 项目概述

### 1.1 产品定位

**Monopage Web** - Monopage 服务的 Web 前端，提供极简的新闻阅读体验。

### 1.2 目标用户

个人使用 - 每天早晨快速浏览 OpenAI 和 Anthropic 的最新动态。

### 1.3 核心功能

- 用户名/密码登录认证
- 时间线视图展示新闻摘要
- 支持 7 天历史浏览
- Markdown 格式摘要渲染
- 响应式设计（移动端 + 桌面端）

### 1.4 技术栈

| 组件 | 技术选型 |
|------|---------|
| 框架 | React 18 |
| 构建 | Vite 5 |
| 数据获取 | TanStack Query 5 |
| 样式 | Tailwind CSS 3 |
| Markdown | react-markdown 9 |
| 运行时 | Cloudflare Pages |
| 语言 | TypeScript 5 |

---

## 2. 系统架构

### 2.1 架构图

```
┌─────────────────────────────────────────────────────────────┐
│                    Cloudflare Pages                         │
│  ┌─────────────────────────────────────────────────────────┐│
│  │                    React SPA                             ││
│  │  ┌─────────┐  ┌─────────┐  ┌─────────────────────────┐ ││
│  │  │ App.tsx │  │ Routes  │  │      Components         │ ││
│  │  │         │  │         │  │  • Header               │ ││
│  │  │         │  │ /       │  │  • DateSelector         │ ││
│  │  │         │  │ /login  │  │  • ArticleCard          │ ││
│  │  │         │  │         │  │  • ArticleList          │ ││
│  │  └────┬────┘  └────┬────┘  └───────────┬─────────────┘ ││
│  └───────┴────────────┴───────────────────┴───────────────┘│
└───────────────────────────┬─────────────────────────────────┘
                            │
                            ▼
              ┌─────────────────────────────┐
              │    Cloudflare Workers API   │
              │  • GET /articles            │
              │  • POST /login              │
              │  • POST /logout             │
              │  • GET /me                  │
              └─────────────────────────────┘
```

### 2.2 目录结构

```
packages/web/
├── index.html
├── package.json
├── tsconfig.json
├── vite.config.ts
├── wrangler.toml
│
└── src/
    ├── main.tsx                    # React 挂载点
    ├── App.tsx                     # 主应用入口
    │
    ├── components/
    │   ├── Layout/
    │   │   ├── Header.tsx          # 顶部导航栏
    │   │   └── LoadingScreen.tsx   # 加载屏幕
    │   │
    │   ├── Auth/
    │   │   ├── LoginPage.tsx       # 登录页
    │   │   └── LoginForm.tsx       # 登录表单
    │   │
    │   └── Articles/
    │       ├── ArticleCard.tsx     # 文章卡片
    │       ├── ArticleList.tsx     # 文章列表
    │       ├── DateSelector.tsx    # 日期选择器
    │       ├── EmptyState.tsx      # 空状态
    │       └── ErrorState.tsx      # 错误状态
    │
    ├── hooks/
    │   ├── useArticles.ts          # 文章数据获取
    │   └── useAuth.ts              # 认证状态管理
    │
    ├── api/
    │   └── client.ts               # API 客户端
    │
    ├── types/
    │   └── index.ts                # TypeScript 类型定义
    │
    └── styles/
        └── index.css               # Tailwind CSS 入口
```

---

## 3. 认证系统

### 3.1 认证流程

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│ 访问应用    │ ──→ │ 检查 Cookie │ ──→ │ 有效?       │
│             │     │ auth_token  │     │             │
└─────────────┘     └─────────────┘     └──────┬──────┘
                                               │
                            ┌──────────────────┴──────────────────┐
                            │                                     │
                            ▼ 是                                  ▼ 否
                   ┌─────────────────┐                 ┌─────────────────┐
                   │ 渲染主页        │                 │ 渲染登录页      │
                   └─────────────────┘                 └─────────────────┘
```

### 3.2 登录页面设计

```
┌─────────────────────────────────────────────┐
│                                             │
│              Monopage                       │
│                                             │
│         每日清晨，一览 AI 世界              │
│                                             │
│  ┌───────────────────────────────────────┐  │
│  │ 用户名                                │  │
│  └───────────────────────────────────────┘  │
│                                             │
│  ┌───────────────────────────────────────┐  │
│  │ 密码                                  │  │
│  └───────────────────────────────────────┘  │
│                                             │
│              [登录 →]                       │
│                                             │
└─────────────────────────────────────────────┘
```

### 3.3 Token 存储

- **方式**: HttpOnly Cookie（由后端设置）
- **属性**: `HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=604800`
- **有效期**: 7 天

### 3.4 认证状态管理

```typescript
// hooks/useAuth.ts

interface AuthState {
  user: string | null;
  isLoading: boolean;
  login: (username: string, password: string) => Promise<LoginResult>;
  logout: () => Promise<void>;
}

// 使用方式
const { user, isLoading, login, logout } = useAuth();
```

---

## 4. 页面设计

### 4.1 主页布局

```
┌─────────────────────────────────────────────────────────────┐
│  Monopage                              admin · [登出]       │
│                                        ─────────────────    │
│                                        [3月17日 周一 ▾]     │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ┌─────────────────────────────────────────────────────────┐│
│  │ [OpenAI]                                                 ││
│  │                                                          ││
│  │ OpenAI 发布 GPT-5，推理能力大幅提升                      ││
│  │                                                          ││
│  │ 2小时前                                                   ││
│  │                                                          ││
│  │ OpenAI 正式发布 GPT-5，这是其最新的旗舰模型。             ││
│  │                                                          ││
│  │ 核心更新：                                                ││
│  │ • 推理能力提升 40%                                        ││
│  │ • 支持 1M tokens 上下文窗口                               ││
│  │                                                          ││
│  │                                        [阅读原文 →]       ││
│  └─────────────────────────────────────────────────────────┘│
│                                                             │
│  ┌─────────────────────────────────────────────────────────┐│
│  │ [Anthropic]                                              ││
│  │                                                          ││
│  │ Claude 4 发布，多模态能力增强                             ││
│  │ ...                                                      ││
│  └─────────────────────────────────────────────────────────┘│
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### 4.2 组件层级

```
App
├── LoadingScreen（加载中）
├── LoginPage（未登录）
└── HomePage（已登录）
    ├── Header
    │   ├── Logo
    │   ├── UserInfo（用户名 + 登出按钮）
    │   └── DateSelector
    └── Main
        ├── LoadingState（加载中）
        ├── ErrorState（错误）
        ├── EmptyState（无数据）
        └── ArticleList
            └── ArticleCard（多个）
                ├── SourceBadge
                ├── Title
                ├── Meta（时间）
                ├── Summary（Markdown）
                └── Link（阅读原文）
```

---

## 5. 组件设计

### 5.1 Header

```typescript
interface HeaderProps {
  username: string;
  currentDate: string;
  onDateChange: (date: string) => void;
  onLogout: () => void;
}
```

**布局：**
- 左侧：Logo "Monopage"
- 右侧：用户名 · 登出按钮 · 日期选择器

### 5.2 DateSelector

```typescript
interface DateSelectorProps {
  value: string;           // YYYY-MM-DD
  onChange: (date: string) => void;
  maxDays?: number;        // 默认 7
}
```

**交互：**
- 显示当前日期（如 "3月17日 周一"）
- 点击弹出最近 7 天列表
- "今天" 快速选项
- 键盘导航支持

### 5.3 ArticleCard

```typescript
interface ArticleCardProps {
  article: Article;
}

interface Article {
  id: string;
  source: 'openai' | 'anthropic';
  title: string;
  summary_md: string;
  source_url: string;
  published_at: string;  // ISO 8601
}
```

**显示内容：**
- 来源徽章（灰色圆角标签）
- 标题（18px，600 weight）
- 相对时间（如 "2小时前"）
- Markdown 渲染的摘要
- "阅读原文" 链接（新窗口打开）

### 5.4 ArticleList

```typescript
interface ArticleListProps {
  articles: Article[];
}
```

**功能：**
- 按发布时间倒序排列
- 卡片间距 24px
- 响应式宽度（max-w-2xl 居中）

### 5.5 状态组件

**LoadingState:**
- 3 个骨架屏卡片
- 灰色脉冲动画

**EmptyState:**
- 中心显示 "暂无文章"
- 副标题："该日期还没有抓取到新闻"
- "查看今天" 按钮

**ErrorState:**
- 中心显示 "加载失败"
- 副标题：错误信息
- "重试" 按钮

---

## 6. 视觉设计规范

### 6.1 配色方案

| 变量 | 值 | 用途 |
|------|-----|------|
| `--bg-primary` | `#FFFFFF` | 页面背景 |
| `--bg-secondary` | `#FAFAFA` | 卡片 hover 背景 |
| `--text-primary` | `#111827` | 标题、正文 |
| `--text-secondary` | `#6B7280` | 时间、来源等次要信息 |
| `--text-tertiary` | `#9CA3AF` | 占位符、禁用状态 |
| `--border` | `#E5E7EB` | 分隔线、输入框边框 |
| `--accent` | `#111827` | 链接、交互元素 |

### 6.2 字体

```css
font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto,
             'Helvetica Neue', Arial, sans-serif;
```

| 元素 | 字号 | 字重 | 行高 |
|------|------|------|------|
| 页面标题 | 24px | 600 | 1.2 |
| 文章标题 | 18px | 600 | 1.4 |
| 正文/摘要 | 15px | 400 | 1.7 |
| 时间/来源 | 13px | 400 | 1.5 |
| 来源徽章 | 12px | 500 | 1 |

### 6.3 间距

| 名称 | 值 | 用途 |
|------|-----|------|
| `xs` | 4px | 图标与文字间距 |
| `sm` | 8px | 徽章内边距 |
| `md` | 16px | 卡片内边距、页面边距 |
| `lg` | 24px | 卡片间距、区块间距 |
| `xl` | 48px | 页面顶部内边距 |
| `content-max` | 672px | 内容区最大宽度 |

### 6.4 响应式断点

- **移动端（默认）**: 全宽，16px 左右边距
- **桌面端（≥768px）**: 居中，max-width 672px

---

## 7. 数据流

### 7.1 API 调用

```typescript
// hooks/useArticles.ts

export function useArticles(params: { date?: string }) {
  return useQuery({
    queryKey: ['articles', params],
    queryFn: () => fetchArticles(params),
    staleTime: 5 * 60 * 1000,  // 5 分钟
    gcTime: 30 * 60 * 1000,    // 30 分钟
    retry: 1,
  });
}
```

### 7.2 API 客户端

```typescript
// api/client.ts

export async function fetchArticles(params: ArticlesParams): Promise<ArticlesResponse> {
  const searchParams = new URLSearchParams();

  if (params.date) searchParams.set('date', params.date);
  searchParams.set('days', '7');

  const response = await fetch(`/articles?${searchParams}`, {
    credentials: 'include',  // 携带 Cookie
  });

  if (!response.ok) {
    if (response.status === 401) {
      throw new AuthError();
    }
    const error = await response.json();
    throw new ApiError(error);
  }

  return response.json();
}
```

### 7.3 类型定义

```typescript
// types/index.ts

export interface Article {
  id: string;
  source: 'openai' | 'anthropic';
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
    sources_included: ('openai' | 'anthropic')[];
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

export interface ApiErrorResponse {
  success: false;
  error: {
    code: string;
    code_num: number;
    message: string;
    retryable: boolean;
  };
}
```

---

## 8. 错误处理

### 8.1 认证错误

| 场景 | 处理 |
|------|------|
| Token 过期/无效 | 清除状态，跳转登录页 |
| 未登录访问 | 跳转登录页 |

### 8.2 API 错误

| 错误码 | 处理 |
|--------|------|
| 401 | 跳转登录页 |
| 429 | 显示"请求过于频繁，请稍后重试" |
| 5xx | 显示"服务暂时不可用，请稍后重试" |
| 网络错误 | 显示"网络错误，请检查网络连接" |

---

## 9. 依赖清单

```json
{
  "dependencies": {
    "react": "^18.2.0",
    "react-dom": "^18.2.0",
    "@tanstack/react-query": "^5.0.0",
    "react-markdown": "^9.0.0"
  },
  "devDependencies": {
    "@types/react": "^18.2.0",
    "@types/react-dom": "^18.2.0",
    "@vitejs/plugin-react": "^4.0.0",
    "autoprefixer": "^10.4.0",
    "postcss": "^8.4.0",
    "tailwindcss": "^3.4.0",
    "typescript": "^5.0.0",
    "vite": "^5.0.0",
    "wrangler": "^3.0.0"
  }
}
```

---

## 10. 后端变更清单

### 10.1 新增 API 端点

| 端点 | 方法 | 说明 |
|------|------|------|
| `/login` | POST | 用户名密码登录，返回 HttpOnly Cookie |
| `/logout` | POST | 清除 Cookie，登出 |
| `/me` | GET | 获取当前登录用户信息 |

### 10.2 新增 KV 存储

| Key | Value | 说明 |
|-----|-------|------|
| `users:{username}` | `{"password_hash": "bcrypt...", "created_at": "..."}` | 用户凭证 |

### 10.3 新增 Secret

| Secret | 说明 |
|--------|------|
| `JWT_SECRET` | JWT 签名密钥（32 字节随机字符串） |

### 10.4 修改认证中间件

- 从 `Authorization` Header 改为从 Cookie 读取 `auth_token`
- 验证 JWT 有效性

### 10.5 新增错误码

| 错误码 | 常量 | HTTP | 说明 |
|--------|------|------|------|
| 1004 | `AUTH_INVALID_CREDENTIALS` | 401 | 用户名或密码错误 |

---

## 11. 部署配置

### 11.1 wrangler.toml（前端）

```toml
name = "monopage-web"
compatibility_date = "2024-03-16"
pages_build_output_dir = "./dist"
```

### 11.2 同域路由配置

在 Cloudflare Dashboard 配置：

| 路径 | 目标 |
|------|------|
| `/articles/*` | monopage-api Worker |
| `/login` | monopage-api Worker |
| `/logout` | monopage-api Worker |
| `/me` | monopage-api Worker |
| `/*` | monopage-web Pages |

### 11.3 部署命令

```bash
# 前端部署
pnpm -F @monopage/web deploy

# 后端部署（如果修改了）
pnpm -F @monopage/api deploy

# 设置 Secret（首次）
wrangler secret put JWT_SECRET
```

---

## 12. 测试策略

### 12.1 单元测试

- 组件渲染测试
- Hook 逻辑测试
- 工具函数测试

### 12.2 集成测试

- API 客户端测试
- 认证流程测试

### 12.3 E2E 测试

- 登录流程
- 文章浏览
- 日期切换

---

## 13. 关键设计决策

| 决策 | 选择 | 理由 |
|------|------|------|
| UI 复杂度 | 单页应用 | 个人使用，不需要复杂导航 |
| 布局 | 单栏卡片列表 | 极简风格，专注阅读 |
| 视觉风格 | 黑白灰极简 | 少即是多 |
| Token 存储 | HttpOnly Cookie | 安全，防 XSS |
| 数据获取 | TanStack Query | 自动缓存、重试、去重 |
| 样式方案 | Tailwind CSS | 快速开发，一致性好 |
