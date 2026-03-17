# Monopage Web 前端实现计划

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 为 Monopage 构建极简的 Web 前端，支持用户名/密码登录和新闻摘要浏览。

**Architecture:** 前端使用 React + Vite + TanStack Query，后端添加 JWT 认证系统。前后端部署到 Cloudflare 同域，通过 Cookie 进行认证。

**Tech Stack:** React 18, Vite 5, TanStack Query 5, Tailwind CSS 3, react-markdown 9, TypeScript 5, Cloudflare Workers JWT

---

## 文件结构

### 后端新增/修改文件

| 文件 | 操作 | 职责 |
|------|------|------|
| `packages/api/src/utils/jwt.ts` | 创建 | JWT 签名和验证 |
| `packages/api/src/routes/login.ts` | 创建 | POST /login 端点 |
| `packages/api/src/routes/logout.ts` | 创建 | POST /logout 端点 |
| `packages/api/src/routes/me.ts` | 创建 | GET /me 端点 |
| `packages/api/src/middleware/auth.ts` | 修改 | 从 Cookie 读取 JWT |
| `packages/api/src/utils/errors.ts` | 修改 | 添加 AUTH_INVALID_CREDENTIALS 错误码 |
| `packages/api/src/types.ts` | 修改 | 添加 JWT_SECRET 环境变量 |
| `packages/api/src/index.ts` | 修改 | 注册新路由 |

### 前端文件

| 文件 | 操作 | 职责 |
|------|------|------|
| `packages/web/package.json` | 创建 | 依赖配置 |
| `packages/web/tsconfig.json` | 创建 | TypeScript 配置 |
| `packages/web/vite.config.ts` | 创建 | Vite 构建配置 |
| `packages/web/tailwind.config.js` | 创建 | Tailwind CSS 配置 |
| `packages/web/postcss.config.js` | 创建 | PostCSS 配置 |
| `packages/web/wrangler.toml` | 创建 | Cloudflare Pages 配置 |
| `packages/web/index.html` | 创建 | HTML 入口 |
| `packages/web/src/main.tsx` | 创建 | React 挂载点 |
| `packages/web/src/App.tsx` | 创建 | 主应用入口 |
| `packages/web/src/types/index.ts` | 创建 | TypeScript 类型定义 |
| `packages/web/src/api/client.ts` | 创建 | API 客户端 |
| `packages/web/src/hooks/useAuth.ts` | 创建 | 认证状态管理 |
| `packages/web/src/hooks/useArticles.ts` | 创建 | 文章数据获取 |
| `packages/web/src/components/Layout/Header.tsx` | 创建 | 顶部导航栏 |
| `packages/web/src/components/Layout/LoadingScreen.tsx` | 创建 | 加载屏幕 |
| `packages/web/src/components/Auth/LoginPage.tsx` | 创建 | 登录页面 |
| `packages/web/src/components/Auth/LoginForm.tsx` | 创建 | 登录表单 |
| `packages/web/src/components/Articles/ArticleCard.tsx` | 创建 | 文章卡片 |
| `packages/web/src/components/Articles/ArticleList.tsx` | 创建 | 文章列表 |
| `packages/web/src/components/Articles/DateSelector.tsx` | 创建 | 日期选择器 |
| `packages/web/src/components/Articles/EmptyState.tsx` | 创建 | 空状态 |
| `packages/web/src/components/Articles/ErrorState.tsx` | 创建 | 错误状态 |
| `packages/web/src/styles/index.css` | 创建 | Tailwind 入口 |
| `packages/web/src/utils/date.ts` | 创建 | 日期工具函数 |
| `pnpm-workspace.yaml` | 修改 | 添加 web 包 |

---

## Task 1: 后端 JWT 工具函数

**Files:**
- Create: `packages/api/src/utils/jwt.ts`

- [ ] **Step 1: 安装 JWT 依赖**

```bash
cd /Users/xlzj/Desktop/Projects/monopage/packages/api && pnpm add @tsndr/cloudflare-worker-jwt
```

Expected: 依赖安装成功

- [ ] **Step 2: 创建 JWT 工具函数**

```typescript
// packages/api/src/utils/jwt.ts

import jwt from '@tsndr/cloudflare-worker-jwt';

interface JWTPayload {
  username: string;
  iat: number;
  exp: number;
}

const JWT_EXPIRY_DAYS = 7;

export async function signToken(username: string, secret: string): Promise<string> {
  return jwt.sign(
    { username },
    secret,
    { exp: `${JWT_EXPIRY_DAYS}d` }
  );
}

export async function verifyToken(token: string, secret: string): Promise<JWTPayload | null> {
  try {
    const valid = await jwt.verify(token, secret);
    if (!valid) {
      return null;
    }
    const payload = jwt.decode(token);
    return payload?.payload as JWTPayload | null;
  } catch {
    return null;
  }
}
```

- [ ] **Step 3: 提交**

```bash
git add packages/api/src/utils/jwt.ts packages/api/package.json
git commit -m "feat(api): add JWT utility functions"
```

---

## Task 2: 后端添加认证错误码

**Files:**
- Modify: `packages/api/src/utils/errors.ts:7-9`

- [ ] **Step 1: 添加 AUTH_INVALID_CREDENTIALS 错误码**

在 `ErrorCodes` 对象的 `AUTH_INVALID_TOKEN` 后面添加：

```typescript
// packages/api/src/utils/errors.ts (第 8 行后添加)

  AUTH_INVALID_CREDENTIALS: { code: 'AUTH_INVALID_CREDENTIALS', num: 1004, http: 401, message: '用户名或密码错误', retryable: false },
```

- [ ] **Step 2: 提交**

```bash
git add packages/api/src/utils/errors.ts
git commit -m "feat(api): add AUTH_INVALID_CREDENTIALS error code"
```

---

## Task 3: 后端添加 JWT_SECRET 环境变量类型

**Files:**
- Modify: `packages/api/src/types.ts`

- [ ] **Step 1: 添加 JWT_SECRET 到 Env 接口**

在 `Env` 接口中添加：

```typescript
// packages/api/src/types.ts (Env 接口中添加)

  JWT_SECRET?: string;
```

- [ ] **Step 2: 提交**

```bash
git add packages/api/src/types.ts
git commit -m "feat(api): add JWT_SECRET to Env type"
```

---

## Task 4: 后端创建 login 路由

**Files:**
- Create: `packages/api/src/routes/login.ts`

- [ ] **Step 1: 创建 login 路由处理函数**

```typescript
// packages/api/src/routes/login.ts

import { AppError, ErrorCodes } from '../utils/errors.js';
import { jsonResponse } from '../utils/response.js';
import { signToken } from '../utils/jwt.js';
import type { Env } from '../types.js';

interface LoginRequest {
  username: string;
  password: string;
}

interface UserData {
  password_hash: string;
  created_at: string;
}

// 简单密码验证（不使用 bcrypt，Cloudflare Workers 兼容性）
function verifyPassword(password: string, storedHash: string): boolean {
  return password === storedHash;
}

export async function handleLogin(request: Request, env: Env): Promise<Response> {
  // 解析请求体
  let body: LoginRequest;
  try {
    body = await request.json() as LoginRequest;
  } catch {
    throw new AppError('VALIDATION_INVALID_JSON');
  }

  const { username, password } = body;

  // 基本验证
  if (!username || !password) {
    throw new AppError('AUTH_INVALID_CREDENTIALS');
  }

  // 从 KV 读取用户数据
  const userKey = `users:${username}`;
  const userDataStr = await env.KV.get(userKey);

  if (!userDataStr) {
    throw new AppError('AUTH_INVALID_CREDENTIALS');
  }

  let userData: UserData;
  try {
    userData = JSON.parse(userDataStr) as UserData;
  } catch {
    throw new AppError('AUTH_INVALID_CREDENTIALS');
  }

  // 验证密码
  if (!verifyPassword(password, userData.password_hash)) {
    throw new AppError('AUTH_INVALID_CREDENTIALS');
  }

  // 检查 JWT_SECRET
  const jwtSecret = env.JWT_SECRET;
  if (!jwtSecret) {
    throw new AppError('CONFIG_MISSING');
  }

  // 生成 JWT
  const token = await signToken(username, jwtSecret);

  // 返回成功响应，设置 HttpOnly Cookie
  const response = jsonResponse({
    success: true,
    data: { username },
  });

  // 设置 Cookie
  response.headers.set(
    'Set-Cookie',
    `auth_token=${token}; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=604800`
  );

  return response;
}
```

- [ ] **Step 2: 提交**

```bash
git add packages/api/src/routes/login.ts
git commit -m "feat(api): add /login endpoint with JWT cookie"
```

---

## Task 5: 后端创建 logout 路由

**Files:**
- Create: `packages/api/src/routes/logout.ts`

- [ ] **Step 1: 创建 logout 路由处理函数**

```typescript
// packages/api/src/routes/logout.ts

import { jsonResponse } from '../utils/response.js';
import type { Env } from '../types.js';

export async function handleLogout(request: Request, env: Env): Promise<Response> {
  const response = jsonResponse({
    success: true,
    data: null,
  });

  // 清除 Cookie
  response.headers.set(
    'Set-Cookie',
    'auth_token=; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=0'
  );

  return response;
}
```

- [ ] **Step 2: 提交**

```bash
git add packages/api/src/routes/logout.ts
git commit -m "feat(api): add /logout endpoint"
```

---

## Task 6: 后端创建 me 路由

**Files:**
- Create: `packages/api/src/routes/me.ts`

- [ ] **Step 1: 创建 me 路由处理函数**

```typescript
// packages/api/src/routes/me.ts

import { jsonResponse } from '../utils/response.js';
import { getAuthenticatedUser } from '../middleware/auth.js';
import type { Env } from '../types.js';

export async function handleMe(request: Request, env: Env): Promise<Response> {
  const username = await getAuthenticatedUser(request, env);

  return jsonResponse({
    success: true,
    data: { username },
  });
}
```

- [ ] **Step 2: 提交**

```bash
git add packages/api/src/routes/me.ts
git commit -m "feat(api): add /me endpoint for current user"
```

---

## Task 7: 后端修改认证中间件

**Files:**
- Modify: `packages/api/src/middleware/auth.ts`

- [ ] **Step 1: 重写认证中间件，支持 Cookie 中的 JWT**

```typescript
// packages/api/src/middleware/auth.ts

import { AppError } from '../utils/errors.js';
import { verifyToken } from '../utils/jwt.js';
import type { Env } from '../types.js';

/**
 * 认证中间件：从 Cookie 中读取并验证 JWT
 * 用于需要认证的 API 端点
 */
export async function authenticate(request: Request, env: Env): Promise<void> {
  await getAuthenticatedUser(request, env);
}

/**
 * 获取已认证用户的用户名
 * 返回用户名，如果未认证则抛出错误
 */
export async function getAuthenticatedUser(request: Request, env: Env): Promise<string> {
  // 从 Cookie 中读取 auth_token
  const cookieHeader = request.headers.get('Cookie') || '';
  const tokenMatch = cookieHeader.match(/auth_token=([^;]+)/);

  if (!tokenMatch) {
    throw new AppError('AUTH_MISSING');
  }

  const token = tokenMatch[1];

  // 检查 JWT_SECRET
  const jwtSecret = env.JWT_SECRET;
  if (!jwtSecret) {
    throw new AppError('CONFIG_MISSING');
  }

  // 验证 JWT
  const payload = await verifyToken(token, jwtSecret);

  if (!payload || !payload.username) {
    throw new AppError('AUTH_INVALID_TOKEN');
  }

  return payload.username;
}
```

- [ ] **Step 2: 提交**

```bash
git add packages/api/src/middleware/auth.ts
git commit -m "feat(api): rewrite auth middleware to use JWT from cookie"
```

---

## Task 8: 后端注册新路由

**Files:**
- Modify: `packages/api/src/index.ts`

- [ ] **Step 1: 导入新路由处理函数**

在文件顶部添加导入：

```typescript
// packages/api/src/index.ts (第 4 行后添加)

import { handleLogin } from './routes/login.js';
import { handleLogout } from './routes/logout.js';
import { handleMe } from './routes/me.js';
```

- [ ] **Step 2: 添加路由分发逻辑**

在路由分发部分添加（第 44-46 行后）：

```typescript
// packages/api/src/index.ts (路由分发部分添加)

      // POST /login - 无需认证
      if (path === '/login' && request.method === 'POST') {
        return handleLogin(request, env);
      }

      // POST /logout - 无需认证（只是清除 cookie）
      if (path === '/logout' && request.method === 'POST') {
        return handleLogout(request, env);
      }

      // GET /me - 无需认证（使用自己的认证逻辑返回用户信息）
      if (path === '/me' && request.method === 'GET') {
        return handleMe(request, env);
      }
```

- [ ] **Step 3: 提交**

```bash
git add packages/api/src/index.ts
git commit -m "feat(api): register login/logout/me routes"
```

---

## Task 9: 后端添加测试用户

**Files:**
- 无文件修改，使用 wrangler 命令

- [ ] **Step 1: 创建脚本添加测试用户**

在本地开发环境中，我们需要手动添加一个测试用户到 KV：

```bash
# 使用 wrangler kv:key put 命令
# 密码使用明文（简化实现）
wrangler kv:key put --binding=KV "users:admin" '{"password_hash":"admin123","created_at":"2026-03-17T00:00:00Z"}'
```

Expected: 用户添加成功

- [ ] **Step 2: 设置 JWT_SECRET**

```bash
wrangler secret put JWT_SECRET
# 输入一个随机字符串，如: openssl rand -base64 32
```

Expected: Secret 设置成功

---

## Task 10: 前端创建包结构

**Files:**
- Create: `packages/web/package.json`
- Create: `packages/web/tsconfig.json`
- Create: `packages/web/vite.config.ts`
- Create: `packages/web/tailwind.config.js`
- Create: `packages/web/postcss.config.js`
- Create: `packages/web/wrangler.toml`
- Create: `packages/web/index.html`
- Modify: `pnpm-workspace.yaml`

- [ ] **Step 1: 创建 package.json**

```json
{
  "name": "@monopage/web",
  "version": "1.0.0",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "tsc && vite build",
    "preview": "vite preview",
    "deploy": "pnpm build && wrangler pages deploy dist"
  },
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

- [ ] **Step 2: 创建 tsconfig.json**

```json
{
  "compilerOptions": {
    "target": "ES2020",
    "useDefineForClassFields": true,
    "lib": ["ES2020", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "skipLibCheck": true,
    "moduleResolution": "bundler",
    "allowImportingTsExtensions": true,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "noEmit": true,
    "jsx": "react-jsx",
    "strict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noFallthroughCasesInSwitch": true
  },
  "include": ["src"],
  "references": [{ "path": "./tsconfig.node.json" }]
}
```

- [ ] **Step 3: 创建 tsconfig.node.json**

```json
{
  "compilerOptions": {
    "composite": true,
    "skipLibCheck": true,
    "module": "ESNext",
    "moduleResolution": "bundler",
    "allowSyntheticDefaultImports": true
  },
  "include": ["vite.config.ts"]
}
```

- [ ] **Step 4: 创建 vite.config.ts**

```typescript
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/articles': 'http://localhost:8787',
      '/login': 'http://localhost:8787',
      '/logout': 'http://localhost:8787',
      '/me': 'http://localhost:8787',
    },
  },
});
```

- [ ] **Step 5: 创建 tailwind.config.js**

```javascript
/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: [
          '-apple-system',
          'BlinkMacSystemFont',
          'Segoe UI',
          'Roboto',
          'Helvetica Neue',
          'Arial',
          'sans-serif',
        ],
      },
      colors: {
        primary: '#111827',
        secondary: '#6B7280',
        tertiary: '#9CA3AF',
        border: '#E5E7EB',
        bg: {
          primary: '#FFFFFF',
          secondary: '#FAFAFA',
        },
      },
      maxWidth: {
        content: '672px',
      },
    },
  },
  plugins: [],
};
```

- [ ] **Step 6: 创建 postcss.config.js**

```javascript
export default {
  plugins: {
    tailwindcss: {},
    autoprefixer: {},
  },
};
```

- [ ] **Step 7: 创建 wrangler.toml**

```toml
name = "monopage-web"
compatibility_date = "2024-03-16"
pages_build_output_dir = "./dist"
```

- [ ] **Step 8: 创建 index.html**

```html
<!DOCTYPE html>
<html lang="zh-CN">
  <head>
    <meta charset="UTF-8" />
    <link rel="icon" type="image/svg+xml" href="/vite.svg" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Monopage</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

- [ ] **Step 9: 修改 pnpm-workspace.yaml**

确保包含 web 包：

```yaml
packages:
  - 'packages/*'
```

- [ ] **Step 10: 安装依赖**

```bash
cd /Users/xlzj/Desktop/Projects/monopage && pnpm install
```

Expected: 依赖安装成功

- [ ] **Step 11: 提交**

```bash
git add packages/web/ pnpm-lock.yaml pnpm-workspace.yaml
git commit -m "feat(web): initialize package structure with Vite and Tailwind"
```

---

## Task 11: 前端创建样式入口

**Files:**
- Create: `packages/web/src/styles/index.css`

- [ ] **Step 1: 创建 Tailwind CSS 入口文件**

```css
/* packages/web/src/styles/index.css */

@tailwind base;
@tailwind components;
@tailwind utilities;

/* 自定义基础样式 */
@layer base {
  html {
    @apply antialiased;
  }

  body {
    @apply bg-bg-primary text-primary;
  }

  /* 链接样式 */
  a {
    @apply text-primary hover:text-secondary transition-colors;
  }
}

/* 自定义组件样式 */
@layer components {
  /* 卡片悬停效果 */
  .card-hover {
    @apply hover:bg-bg-secondary transition-colors duration-200;
  }

  /* 骨架屏动画 */
  .skeleton-pulse {
    @apply animate-pulse bg-gray-200;
  }
}
```

- [ ] **Step 2: 提交**

```bash
git add packages/web/src/styles/index.css
git commit -m "feat(web): add Tailwind CSS entry file"
```

---

## Task 12: 前端创建类型定义

**Files:**
- Create: `packages/web/src/types/index.ts`

- [ ] **Step 1: 创建类型定义文件**

```typescript
// packages/web/src/types/index.ts

// ===== 文章相关类型 =====

export type SourceType = 'openai' | 'anthropic';

export interface Article {
  id: string;
  source: SourceType;
  title: string;
  summary_md: string;
  source_url: string;
  published_at: string; // ISO 8601
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
    sources_included: SourceType[];
    date_range: {
      from: string;
      to: string;
    };
    last_refreshed_at: string | null;
  };
}

// ===== 认证相关类型 =====

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

export interface MeResponse {
  success: true;
  data: {
    username: string;
  };
}

export interface LogoutResponse {
  success: true;
  data: null;
}

// ===== 错误类型 =====

export interface ApiErrorResponse {
  success: false;
  error: {
    code: string;
    code_num: number;
    message: string;
    retryable: boolean;
  };
}

// ===== 自定义错误类 =====

export class AuthError extends Error {
  constructor(message: string = 'Authentication required') {
    super(message);
    this.name = 'AuthError';
  }
}

export class ApiError extends Error {
  public readonly code: string;
  public readonly codeNum: number;
  public readonly retryable: boolean;

  constructor(response: ApiErrorResponse) {
    super(response.error.message);
    this.name = 'ApiError';
    this.code = response.error.code;
    this.codeNum = response.error.code_num;
    this.retryable = response.error.retryable;
  }
}
```

- [ ] **Step 2: 提交**

```bash
git add packages/web/src/types/index.ts
git commit -m "feat(web): add TypeScript type definitions"
```

---

## Task 13: 前端创建 API 客户端

**Files:**
- Create: `packages/web/src/api/client.ts`

- [ ] **Step 1: 创建 API 客户端**

```typescript
// packages/web/src/api/client.ts

import type {
  ArticlesResponse,
  LoginRequest,
  LoginResponse,
  MeResponse,
  LogoutResponse,
  ApiErrorResponse,
} from '../types';
import { AuthError, ApiError } from '../types';

const API_BASE = '';

class ApiClient {
  private async request<T>(
    path: string,
    options: RequestInit = {}
  ): Promise<T> {
    const response = await fetch(`${API_BASE}${path}`, {
      ...options,
      credentials: 'include', // 携带 Cookie
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
    });

    const data = await response.json();

    if (!response.ok) {
      if (response.status === 401) {
        throw new AuthError();
      }
      throw new ApiError(data as ApiErrorResponse);
    }

    return data;
  }

  async login(username: string, password: string): Promise<LoginResponse> {
    return this.request<LoginResponse>('/login', {
      method: 'POST',
      body: JSON.stringify({ username, password } as LoginRequest),
    });
  }

  async logout(): Promise<LogoutResponse> {
    return this.request<LogoutResponse>('/logout', {
      method: 'POST',
    });
  }

  async getMe(): Promise<MeResponse> {
    return this.request<MeResponse>('/me');
  }

  async getArticles(params: {
    date?: string;
    days?: number;
    page?: number;
    pageSize?: number;
  }): Promise<ArticlesResponse> {
    const searchParams = new URLSearchParams();

    if (params.date) searchParams.set('date', params.date);
    if (params.days) searchParams.set('days', String(params.days));
    if (params.page) searchParams.set('page', String(params.page));
    if (params.pageSize) searchParams.set('pageSize', String(params.pageSize));

    const query = searchParams.toString();
    return this.request<ArticlesResponse>(`/articles${query ? `?${query}` : ''}`);
  }
}

export const api = new ApiClient();
```

- [ ] **Step 2: 提交**

```bash
git add packages/web/src/api/client.ts
git commit -m "feat(web): add API client with cookie authentication"
```

---

## Task 14: 前端创建日期工具函数

**Files:**
- Create: `packages/web/src/utils/date.ts`

- [ ] **Step 1: 创建日期工具函数**

```typescript
// packages/web/src/utils/date.ts

const WEEKDAYS = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];

export function formatDate(date: Date): string {
  const month = date.getMonth() + 1;
  const day = date.getDate();
  const weekday = WEEKDAYS[date.getDay()];
  return `${month}月${day}日 ${weekday}`;
}

export function formatDateISO(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function parseDateISO(isoString: string): Date {
  return new Date(isoString);
}

export function getRelativeTime(isoString: string): string {
  const date = new Date(isoString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / (1000 * 60));
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffMins < 1) return '刚刚';
  if (diffMins < 60) return `${diffMins}分钟前`;
  if (diffHours < 24) return `${diffHours}小时前`;
  if (diffDays < 7) return `${diffDays}天前`;

  return formatDate(date);
}

export function getLastNDays(n: number): Date[] {
  const dates: Date[] = [];
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  for (let i = 0; i < n; i++) {
    const date = new Date(today);
    date.setDate(date.getDate() - i);
    dates.push(date);
  }

  return dates;
}

export function isToday(date: Date): boolean {
  const today = new Date();
  return (
    date.getFullYear() === today.getFullYear() &&
    date.getMonth() === today.getMonth() &&
    date.getDate() === today.getDate()
  );
}
```

- [ ] **Step 2: 提交**

```bash
git add packages/web/src/utils/date.ts
git commit -m "feat(web): add date utility functions"
```

---

## Task 15: 前端创建 useAuth Hook

**Files:**
- Create: `packages/web/src/hooks/useAuth.ts`

- [ ] **Step 1: 创建 useAuth Hook**

```typescript
// packages/web/src/hooks/useAuth.ts

import { useState, useEffect, useCallback } from 'react';
import { api } from '../api/client';
import { AuthError } from '../types';

interface AuthState {
  user: string | null;
  isLoading: boolean;
  error: string | null;
}

interface UseAuthReturn extends AuthState {
  login: (username: string, password: string) => Promise<{ success: boolean; error?: string }>;
  logout: () => Promise<void>;
}

export function useAuth(): UseAuthReturn {
  const [state, setState] = useState<AuthState>({
    user: null,
    isLoading: true,
    error: null,
  });

  // 检查当前登录状态
  useEffect(() => {
    let mounted = true;

    async function checkAuth() {
      try {
        const response = await api.getMe();
        if (mounted) {
          setState({
            user: response.data.username,
            isLoading: false,
            error: null,
          });
        }
      } catch (error) {
        if (mounted) {
          setState({
            user: null,
            isLoading: false,
            error: null,
          });
        }
      }
    }

    checkAuth();

    return () => {
      mounted = false;
    };
  }, []);

  const login = useCallback(async (username: string, password: string) => {
    setState((prev) => ({ ...prev, isLoading: true, error: null }));

    try {
      const response = await api.login(username, password);
      setState({
        user: response.data.username,
        isLoading: false,
        error: null,
      });
      return { success: true };
    } catch (error) {
      const errorMessage =
        error instanceof AuthError
          ? '用户名或密码错误'
          : error instanceof Error
            ? error.message
            : '登录失败，请稍后重试';

      setState((prev) => ({
        ...prev,
        isLoading: false,
        error: errorMessage,
      }));

      return { success: false, error: errorMessage };
    }
  }, []);

  const logout = useCallback(async () => {
    try {
      await api.logout();
    } catch (error) {
      // 忽略登出错误
      console.error('Logout error:', error);
    } finally {
      setState({
        user: null,
        isLoading: false,
        error: null,
      });
    }
  }, []);

  return {
    ...state,
    login,
    logout,
  };
}
```

- [ ] **Step 2: 提交**

```bash
git add packages/web/src/hooks/useAuth.ts
git commit -m "feat(web): add useAuth hook for authentication state"
```

---

## Task 16: 前端创建 useArticles Hook

**Files:**
- Create: `packages/web/src/hooks/useArticles.ts`

- [ ] **Step 1: 创建 useArticles Hook**

```typescript
// packages/web/src/hooks/useArticles.ts

import { useQuery } from '@tanstack/react-query';
import { api } from '../api/client';
import type { ArticlesResponse } from '../types';
import { AuthError } from '../types';

interface UseArticlesParams {
  date?: string;
  days?: number;
  page?: number;
  pageSize?: number;
  enabled?: boolean;
}

export function useArticles(params: UseArticlesParams = {}) {
  const { date, days = 7, page = 1, pageSize = 50, enabled = true } = params;

  return useQuery<ArticlesResponse, Error>({
    queryKey: ['articles', { date, days, page, pageSize }],
    queryFn: () => api.getArticles({ date, days, page, pageSize }),
    enabled,
    staleTime: 5 * 60 * 1000, // 5 分钟
    gcTime: 30 * 60 * 1000, // 30 分钟
    retry: (failureCount, error) => {
      // 认证错误不重试
      if (error instanceof AuthError) {
        return false;
      }
      return failureCount < 1;
    },
  });
}
```

- [ ] **Step 2: 提交**

```bash
git add packages/web/src/hooks/useArticles.ts
git commit -m "feat(web): add useArticles hook with TanStack Query"
```

---

## Task 17: 前端创建 LoadingScreen 组件

**Files:**
- Create: `packages/web/src/components/Layout/LoadingScreen.tsx`

- [ ] **Step 1: 创建 LoadingScreen 组件**

```tsx
// packages/web/src/components/Layout/LoadingScreen.tsx

export function LoadingScreen() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-bg-primary">
      <div className="text-secondary text-sm">加载中...</div>
    </div>
  );
}
```

- [ ] **Step 2: 提交**

```bash
git add packages/web/src/components/Layout/LoadingScreen.tsx
git commit -m "feat(web): add LoadingScreen component"
```

---

## Task 18: 前端创建 Header 组件

**Files:**
- Create: `packages/web/src/components/Layout/Header.tsx`

- [ ] **Step 1: 创建 Header 组件**

```tsx
// packages/web/src/components/Layout/Header.tsx

import { DateSelector } from '../Articles/DateSelector';

interface HeaderProps {
  username: string;
  currentDate: string;
  onDateChange: (date: string) => void;
  onLogout: () => void;
}

export function Header({ username, currentDate, onDateChange, onLogout }: HeaderProps) {
  return (
    <header className="sticky top-0 bg-bg-primary border-b border-border z-10">
      <div className="max-w-content mx-auto px-4 py-4 flex items-center justify-between">
        {/* Logo */}
        <h1 className="text-xl font-semibold text-primary">Monopage</h1>

        {/* Right side */}
        <div className="flex items-center gap-4">
          {/* User info & logout */}
          <div className="flex items-center gap-2 text-sm text-secondary">
            <span>{username}</span>
            <span className="text-tertiary">·</span>
            <button
              onClick={onLogout}
              className="text-secondary hover:text-primary transition-colors"
            >
              登出
            </button>
          </div>

          {/* Date selector */}
          <DateSelector value={currentDate} onChange={onDateChange} />
        </div>
      </div>
    </header>
  );
}
```

- [ ] **Step 2: 提交**

```bash
git add packages/web/src/components/Layout/Header.tsx
git commit -m "feat(web): add Header component with user info and date selector"
```

---

## Task 19: 前端创建 LoginForm 组件

**Files:**
- Create: `packages/web/src/components/Auth/LoginForm.tsx`

- [ ] **Step 1: 创建 LoginForm 组件**

```tsx
// packages/web/src/components/Auth/LoginForm.tsx

import { useState, FormEvent } from 'react';

interface LoginFormProps {
  onSubmit: (username: string, password: string) => Promise<{ success: boolean; error?: string }>;
  isLoading: boolean;
  error: string | null;
}

export function LoginForm({ onSubmit, isLoading, error }: LoginFormProps) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [submitError, setSubmitError] = useState<string | null>(null);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setSubmitError(null);

    if (!username.trim() || !password.trim()) {
      setSubmitError('请输入用户名和密码');
      return;
    }

    const result = await onSubmit(username.trim(), password);
    if (!result.success) {
      setSubmitError(result.error || '登录失败');
    }
  };

  const displayError = submitError || error;

  return (
    <form onSubmit={handleSubmit} className="w-full max-w-sm space-y-4">
      {/* Username */}
      <div>
        <input
          type="text"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          placeholder="用户名"
          disabled={isLoading}
          className="w-full px-4 py-3 border border-border rounded-lg text-primary placeholder:text-tertiary focus:outline-none focus:border-secondary transition-colors disabled:opacity-50"
        />
      </div>

      {/* Password */}
      <div>
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="密码"
          disabled={isLoading}
          className="w-full px-4 py-3 border border-border rounded-lg text-primary placeholder:text-tertiary focus:outline-none focus:border-secondary transition-colors disabled:opacity-50"
        />
      </div>

      {/* Error message */}
      {displayError && (
        <p className="text-red-500 text-sm text-center">{displayError}</p>
      )}

      {/* Submit button */}
      <button
        type="submit"
        disabled={isLoading}
        className="w-full py-3 bg-primary text-white rounded-lg font-medium hover:bg-gray-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {isLoading ? '登录中...' : '登录 →'}
      </button>
    </form>
  );
}
```

- [ ] **Step 2: 提交**

```bash
git add packages/web/src/components/Auth/LoginForm.tsx
git commit -m "feat(web): add LoginForm component"
```

---

## Task 20: 前端创建 LoginPage 组件

**Files:**
- Create: `packages/web/src/components/Auth/LoginPage.tsx`

- [ ] **Step 1: 创建 LoginPage 组件**

```tsx
// packages/web/src/components/Auth/LoginPage.tsx

import { LoginForm } from './LoginForm';

interface LoginPageProps {
  onLogin: (username: string, password: string) => Promise<{ success: boolean; error?: string }>;
  isLoading: boolean;
  error: string | null;
}

export function LoginPage({ onLogin, isLoading, error }: LoginPageProps) {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-bg-primary px-4">
      {/* Logo & tagline */}
      <div className="text-center mb-8">
        <h1 className="text-2xl font-semibold text-primary mb-2">Monopage</h1>
        <p className="text-secondary text-sm">每日清晨，一览 AI 世界</p>
      </div>

      {/* Login form */}
      <LoginForm onSubmit={onLogin} isLoading={isLoading} error={error} />
    </div>
  );
}
```

- [ ] **Step 2: 提交**

```bash
git add packages/web/src/components/Auth/LoginPage.tsx
git commit -m "feat(web): add LoginPage component"
```

---

## Task 21: 前端创建 DateSelector 组件

**Files:**
- Create: `packages/web/src/components/Articles/DateSelector.tsx`

- [ ] **Step 1: 创建 DateSelector 组件**

```tsx
// packages/web/src/components/Articles/DateSelector.tsx

import { useState, useRef, useEffect } from 'react';
import { formatDate, formatDateISO, getLastNDays, isToday } from '../../utils/date';

interface DateSelectorProps {
  value: string; // YYYY-MM-DD
  onChange: (date: string) => void;
  maxDays?: number;
}

export function DateSelector({ value, onChange, maxDays = 7 }: DateSelectorProps) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const dates = getLastNDays(maxDays);
  const selectedDate = dates.find((d) => formatDateISO(d) === value) || dates[0];

  // 点击外部关闭
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  const handleSelect = (date: Date) => {
    onChange(formatDateISO(date));
    setIsOpen(false);
  };

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Trigger button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-1 px-3 py-1.5 text-sm text-secondary hover:text-primary transition-colors"
      >
        <span>{formatDate(selectedDate)}</span>
        <svg
          className={`w-4 h-4 transition-transform ${isOpen ? 'rotate-180' : ''}`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {/* Dropdown */}
      {isOpen && (
        <div className="absolute right-0 top-full mt-1 py-1 bg-white border border-border rounded-lg shadow-lg min-w-[140px] z-20">
          {dates.map((date) => {
            const isoDate = formatDateISO(date);
            const isSelected = isoDate === value;
            const today = isToday(date);

            return (
              <button
                key={isoDate}
                onClick={() => handleSelect(date)}
                className={`w-full px-4 py-2 text-left text-sm transition-colors ${
                  isSelected
                    ? 'bg-bg-secondary text-primary font-medium'
                    : 'text-secondary hover:bg-bg-secondary hover:text-primary'
                }`}
              >
                {today ? '今天' : formatDate(date)}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: 提交**

```bash
git add packages/web/src/components/Articles/DateSelector.tsx
git commit -m "feat(web): add DateSelector component with dropdown"
```

---

## Task 22: 前端创建 ArticleCard 组件

**Files:**
- Create: `packages/web/src/components/Articles/ArticleCard.tsx`

- [ ] **Step 1: 创建 ArticleCard 组件**

```tsx
// packages/web/src/components/Articles/ArticleCard.tsx

import ReactMarkdown from 'react-markdown';
import type { Article } from '../../types';
import { getRelativeTime } from '../../utils/date';

interface ArticleCardProps {
  article: Article;
}

export function ArticleCard({ article }: ArticleCardProps) {
  const sourceLabel = article.source === 'openai' ? 'OpenAI' : 'Anthropic';

  return (
    <article className="bg-bg-primary border border-border rounded-lg p-6 card-hover">
      {/* Source badge */}
      <span className="inline-block px-2 py-0.5 text-xs font-medium text-secondary bg-bg-secondary rounded mb-3">
        {sourceLabel}
      </span>

      {/* Title */}
      <h2 className="text-lg font-semibold text-primary mb-1 leading-snug">
        {article.title}
      </h2>

      {/* Time */}
      <p className="text-xs text-tertiary mb-4">
        {getRelativeTime(article.published_at)}
      </p>

      {/* Summary */}
      <div className="prose prose-sm prose-gray max-w-none text-secondary leading-relaxed">
        <ReactMarkdown>{article.summary_md}</ReactMarkdown>
      </div>

      {/* Link to original */}
      <a
        href={article.source_url}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center gap-1 mt-4 text-sm text-secondary hover:text-primary transition-colors"
      >
        阅读原文
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
        </svg>
      </a>
    </article>
  );
}
```

- [ ] **Step 2: 提交**

```bash
git add packages/web/src/components/Articles/ArticleCard.tsx
git commit -m "feat(web): add ArticleCard component with markdown rendering"
```

---

## Task 23: 前端创建 ArticleList 组件

**Files:**
- Create: `packages/web/src/components/Articles/ArticleList.tsx`

- [ ] **Step 1: 创建 ArticleList 组件**

```tsx
// packages/web/src/components/Articles/ArticleList.tsx

import type { Article } from '../../types';
import { ArticleCard } from './ArticleCard';

interface ArticleListProps {
  articles: Article[];
}

export function ArticleList({ articles }: ArticleListProps) {
  return (
    <div className="space-y-6">
      {articles.map((article) => (
        <ArticleCard key={article.id} article={article} />
      ))}
    </div>
  );
}
```

- [ ] **Step 2: 提交**

```bash
git add packages/web/src/components/Articles/ArticleList.tsx
git commit -m "feat(web): add ArticleList component"
```

---

## Task 24: 前端创建 EmptyState 组件

**Files:**
- Create: `packages/web/src/components/Articles/EmptyState.tsx`

- [ ] **Step 1: 创建 EmptyState 组件**

```tsx
// packages/web/src/components/Articles/EmptyState.tsx

import { formatDateISO } from '../../utils/date';

interface EmptyStateProps {
  message?: string;
  onAction?: () => void;
  actionLabel?: string;
}

export function EmptyState({
  message = '暂无文章',
  onAction,
  actionLabel = '查看今天',
}: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <p className="text-secondary mb-2">{message}</p>
      <p className="text-tertiary text-sm mb-4">该日期还没有抓取到新闻</p>
      {onAction && (
        <button
          onClick={() => onAction()}
          className="text-sm text-secondary hover:text-primary transition-colors"
        >
          {actionLabel} →
        </button>
      )}
    </div>
  );
}
```

- [ ] **Step 2: 提交**

```bash
git add packages/web/src/components/Articles/EmptyState.tsx
git commit -m "feat(web): add EmptyState component"
```

---

## Task 25: 前端创建 ErrorState 组件

**Files:**
- Create: `packages/web/src/components/Articles/ErrorState.tsx`

- [ ] **Step 1: 创建 ErrorState 组件**

```tsx
// packages/web/src/components/Articles/ErrorState.tsx

interface ErrorStateProps {
  message?: string;
  onRetry?: () => void;
}

export function ErrorState({
  message = '加载失败',
  onRetry,
}: ErrorStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <p className="text-secondary mb-2">{message}</p>
      <p className="text-tertiary text-sm mb-4">请稍后重试</p>
      {onRetry && (
        <button
          onClick={() => onRetry()}
          className="text-sm text-secondary hover:text-primary transition-colors"
        >
          重试 →
        </button>
      )}
    </div>
  );
}
```

- [ ] **Step 2: 提交**

```bash
git add packages/web/src/components/Articles/ErrorState.tsx
git commit -m "feat(web): add ErrorState component"
```

---

## Task 26: 前端创建 main.tsx 入口

**Files:**
- Create: `packages/web/src/main.tsx`

- [ ] **Step 1: 创建 main.tsx**

```tsx
// packages/web/src/main.tsx

import React from 'react';
import ReactDOM from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import App from './App';
import './styles/index.css';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
    },
  },
});

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <App />
    </QueryClientProvider>
  </React.StrictMode>
);
```

- [ ] **Step 2: 提交**

```bash
git add packages/web/src/main.tsx
git commit -m "feat(web): add main.tsx entry point with QueryClient"
```

---

## Task 27: 前端创建 App.tsx 主组件

**Files:**
- Create: `packages/web/src/App.tsx`

- [ ] **Step 1: 创建 App.tsx**

```tsx
// packages/web/src/App.tsx

import { useState, useCallback } from 'react';
import { useAuth } from './hooks/useAuth';
import { useArticles } from './hooks/useArticles';
import { formatDateISO } from './utils/date';
import { LoadingScreen } from './components/Layout/LoadingScreen';
import { Header } from './components/Layout/Header';
import { LoginPage } from './components/Auth/LoginPage';
import { ArticleList } from './components/Articles/ArticleList';
import { EmptyState } from './components/Articles/EmptyState';
import { ErrorState } from './components/Articles/ErrorState';

function App() {
  const { user, isLoading: authLoading, login, logout, error: authError } = useAuth();
  const [date, setDate] = useState(formatDateISO(new Date()));

  // 文章查询
  const {
    data: articlesData,
    isLoading: articlesLoading,
    error: articlesError,
    refetch,
  } = useArticles({
    date,
    days: 7,
    enabled: !!user,
  });

  // 认证加载中
  if (authLoading) {
    return <LoadingScreen />;
  }

  // 未登录
  if (!user) {
    return <LoginPage onLogin={login} isLoading={authLoading} error={authError} />;
  }

  // 已登录
  const articles = articlesData?.data.articles || [];
  const handleDateChange = useCallback((newDate: string) => {
    setDate(newDate);
  }, []);

  const handleGoToToday = useCallback(() => {
    setDate(formatDateISO(new Date()));
  }, []);

  return (
    <div className="min-h-screen bg-bg-primary">
      <Header
        username={user}
        currentDate={date}
        onDateChange={handleDateChange}
        onLogout={logout}
      />

      <main className="max-w-content mx-auto px-4 py-8">
        {/* 加载中 */}
        {articlesLoading && (
          <div className="space-y-6">
            {[1, 2, 3].map((i) => (
              <div key={i} className="bg-bg-primary border border-border rounded-lg p-6">
                <div className="h-4 bg-gray-200 rounded w-16 mb-4 skeleton-pulse"></div>
                <div className="h-5 bg-gray-200 rounded w-3/4 mb-2 skeleton-pulse"></div>
                <div className="h-3 bg-gray-200 rounded w-24 mb-4 skeleton-pulse"></div>
                <div className="space-y-2">
                  <div className="h-3 bg-gray-200 rounded w-full skeleton-pulse"></div>
                  <div className="h-3 bg-gray-200 rounded w-full skeleton-pulse"></div>
                  <div className="h-3 bg-gray-200 rounded w-2/3 skeleton-pulse"></div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* 错误 */}
        {!articlesLoading && articlesError && (
          <ErrorState
            message={articlesError.message || '加载失败'}
            onRetry={() => refetch()}
          />
        )}

        {/* 空状态 */}
        {!articlesLoading && !articlesError && articles.length === 0 && (
          <EmptyState
            message="暂无文章"
            onAction={handleGoToToday}
            actionLabel="查看今天"
          />
        )}

        {/* 文章列表 */}
        {!articlesLoading && !articlesError && articles.length > 0 && (
          <ArticleList articles={articles} />
        )}
      </main>
    </div>
  );
}

export default App;
```

- [ ] **Step 2: 提交**

```bash
git add packages/web/src/App.tsx
git commit -m "feat(web): add App.tsx main component with auth and articles"
```

---

## Task 28: 更新根目录 package.json 脚本

**Files:**
- Modify: `/Users/xlzj/Desktop/Projects/monopage/package.json`

- [ ] **Step 1: 添加 web 相关脚本**

```json
{
  "scripts": {
    "dev": "pnpm -F @monopage/api dev",
    "dev:web": "pnpm -F @monopage/web dev",
    "deploy": "pnpm -F @monopage/api deploy",
    "deploy:web": "pnpm -F @monopage/web deploy",
    "build": "pnpm -r build"
  }
}
```

- [ ] **Step 2: 提交**

```bash
git add package.json
git commit -m "feat: add web scripts to root package.json"
```

---

## Task 29: 本地测试

**Files:**
- 无文件修改

- [ ] **Step 1: 启动后端开发服务器**

```bash
cd /Users/xlzj/Desktop/Projects/monopage && pnpm dev
```

Expected: 后端服务运行在 http://localhost:8787

- [ ] **Step 2: 在另一个终端启动前端开发服务器**

```bash
cd /Users/xlzj/Desktop/Projects/monopage && pnpm dev:web
```

Expected: 前端服务运行在 http://localhost:5173

- [ ] **Step 3: 测试登录功能**

1. 打开 http://localhost:5173
2. 使用测试用户登录（username: admin, password: admin123）
3. 验证登录成功后跳转到主页

Expected: 登录成功，显示文章列表或空状态

- [ ] **Step 4: 测试日期选择**

1. 点击日期选择器
2. 选择不同日期
3. 验证 URL 参数和文章列表更新

Expected: 日期切换正常

---

## Task 30: 最终提交和清理

**Files:**
- 无文件修改

- [ ] **Step 1: 确保所有更改已提交**

```bash
git status
```

Expected: 工作区干净

- [ ] **Step 2: 更新 .gitignore（如果需要）**

确保 `.gitignore` 包含：

```
# Dependencies
node_modules/

# Build outputs
dist/

# Environment
.env
.env.local
.wrangler/

# IDE
.vscode/
.idea/

# OS
.DS_Store
```

- [ ] **Step 3: 最终提交**

```bash
git add -A
git commit -m "feat: complete Monopage web frontend implementation"
```

---

## 部署检查清单

部署前确认：

- [ ] 后端已设置 `JWT_SECRET` secret
- [ ] 后端已添加测试用户到 KV
- [ ] 前端构建成功 (`pnpm -F @monopage/web build`)
- [ ] Cloudflare Pages 路由配置正确（API 端点指向 Worker）
