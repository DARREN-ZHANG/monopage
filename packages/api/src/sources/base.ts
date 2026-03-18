import { AppError } from '../utils/errors.js';
import type { Article, SourceConfig, SourceType } from '../types.js';

/**
 * 数据源解析器抽象类
 * 所有具体数据源解析器都需要继承此类
 */
export abstract class BaseSourceParser {
  protected config: SourceConfig;

  constructor(config: SourceConfig) {
    this.config = config;
  }

  /**
   * 获取数据源名称
   */
  get name(): SourceType {
    return this.config.name;
  }

  /**
   * 获取新闻页面 URL
   */
  get newsUrl(): string {
    return this.config.newsUrl;
  }

  /**
   * 抓取并解析文章列表
   * @param timeoutMs - 请求超时时间（毫秒）
   * @returns 文章列表
   * @throws {AppError} 抓取或解析失败时抛出错误
   */
  abstract fetchArticles(timeoutMs: number): Promise<Article[]>;

  /**
   * 获取单篇文章的完整内容
   * @param url - 文章 URL
   * @param timeoutMs - 请求超时时间（毫秒）
   * @returns 文章内容
   * @throws {AppError} 获取失败时抛出错误
   */
  abstract fetchArticleContent(url: string, timeoutMs: number): Promise<string>;

  /**
   * 辅助方法：带超时的 fetch
   */
  protected async fetchWithTimeout(url: string, timeoutMs: number): Promise<Response> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    try {
      console.log(`[fetchWithTimeout] Fetching ${url}`);
      const response = await fetch(url, {
        signal: controller.signal,
        redirect: 'follow',
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; Monopage/1.0; +https://github.com/monopage)',
          'Accept': 'application/rss+xml, application/xml, text/xml, */*',
        },
      });
      console.log(`[fetchWithTimeout] Response: ${response.status} ${response.statusText}, ok=${response.ok}`);
      return response;
    } catch (error) {
      console.error(`[fetchWithTimeout] Error:`, error);
      if (error instanceof Error && error.name === 'AbortError') {
        throw new AppError('SOURCE_TIMEOUT');
      }
      throw new AppError('SOURCE_FETCH_FAILED', error instanceof Error ? error : undefined);
    } finally {
      clearTimeout(timeoutId);
    }
  }

  /**
   * 辅助方法：验证文章数据完整性
   */
  protected validateArticle(article: Partial<Article>): article is Article {
    return !!(
      article.id &&
      article.source &&
      article.title &&
      article.url &&
      article.publishedAt
    );
  }

  /**
   * 过滤最近 N 小时内的文章
   */
  protected filterRecentArticles(articles: Article[], hours: number): Article[] {
    const cutoff = new Date();
    cutoff.setHours(cutoff.getHours() - hours);

    return articles.filter(article => {
      const published = new Date(article.publishedAt);
      return published >= cutoff;
    });
  }
}
