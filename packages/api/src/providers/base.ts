import type { Article, LLMMessage } from '../types.js';

/**
 * LLM Provider 抽象类
 */
export abstract class BaseLLMProvider {
  protected model: string;
  protected maxTokens: number;
  protected temperature: number;
  protected timeoutMs: number;

  constructor(model: string, timeoutMs: number) {
    this.model = model;
    this.maxTokens = 800;
    this.temperature = 0.3;
    this.timeoutMs = timeoutMs;
  }

  /**
   * 生成文章摘要
   */
  abstract summarize(article: Article): Promise<string>;

  /**
   * 构建系统提示词
   */
  protected getSystemPrompt(): string {
    return `你是一个科技新闻摘要助手。你的任务是将 AI 公司的新闻文章总结为简洁、信息量大的中文摘要。

要求：
1. 使用 Markdown 格式
2. 保持客观，不添加个人观点
3. 突出关键信息：产品名称、核心功能、技术亮点、影响范围
4. 省略营销性描述和无关细节
5. 如果是更新/版本发布，列出主要变更点（使用无序列表）
6. 确保核心内容完整传达，不要为了压缩字数而丢失关键信息
7. 字数控制在 300 词以内，但优先保证内容完整性`;
  }

  /**
   * 构建用户提示词
   */
  protected getUserPrompt(article: Article, content: string): string {
    return `请总结以下文章：

标题：${article.title}
链接：${article.url}
内容：
${content.slice(0, 8000)}`; // 限制内容长度避免超出上下文
  }

  /**
   * 辅助方法：带超时的 fetch
   */
  protected async fetchWithTimeout(url: string, options: RequestInit): Promise<Response> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeoutMs);

    try {
      const response = await fetch(url, {
        ...options,
        signal: controller.signal,
      });
      return response;
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        throw new Error('LLM_TIMEOUT');
      }
      throw error;
    } finally {
      clearTimeout(timeoutId);
    }
  }

  /**
   * 清理 LLM 输出
   */
  protected cleanOutput(content: string): string {
    return content
      .trim()
      .replace(/^```markdown\n?/i, '')
      .replace(/\n?```$/i, '')
      .trim();
  }
}
