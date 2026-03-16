import { AppError } from '../utils/errors.js';
import type { Env } from '../types.js';

interface ConfigTokenData {
  api_token?: string;
  apiToken?: string;
}

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

  // 优先从 KV config 读取 token，兼容环境变量兜底
  const validToken = await getValidToken(env);

  if (!validToken) {
    throw new AppError('CONFIG_MISSING');
  }

  if (token !== validToken) {
    throw new AppError('AUTH_INVALID_TOKEN');
  }
}

async function getValidToken(env: Env): Promise<string | null> {
  try {
    const rawConfig = await env.KV.get('config');
    if (rawConfig) {
      const parsed = JSON.parse(rawConfig) as ConfigTokenData;
      const kvToken = parsed.api_token ?? parsed.apiToken;
      if (typeof kvToken === 'string' && kvToken.trim()) {
        return kvToken;
      }
    }
  } catch (error) {
    console.error('Failed to read auth token from KV config:', error);
    throw new AppError('SERVICE_UNAVAILABLE', error instanceof Error ? error : undefined);
  }

  if (typeof env.API_TOKEN === 'string' && env.API_TOKEN.trim()) {
    return env.API_TOKEN;
  }

  return null;
}
