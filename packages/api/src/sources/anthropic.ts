import { AppError } from '../utils/errors.js';
import { generateArticleId } from '../utils/id.js';
import { cleanHtmlEntities, cleanHtmlTags, parseDateFlexible } from '../utils/html-parser.js';
import { BaseSourceParser } from './base.js';
import type { Article, SourceConfig } from '../types.js';

/**
 * Claude Code Changelog 解析器
 * 使用 RSS feed 获取 changelog 数据
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
    // 使用 RSS feed 获取结构化数据
    const rssUrl = 'https://code.claude.com/docs/en/changelog/rss.xml';
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
        const contentEncoded = this.extractTag(itemContent, 'content:encoded');

        if (!title || !link || !pubDate) {
          continue;
        }

        const date = parseDateFlexible(pubDate);
        if (!date) {
          continue;
        }

        // 生成文章 ID
        const id = generateArticleId('anthropic', link, title);

        // 提取内容 - 清理 HTML 标签
        let content = cleanHtmlTags(cleanHtmlEntities(contentEncoded || ''));

        // 限制内容长度
        if (content.length > 500) {
          content = content.slice(0, 497) + '...';
        }

        // 标题格式: "2.1.78" -> "Claude Code 2.1.78"
        const articleTitle = title.match(/^\d+\.\d+\.\d+/)
          ? `Claude Code ${title}`
          : title;

        const article: Article = {
          id,
          source: 'anthropic',
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
      console.error('[anthropic] Parse error:', error);
      throw new AppError('SOURCE_PARSE_FAILED', error instanceof Error ? error : undefined);
    }

    if (articles.length === 0) {
      throw new AppError('SOURCE_EMPTY_ARTICLES');
    }

    return articles;
  }

  private extractTag(content: string, tagName: string): string {
    // 处理带命名空间的标签 (如 content:encoded)
    // 支持两种格式: <tag>value</tag> 和 <tag><![CDATA[value]]></tag>
    const regex = new RegExp(`<${tagName}[^>]*>(?:<!\\[CDATA\\[)?([\\s\\S]*?)(?:\\]\\]>)?<\/${tagName}>`, 'i');
    const match = content.match(regex);
    return match ? match[1].trim() : '';
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
