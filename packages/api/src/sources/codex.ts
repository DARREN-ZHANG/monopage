import { AppError } from '../utils/errors.js';
import { generateArticleId } from '../utils/id.js';
import { cleanHtmlEntities, cleanHtmlTags, parseDateFlexible } from '../utils/html-parser.js';
import { BaseSourceParser } from './base.js';
import type { Article, SourceConfig } from '../types.js';

/**
 * OpenAI Codex Changelog 解析器
 * 抓取 https://developers.openai.com/codex/changelog
 */
export class CodexSourceParser extends BaseSourceParser {
  constructor() {
    const config: SourceConfig = {
      name: 'codex',
      baseUrl: 'https://developers.openai.com',
      newsUrl: 'https://developers.openai.com/codex/changelog',
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
      // Codex changelog 分为 CLI 和 App 两个区域
      // 格式通常是版本号 + 日期 + 更新内容

      // 策略1: 匹配版本块 (## 或 ### 标题)
      const versionBlockRegex = /(?:^|\n)(?:#{2,4})\s*([^\n]+)\n([\s\S]*?)(?=(?:^|\n)#{2,4}\s|\Z)/g;

      let match;
      while ((match = versionBlockRegex.exec(html)) !== null) {
        const titleLine = cleanHtmlEntities(match[1].trim());
        const contentBlock = match[2].trim();

        const { version, component, date } = this.parseTitleLine(titleLine);

        if (!date) {
          continue;
        }

        // 生成标题
        const prefix = component ? `[${component}] ` : '';
        const articleTitle = version
          ? `${prefix}Codex ${version}`
          : `${prefix}Codex Update - ${titleLine}`;

        const summary = this.extractSummary(contentBlock);

        const article: Article = {
          id: generateArticleId('codex', this.config.newsUrl, articleTitle + date.toISOString()),
          source: 'codex',
          title: articleTitle,
          url: this.config.newsUrl,
          publishedAt: date.toISOString(),
          content: summary,
        };

        if (!articles.some(a => a.title === article.title && a.publishedAt === article.publishedAt)) {
          articles.push(article);
        }
      }

      // 如果没有匹配，尝试备用解析
      if (articles.length === 0) {
        return this.parseFallback(html);
      }

    } catch (error) {
      console.error('[codex] Parse error:', error);
      throw new AppError('SOURCE_PARSE_FAILED', error instanceof Error ? error : undefined);
    }

    if (articles.length === 0) {
      throw new AppError('SOURCE_EMPTY_ARTICLES');
    }

    return articles;
  }

  private parseTitleLine(titleLine: string): { version: string | null; component: string | null; date: Date | null } {
    let version: string | null = null;
    let component: string | null = null;
    let date: Date | null = null;

    // 检测组件类型 (CLI, App, Desktop 等)
    if (/cli/i.test(titleLine)) {
      component = 'CLI';
    } else if (/app/i.test(titleLine) || /desktop/i.test(titleLine)) {
      component = 'App';
    }

    // 匹配版本号
    const versionMatch = titleLine.match(/v?(\d+\.\d+(?:\.\d+)?)/i);
    if (versionMatch) {
      version = versionMatch[1];
    }

    // 匹配日期
    const datePatterns = [
      /([A-Z][a-z]+\s+\d{1,2},?\s+\d{4})/,
      /(\d{4}-\d{2}-\d{2})/,
      /(\d{1,2}\/\d{1,2}\/\d{4})/,
    ];

    for (const pattern of datePatterns) {
      const match = titleLine.match(pattern);
      if (match) {
        date = parseDateFlexible(match[1]);
        if (date) break;
      }
    }

    return { version, component, date };
  }

  private extractSummary(contentBlock: string): string {
    let text = contentBlock
      .replace(/```[\s\S]*?```/g, '[code]')
      .replace(/`[^`]+`/g, '[code]')
      .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
      .replace(/[*_~#]/g, '')
      .replace(/\n+/g, ' ')
      .trim();

    if (text.length > 300) {
      text = text.slice(0, 297) + '...';
    }

    return text;
  }

  private parseFallback(html: string): Article[] {
    const articles: Article[] = [];
    const text = cleanHtmlTags(html);
    const lines = text.split('\n');

    let currentDate: Date | null = null;
    let currentContent: string[] = [];
    let currentVersion: string | null = null;

    for (const line of lines) {
      const trimmedLine = line.trim();
      if (!trimmedLine) continue;

      const date = parseDateFlexible(trimmedLine);
      const versionMatch = trimmedLine.match(/v?(\d+\.\d+\.\d+)/i);

      if (date || versionMatch) {
        if (currentDate && currentContent.length > 0) {
          const title = currentVersion
            ? `Codex ${currentVersion}`
            : `Codex Update`;
          articles.push({
            id: generateArticleId('codex', this.config.newsUrl, title + currentDate.toISOString()),
            source: 'codex',
            title,
            url: this.config.newsUrl,
            publishedAt: currentDate.toISOString(),
            content: currentContent.join(' ').slice(0, 300),
          });
        }

        currentDate = date;
        currentVersion = versionMatch ? versionMatch[1] : null;
        currentContent = [];
      } else if (currentDate) {
        currentContent.push(trimmedLine);
      }
    }

    // 保存最后一个块
    if (currentDate && currentContent.length > 0) {
      const title = currentVersion ? `Codex ${currentVersion}` : 'Codex Update';
      articles.push({
        id: generateArticleId('codex', this.config.newsUrl, title + currentDate.toISOString()),
        source: 'codex',
        title,
        url: this.config.newsUrl,
        publishedAt: currentDate.toISOString(),
        content: currentContent.join(' ').slice(0, 300),
      });
    }

    return articles;
  }

  async fetchArticleContent(url: string, timeoutMs: number): Promise<string> {
    const response = await this.fetchWithTimeout(url, timeoutMs);

    if (!response.ok) {
      throw new AppError('SOURCE_CONTENT_FETCH_FAILED');
    }

    const html = await response.text();
    return cleanHtmlTags(html).slice(0, 2000);
  }
}
