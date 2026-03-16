import { AppError } from '../utils/errors.js';
import type { Env } from '../types.js';

/**
 * 从请求中提取并验证 Bearer Token
 * @param request - HTTP 请求对象
 * @param env - 环境变量，包含 API_TOKEN
 * @throws {AppError} 认证失败时抛出错误
 */
export async function authenticate(request: Request, env: Env): Promise<void> {
  const authHeader = request.headers.get('Authorization');

  // 检查 Header 是否存在
  if (!authHeader) {
    throw new AppError('AUTH_MISSING');
  }

  // 检查 Bearer 格式
  const parts = authHeader.split(' ');
  if (parts.length !== 2 || parts[0].toLowerCase() !== 'bearer') {
    throw new AppError('AUTH_INVALID_FORMAT');
  }

  const token = parts[1];

  // 验证 Token（从环境变量或 KV 中获取配置的 Token）
  const validToken = env.API_TOKEN;

  if (!validToken) {
    throw new AppError('CONFIG_MISSING');
  }

  if (token !== validToken) {
    throw new AppError('AUTH_INVALID_TOKEN');
  }
}
