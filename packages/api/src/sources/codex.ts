import { AppError } from '../utils/errors.js';
import { generateArticleId } from '../utils/id.js';
import { cleanHtmlEntities, cleanHtmlTags, parseDateFlexible } from '../utils/html-parser.js';
import { BaseSourceParser } from './base.js';
import type { Article, SourceConfig } from '../types.js';

/**
 * OpenAI Codex Changelog 解析器
 * 使用 RSS feed 获取 changelog 数据
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
    // 使用 RSS feed 获取结构化数据
    const rssUrl = 'https://developers.openai.com/codex/changelog/rss.xml';
    const response = await this.fetchWithTimeout(rssUrl, timeoutMs);

    if (!response.ok) {
      throw new AppError('SOURCE_HTTP_ERROR');
    }

    const xml = await response.text();
    return this.parseRssFeed(xml);
  }

  private parseRssFeed(xml: string): Article[] {
    const articles: Article[] = [];

    try {
      // 解析 RSS feed 中的 item
      // RSS 格式: <item><title>...</title><link>...</link><pubDate>...</pubDate><content:encoded>...</content:encoded></item>
      const itemRegex = /<item>([\s\S]*?)<\/item>/gi;

      let match;
      while ((match = itemRegex.exec(xml)) !== null) {
        const itemContent = match[1];

        const title = this.extractTag(itemContent, 'title');
        const link = this.extractTag(itemContent, 'link');
        const pubDate = this.extractTag(itemContent, 'pubDate');
        const description = this.extractTag(itemContent, 'description');
        const contentEncoded = this.extractTag(itemContent, 'content:encoded');

        if (!title || !link || !pubDate) {
          continue;
        }

        const date = parseDateFlexible(pubDate);
        if (!date) {
          continue;
        }

        // 生成文章 ID
        const id = generateArticleId('codex', link, title);

        // 提取内容 - 优先使用 content:encoded，否则使用 description
        let content = contentEncoded || description || '';
        content = cleanHtmlTags(cleanHtmlEntities(content));

        // 限制内容长度
        if (content.length > 500) {
          content = content.slice(0, 497) + '...';
        }

        // 确定组件类型 (CLI, App, Desktop 等)
        const component = this.detectComponent(title);
        const articleTitle = component ? `[${component}] ${title}` : title;

        const article: Article = {
          id,
          source: 'codex',
          title: articleTitle,
          url: link,
          publishedAt: date.toISOString(),
          content,
        };

        // 去重
        if (!articles.some(a => a.id === article.id)) {
          articles.push(article);
        }
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

  private extractTag(content: string, tagName: string): string {
    // 处理带命名空间的标签 (如 content:encoded)
    const regex = new RegExp(`<${tagName}[^>]*>([\\s\\S]*?)<\/${tagName}>`, 'i');
    const match = content.match(regex);
    return match ? match[1].trim() : '';
  }

  private detectComponent(title: string): string | null {
    const lowerTitle = title.toLowerCase();

    if (lowerTitle.includes('cli') || lowerTitle.includes('release:')) {
      return 'CLI';
    }
    if (lowerTitle.includes('app') || lowerTitle.includes('desktop')) {
      return 'App';
    }
    if (lowerTitle.includes('api')) {
      return 'API';
    }

    return null;
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
