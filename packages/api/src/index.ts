import { authenticate } from './middleware/auth.js';
import { checkRateLimit } from './middleware/rateLimit.js';
import { handleArticles } from './routes/articles.js';
import { handleLogin } from './routes/login.js';
import { handleLogout } from './routes/logout.js';
import { handleMe } from './routes/me.js';
import { handleRefresh, runRefresh } from './routes/refresh.js';
import { errorResponse, notFoundResponse } from './utils/response.js';
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

      // 路由分发
      const url = new URL(request.url);
      const path = url.pathname;

      // POST /login - 无需认证
      if (path === '/login' && request.method === 'POST') {
        return handleLogin(request, env);
      }

      // POST /logout - 无需认证（仅清除 cookie）
      if (path === '/logout' && request.method === 'POST') {
        return handleLogout(request, env);
      }

      // GET /me - 使用自己的认证返回用户信息
      if (path === '/me' && request.method === 'GET') {
        return handleMe(request, env);
      }

      // 以下路由需要认证和限流

      // 认证检查
      await authenticate(request, env);

      // 限流检查
      await checkRateLimit(env);

      // GET /articles
      if (path === '/articles' && request.method === 'GET') {
        return handleArticles(request, env);
      }

      // POST /refresh
      if (path === '/refresh' && request.method === 'POST') {
        return handleRefresh(request, env);
      }

      // 404 处理
      return notFoundResponse();
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
      // Cron 直接执行业务逻辑，避免被认证/限流中间件拦截
      const result = await runRefresh(env);
      console.log('Cron refresh completed:', JSON.stringify(result, null, 2));
    } catch (error) {
      console.error('Cron execution error:', error);
    }
  },
};
