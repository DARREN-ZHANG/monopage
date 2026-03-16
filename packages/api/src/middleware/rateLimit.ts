import { AppError } from '../utils/errors.js';
import type { Env } from '../types.js';

interface RateLimitState {
  limit: number;
  current: number;
  resetAt: string;
}

const RATE_LIMIT_KEY = 'rate_limit';

/**
 * 检查并更新限流状态
 * @param env - 环境变量，包含 KV 绑定
 * @throws {AppError} 超过限流阈值时抛出错误
 */
export async function checkRateLimit(env: Env): Promise<void> {
  const limit = parseInt(env.RATE_LIMIT_PER_HOUR, 10) || 100;
  const now = new Date();

  // 计算下一个整点重置时间
  const nextHour = new Date(now);
  nextHour.setHours(nextHour.getHours() + 1, 0, 0, 0);

  try {
    // 从 KV 读取限流状态
    const rateLimitKey = RATE_LIMIT_KEY;
    const stored = await env.KV.get(rateLimitKey);

    let state: RateLimitState;

    if (stored) {
      state = JSON.parse(stored) as RateLimitState;
      const resetAt = new Date(state.resetAt);

      // 检查是否需要重置
      if (now >= resetAt) {
        state = {
          limit,
          current: 1,
          resetAt: nextHour.toISOString(),
        };
      } else if (state.current >= state.limit) {
        // 超过限流阈值
        throw new AppError('RATE_LIMITED');
      } else {
        // 增加计数
        state.current++;
      }
    } else {
      // 初始化限流状态
      state = {
        limit,
        current: 1,
        resetAt: nextHour.toISOString(),
      };
    }

    // 保存更新后的状态
    await env.KV.put(rateLimitKey, JSON.stringify(state));

  } catch (error) {
    if (error instanceof AppError) {
      throw error;
    }
    // KV 操作失败，允许请求继续（降级处理）
    console.error('Rate limit check failed:', error);
  }
}

/**
 * 获取当前限流状态（用于调试）
 */
export async function getRateLimitStatus(env: Env): Promise<RateLimitState | null> {
  try {
    const stored = await env.KV.get(RATE_LIMIT_KEY);
    return stored ? JSON.parse(stored) as RateLimitState : null;
  } catch {
    return null;
  }
}
