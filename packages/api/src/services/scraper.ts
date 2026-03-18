import { AppError } from '../utils/errors.js';
import { OpenAISourceParser } from '../sources/openai.js';
import { AnthropicSourceParser } from '../sources/anthropic.js';
import { CodexSourceParser } from '../sources/codex.js';
import { OpenCodeSourceParser } from '../sources/opencode.js';
import type { Article, SourceType, Env } from '../types.js';

export interface ScrapingResult {
  source: SourceType;
  articles: Article[];
  errors: AppError[];
}

/**
 * 抓取服务 - 负责从各个数据源抓取文章
 */
export class ScraperService {
  private timeoutMs: number;

  constructor(env: Env) {
    this.timeoutMs = parseInt(env.SCRAPER_TIMEOUT_MS, 10) || 15000;
  }

  /**
   * 从指定数据源抓取文章
   * @param source - 数据源类型
   * @param filterRecentHours - 只保留最近 N 小时的文章
   */
  async scrapeSource(source: SourceType, filterRecentHours: number = 24): Promise<ScrapingResult> {
    const errors: AppError[] = [];

    try {
      const parser = this.createParser(source);
      let articles = await parser.fetchArticles(this.timeoutMs);

      // 获取文章正文（如果 RSS 中没有）
      for (const article of articles) {
        if (!article.content) {
          try {
            article.content = await parser.fetchArticleContent(article.url, this.timeoutMs);
          } catch (error) {
            // 正文获取失败不是致命错误，继续处理
            console.warn(`Failed to fetch content for ${article.url}:`, error);
          }
        }
      }

      // 过滤最近的文章
      const cutoff = new Date();
      cutoff.setHours(cutoff.getHours() - filterRecentHours);

      articles = articles.filter(article => {
        const published = new Date(article.publishedAt);
        return published >= cutoff;
      });

      return { source, articles, errors };
    } catch (error) {
      if (error instanceof AppError) {
        errors.push(error);
      } else {
        errors.push(new AppError('SOURCE_FETCH_FAILED', error instanceof Error ? error : undefined));
      }
      return { source, articles: [], errors };
    }
  }

  /**
   * 从所有数据源抓取文章
   */
  async scrapeAll(filterRecentHours: number = 24): Promise<ScrapingResult[]> {
    const sources: SourceType[] = ['openai', 'anthropic', 'codex', 'opencode'];

    // 顺序抓取，避免并发限制
    const results: ScrapingResult[] = [];
    for (const source of sources) {
      const result = await this.scrapeSource(source, filterRecentHours);
      results.push(result);
    }

    return results;
  }

  private createParser(source: SourceType) {
    switch (source) {
      case 'openai':
        return new OpenAISourceParser();
      case 'anthropic':
        return new AnthropicSourceParser();
      case 'codex':
        return new CodexSourceParser();
      case 'opencode':
        return new OpenCodeSourceParser();
      default:
        throw new AppError('VALIDATION_INVALID_SOURCE');
    }
  }
}
