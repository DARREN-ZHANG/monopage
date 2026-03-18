import { AppError } from '../utils/errors.js';
import { generateArticleId } from '../utils/id.js';
import { cleanHtmlEntities, cleanHtmlTags, parseDateFlexible } from '../utils/html-parser.js';
import { BaseSourceParser } from './base.js';
import type { Article, SourceConfig } from '../types.js';

/**
 * OpenCode Changelog 解析器
 * 抓取 https://opencode.ai/changelog
 */
export class OpenCodeSourceParser extends BaseSourceParser {
  constructor() {
    const config: SourceConfig = {
      name: 'opencode',
      baseUrl: 'https://opencode.ai',
      newsUrl: 'https://opencode.ai/changelog',
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
      // OpenCode changelog 使用中文日期分组
      // 格式: 2024年3月15日 -> 各组件更新 (Core, Desktop, TUI, SDK)

      // 策略1: 匹配日期块
      const dateBlockRegex = /(?:^|\n)(\d{4}年\d{1,2}月\d{1,2}日)[\s\S]*?(?=(?:^|\n)\d{4}年\d{1,2}月\d{1,2}日|\Z)/g;

      let match;
      while ((match = dateBlockRegex.exec(html)) !== null) {
        const dateStr = match[1];
        const contentBlock = match[0];

        const date = parseDateFlexible(dateStr);
        if (!date) {
          continue;
        }

        // 尝试提取各组件的更新
        const componentUpdates = this.parseComponentUpdates(contentBlock, date);

        if (componentUpdates.length > 0) {
          articles.push(...componentUpdates);
        } else {
          // 如果没有分组件，创建一个通用更新
          const summary = this.extractSummary(contentBlock.replace(dateStr, ''));
          articles.push({
            id: generateArticleId('opencode', this.config.newsUrl, 'OpenCode Update' + date.toISOString()),
            source: 'opencode',
            title: `OpenCode Update - ${dateStr}`,
            url: this.config.newsUrl,
            publishedAt: date.toISOString(),
            content: summary,
          });
        }
      }

      // 如果没有匹配中文日期，尝试其他格式
      if (articles.length === 0) {
        return this.parseFallback(html);
      }

    } catch (error) {
      console.error('[opencode] Parse error:', error);
      throw new AppError('SOURCE_PARSE_FAILED', error instanceof Error ? error : undefined);
    }

    if (articles.length === 0) {
      throw new AppError('SOURCE_EMPTY_ARTICLES');
    }

    return articles;
  }

  private parseComponentUpdates(contentBlock: string, date: Date): Article[] {
    const articles: Article[] = [];
    const components = ['Core', 'Desktop', 'TUI', 'SDK'];

    for (const component of components) {
      // 匹配组件块：## Core 或 **Core** 等
      const componentRegex = new RegExp(
        `(?:#{2,3}|\\*\\*)\\s*${component}[\\s\\S]*?(?=(?:#{2,3}|\\*\\*)\\s*(?:Core|Desktop|TUI|SDK)|\\Z)`,
        'gi'
      );

      const match = contentBlock.match(componentRegex);
      if (match) {
        const summary = this.extractSummary(match[0]);
        articles.push({
          id: generateArticleId('opencode', this.config.newsUrl, `${component} ${date.toISOString()}`),
          source: 'opencode',
          title: `OpenCode ${component} Update`,
          url: this.config.newsUrl,
          publishedAt: date.toISOString(),
          content: summary,
        });
      }
    }

    return articles;
  }

  private extractSummary(contentBlock: string): string {
    let text = contentBlock
      .replace(/```[\s\S]*?```/g, '[code]')
      .replace(/`[^`]+`/g, '[code]')
      .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
      .replace(/[*_~#]/g, '')
      .replace(/\d{4}年\d{1,2}月\d{1,2}日/g, '')
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

    for (const line of lines) {
      const trimmedLine = line.trim();
      if (!trimmedLine) continue;

      const date = parseDateFlexible(trimmedLine);

      if (date) {
        if (currentDate && currentContent.length > 0) {
          articles.push({
            id: generateArticleId('opencode', this.config.newsUrl, currentDate.toISOString()),
            source: 'opencode',
            title: 'OpenCode Update',
            url: this.config.newsUrl,
            publishedAt: currentDate.toISOString(),
            content: currentContent.join(' ').slice(0, 300),
          });
        }

        currentDate = date;
        currentContent = [];
      } else if (currentDate) {
        currentContent.push(trimmedLine);
      }
    }

    // 保存最后一个块
    if (currentDate && currentContent.length > 0) {
      articles.push({
        id: generateArticleId('opencode', this.config.newsUrl, currentDate.toISOString()),
        source: 'opencode',
        title: 'OpenCode Update',
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
