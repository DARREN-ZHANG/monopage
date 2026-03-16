import { authenticate } from './middleware/auth.js';
import { checkRateLimit } from './middleware/rateLimit.js';
import { handleArticles } from './routes/articles.js';
import { handleRefresh } from './routes/refresh.js';
import { errorResponse } from './utils/response.js';
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

      // 认证检查
      await authenticate(request, env);

      // 限流检查
      await checkRateLimit(env);

      // 路由分发
      const url = new URL(request.url);
      const path = url.pathname;

      // GET /articles
      if (path === '/articles' && request.method === 'GET') {
        return handleArticles(request, env);
      }

      // POST /refresh
      if (path === '/refresh' && request.method === 'POST') {
        return handleRefresh(request, env);
      }

      // 404 处理
      return new Response(
        JSON.stringify({ success: false, error: { message: 'Not Found' } }),
        { status: 404, headers: { 'Content-Type': 'application/json' } }
      );
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
      // 创建一个模拟的 POST /refresh 请求
      const refreshRequest = new Request('https://monopage-api.workers.dev/refresh', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${env.API_TOKEN}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({}),
      });

      const response = await this.fetch(refreshRequest, env, ctx);

      if (response.ok) {
        const result = await response.json();
        console.log('Cron refresh completed:', JSON.stringify(result, null, 2));
      } else {
        const error = await response.json();
        console.error('Cron refresh failed:', JSON.stringify(error, null, 2));
      }
    } catch (error) {
      console.error('Cron execution error:', error);
    }
  },
};
