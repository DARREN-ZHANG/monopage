import { AppError } from '../utils/errors.js';
import { BaseLLMProvider } from './base.js';
import type { Article, Env, LLMMessage } from '../types.js';

/**
 * Cloudflare Workers AI Provider
 * 使用 Cloudflare 托管的 Llama 模型
 */
export class CloudflareLLMProvider extends BaseLLMProvider {
  private env: Env;

  constructor(env: Env) {
    const model = env.LLM_MODEL || '@cf/meta/llama-4-scout-17b-16e-instruct';
    const timeoutMs = parseInt(env.LLM_TIMEOUT_MS, 10) || 30000;
    super(model, timeoutMs);
    this.env = env;
  }

  async summarize(article: Article): Promise<string> {
    const content = article.content || '';

    if (!content) {
      // 如果没有内容，返回简单的标题摘要
      return `# ${article.title}\n\n原文链接：${article.url}`;
    }

    const messages: LLMMessage[] = [
      { role: 'system', content: this.getSystemPrompt() },
      { role: 'user', content: this.getUserPrompt(article, content) },
    ];

    try {
      // 使用 Cloudflare Workers AI API
      const response = await this.env.AI.run(this.model as any, {
        messages,
        max_tokens: this.maxTokens,
        temperature: this.temperature,
      });

      if (!response || !response.response) {
        throw new AppError('LLM_EMPTY_RESPONSE');
      }

      return this.cleanOutput(response.response);
    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }

      const errorMessage = error instanceof Error ? error.message : String(error);

      // 根据错误类型分类
      if (errorMessage.includes('timeout') || errorMessage.includes('TIMEOUT')) {
        throw new AppError('LLM_TIMEOUT', error instanceof Error ? error : undefined);
      }

      if (errorMessage.includes('rate limit') || errorMessage.includes('RATE_LIMIT')) {
        throw new AppError('LLM_RATE_LIMITED', error instanceof Error ? error : undefined);
      }

      throw new AppError('LLM_REQUEST_FAILED', error instanceof Error ? error : undefined);
    }
  }
}
