// packages/api/src/routes/login.ts

import { AppError } from '../utils/errors.js';
import { jsonResponse } from '../utils/response.js';
import { signToken } from '../utils/jwt.js';
import type { Env } from '../types.js';

interface LoginRequest {
  username: string;
  password: string;
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

  let userData: { password_hash: string; created_at: string };
  try {
    userData = JSON.parse(userDataStr);
  } catch {
    throw new AppError('AUTH_INVALID_CREDENTIALS');
  }

  // 验证密码（简单比较，兼容 Cloudflare Workers）
  if (password !== userData.password_hash) {
    throw new AppError('AUTH_INVALID_CREDENTIALS');
  }

  // 检查 JWT_SECRET
  const jwtSecret = env.JWT_SECRET;
  if (!jwtSecret) {
    throw new AppError('CONFIG_MISSING');
  }

  // 生成 JWT
  const token = await signToken(username, jwtSecret);

  // 返回成功响应并设置 HttpOnly Cookie
  const response = jsonResponse({ username });

  // 设置 Cookie（本地开发不使用 Secure，生产环境使用）
  const isHttps = new URL(request.url).protocol === 'https:';
  const secureFlag = isHttps ? 'Secure;' : '';
  response.headers.set(
    'Set-Cookie',
    `auth_token=${token}; HttpOnly; ${secureFlag}SameSite=Strict; Path=/; Max-Age=604800`
  );

  return response;
}
