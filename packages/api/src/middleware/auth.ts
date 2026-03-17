// packages/api/src/middleware/auth.ts

import { AppError } from '../utils/errors.js';
import { verifyToken } from '../utils/jwt.js';
import type { Env } from '../types.js';

/**
 * 认证中间件：从 Cookie 读取并验证 JWT
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
  // 从 Cookie 读取 auth_token
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
