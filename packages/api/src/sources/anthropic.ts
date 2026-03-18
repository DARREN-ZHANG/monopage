import { AppError } from '../utils/errors.js';
import { generateArticleId } from '../utils/id.js';
import { cleanHtmlEntities, cleanHtmlTags, parseDateFlexible } from '../utils/html-parser.js';
import { BaseSourceParser } from './base.js';
import type { Article, SourceConfig } from '../types.js';

/**
 * Claude Code Changelog 解析器
 * 抓取 https://code.claude.com/docs/en/changelog
 */
export class AnthropicSourceParser extends BaseSourceParser {
  constructor() {
    const config: SourceConfig = {
      name: 'anthropic',
      baseUrl: 'https://code.claude.com',
      newsUrl: 'https://code.claude.com/docs/en/changelog',
    };
    super(config);
  }

  async fetchArticles(timeoutMs: number): Promise<Article[]> {
    const response = await this.fetchWithTimeout(this.config.newsUrl, timeoutMs);

    if (!response.ok) {
      throw new AppError('SOURCE_HTTP_ERROR');
    }

    const html = await response.text();
    return this.parseChangelogPage(html);
  }

  private parseChangelogPage(html: string): Article[] {
    const articles: Article[] = [];

    try {
      // Claude Code changelog 使用 markdown 风格的标题
      // 格式示例: ## March 14, 2025 或 ## v1.2.3

      // 匹配版本块：以 ## 或 ### 开头的标题，直到下一个同级标题
      const versionBlockRegex = /(?:^|\n)(?:#{2,3})\s*([^\n]+)\n([\s\S]*?)(?=(?:^|\n)#{2,3}\s|\Z)/g;

      let match;
      while ((match = versionBlockRegex.exec(html)) !== null) {
        const titleLine = cleanHtmlEntities(match[1].trim());
        const contentBlock = match[2].trim();

        // 解析标题行，可能是版本号或日期
        const { version, date } = this.parseTitleLine(titleLine);

        if (!date) {
          continue;
        }

        // 生成文章标题
        const articleTitle = version
          ? `Claude Code ${version}`
          : `Claude Code Update - ${titleLine}`;

        // 提取内容摘要（前200字符或第一个列表项）
        const summary = this.extractSummary(contentBlock);

        const article: Article = {
          id: generateArticleId('anthropic', this.config.newsUrl, articleTitle + date.toISOString()),
          source: 'anthropic',
          title: articleTitle,
          url: this.config.newsUrl,
          publishedAt: date.toISOString(),
          content: summary,
        };

        // 避免重复
        if (!articles.some(a => a.title === article.title && a.publishedAt === article.publishedAt)) {
          articles.push(article);
        }
      }

      // 如果上述正则没有匹配，尝试更通用的方式
      if (articles.length === 0) {
        return this.parseFallback(html);
      }

    } catch (error) {
      console.error('[anthropic] Parse error:', error);
      throw new AppError('SOURCE_PARSE_FAILED', error instanceof Error ? error : undefined);
    }

    if (articles.length === 0) {
      throw new AppError('SOURCE_EMPTY_ARTICLES');
    }

    return articles;
  }

  private parseTitleLine(titleLine: string): { version: string | null; date: Date | null } {
    let version: string | null = null;
    let date: Date | null = null;

    // 尝试匹配版本号: v1.2.3 或 1.2.3
    const versionMatch = titleLine.match(/v?(\d+\.\d+\.\d+)/i);
    if (versionMatch) {
      version = versionMatch[1];
    }

    // 尝试匹配日期: March 14, 2025 或 2025-03-14
    const dateMatch = titleLine.match(/([A-Z][a-z]+\s+\d{1,2},?\s+\d{4})|(\d{4}-\d{2}-\d{2})/);
    if (dateMatch) {
      date = parseDateFlexible(dateMatch[0]);
    }

    return { version, date };
  }

  private extractSummary(contentBlock: string): string {
    // 移除 markdown 标记
    let text = contentBlock
      .replace(/```[\s\S]*?```/g, '[code]')
      .replace(/`[^`]+`/g, '[code]')
      .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
      .replace(/[*_~#]/g, '')
      .replace(/\n+/g, ' ')
      .trim();

    // 限制长度
    if (text.length > 300) {
      text = text.slice(0, 297) + '...';
    }

    return text;
  }

  private parseFallback(html: string): Article[] {
    const articles: Article[] = [];

    // 清理 HTML 标签后的纯文本处理
    const text = cleanHtmlTags(html);

    // 尝试匹配日期行
    const lines = text.split('\n');
    let currentDate: Date | null = null;
    let currentContent: string[] = [];

    for (const line of lines) {
      const trimmedLine = line.trim();
      if (!trimmedLine) continue;

      // 检查是否是日期行
      const date = parseDateFlexible(trimmedLine);
      if (date) {
        // 保存前一个块
        if (currentDate && currentContent.length > 0) {
          articles.push(this.createArticle(currentDate, currentContent.join(' ')));
        }
        currentDate = date;
        currentContent = [];
      } else if (currentDate) {
        currentContent.push(trimmedLine);
      }
    }

    // 保存最后一个块
    if (currentDate && currentContent.length > 0) {
      articles.push(this.createArticle(currentDate, currentContent.join(' ')));
    }

    return articles;
  }

  private createArticle(date: Date, content: string): Article {
    const title = `Claude Code Update - ${date.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}`;
    return {
      id: generateArticleId('anthropic', this.config.newsUrl, title + date.toISOString()),
      source: 'anthropic',
      title,
      url: this.config.newsUrl,
      publishedAt: date.toISOString(),
      content: content.slice(0, 300),
    };
  }

  async fetchArticleContent(url: string, timeoutMs: number): Promise<string> {
    // Changelog 页面已经包含完整内容
    const response = await this.fetchWithTimeout(url, timeoutMs);

    if (!response.ok) {
      throw new AppError('SOURCE_CONTENT_FETCH_FAILED');
    }

    const html = await response.text();
    return cleanHtmlTags(html).slice(0, 2000);
  }
}
