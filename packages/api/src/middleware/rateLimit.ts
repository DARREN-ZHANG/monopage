import { AppError } from '../utils/errors.js';
import type { Env } from '../types.js';

interface RateLimitState {
  limit: number;
  current: number;
  resetAt: string;
}

const RATE_LIMIT_KEY = 'rate_limit';
const RATE_LIMIT_TTL_SECONDS = 2 * 60 * 60;

/**
 * 检查并更新限流状态
 * @param env - 环境变量，包含 KV 绑定
 * @throws {AppError} 超过限流阈值时抛出错误
 */
export async function checkRateLimit(env: Env): Promise<void> {
  const limit = parseInt(env.RATE_LIMIT_PER_HOUR, 10) || 100;
  const now = new Date();
  const windowPrefix = getWindowPrefix(now);

  try {
    // 先写入当前请求，再检查当前窗口计数，减少并发覆盖写导致的漏计数
    const requestKey = `${windowPrefix}:${crypto.randomUUID()}`;
    await env.KV.put(requestKey, '1', { expirationTtl: RATE_LIMIT_TTL_SECONDS });

    const page = await env.KV.list({ prefix: windowPrefix, limit: limit + 1 });
    if (page.keys.length > limit) {
      await env.KV.delete(requestKey);
      throw new AppError('RATE_LIMITED');
    }
  } catch (error) {
    if (error instanceof AppError) {
      throw error;
    }

    // 限流状态不可用时失败关闭，避免失控请求打穿系统
    console.error('Rate limit check failed:', error);
    throw new AppError('SERVICE_UNAVAILABLE', error instanceof Error ? error : undefined);
  }
}

/**
 * 获取当前限流状态（用于调试）
 */
export async function getRateLimitStatus(env: Env): Promise<RateLimitState | null> {
  try {
    const now = new Date();
    const limit = parseInt(env.RATE_LIMIT_PER_HOUR, 10) || 100;
    const page = await env.KV.list({ prefix: getWindowPrefix(now), limit: limit + 1 });
    const resetAt = new Date(now);
    resetAt.setHours(resetAt.getHours() + 1, 0, 0, 0);
    return {
      limit,
      current: Math.min(page.keys.length, limit),
      resetAt: resetAt.toISOString(),
    };
  } catch {
    return null;
  }
}

function getWindowPrefix(now: Date): string {
  return `${RATE_LIMIT_KEY}:${now.toISOString().slice(0, 13)}`;
}
