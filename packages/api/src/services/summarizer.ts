import { AppError } from '../utils/errors.js';
import { CloudflareLLMProvider } from '../providers/cloudflare.js';
import type { Article, ArticleSummary, SourceType, Env } from '../types.js';

export interface SummarizationResult {
  summary: ArticleSummary;
  isNew: boolean;
}

export interface SummarizerStats {
  totalFound: number;
  summarized: number;
  skippedDuplicate: number;
  skippedIncomplete: number;
  errors: string[];
}

/**
 * 总结服务 - 负责调用 LLM 生成摘要
 */
export class SummarizerService {
  private provider: CloudflareLLMProvider;
  private maxRetries: number = 2;
  private retryDelays: number[] = [1000, 3000]; // ms

  constructor(env: Env) {
    this.provider = new CloudflareLLMProvider(env);
  }

  /**
   * 为单篇文章生成摘要
   * @param article - 原始文章
   * @param isDuplicate - 是否已存在（如果存在则跳过 LLM 调用）
   */
  async summarize(
    article: Article,
    isDuplicate: boolean = false
  ): Promise<SummarizationResult | null> {
    // 如果已存在，直接返回原摘要
    if (isDuplicate) {
      return null; // 表示跳过
    }

    // 验证文章数据完整性
    if (!article.title || !article.url) {
      throw new AppError('SOURCE_ARTICLE_INCOMPLETE');
    }

    // 重试逻辑
    let lastError: AppError | null = null;

    for (let attempt = 0; attempt <= this.maxRetries; attempt++) {
      try {
        const summaryText = await this.provider.summarize(article);

        const summary: ArticleSummary = {
          ...article,
          summaryMd: summaryText,
          summarizedAt: new Date().toISOString(),
        };

        return { summary, isNew: true };
      } catch (error) {
        if (error instanceof AppError) {
          lastError = error;

          // 只有可重试的错误才重试
          if (!error.retryable || attempt >= this.maxRetries) {
            break;
          }

          // 等待后重试
          if (attempt < this.maxRetries) {
            await this.delay(this.retryDelays[attempt] || 3000);
          }
        } else {
          lastError = new AppError('LLM_REQUEST_FAILED', error instanceof Error ? error : undefined);
          break;
        }
      }
    }

    throw lastError || new AppError('LLM_REQUEST_FAILED');
  }

  /**
   * 批量总结文章
   * @param articles - 文章列表
   * @param existingIds - 已存在的文章 ID 集合
   */
  async summarizeBatch(
    articles: Article[],
    existingIds: Set<string>
  ): Promise<{ results: ArticleSummary[]; stats: SummarizerStats }> {
    const results: ArticleSummary[] = [];
    const stats: SummarizerStats = {
      totalFound: articles.length,
      summarized: 0,
      skippedDuplicate: 0,
      skippedIncomplete: 0,
      errors: [],
    };

    for (const article of articles) {
      try {
        // 检查是否已存在
        if (existingIds.has(article.id)) {
          stats.skippedDuplicate++;
          continue;
        }

        // 验证完整性
        if (!article.title || !article.url) {
          stats.skippedIncomplete++;
          continue;
        }

        // 生成摘要
        const result = await this.summarize(article, false);

        if (result && result.isNew) {
          results.push(result.summary);
          stats.summarized++;
        }
      } catch (error) {
        const errorMsg = error instanceof AppError
          ? `${error.code}: ${error.message}`
          : String(error);
        stats.errors.push(`Article "${article.title}": ${errorMsg}`);
      }
    }

    return { results, stats };
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}
