import { AppError } from '../utils/errors.js';
import { generateArticleId } from '../utils/id.js';
import { BaseSourceParser } from './base.js';
import type { Article, SourceConfig } from '../types.js';

export class OpenAISourceParser extends BaseSourceParser {
  constructor() {
    const config: SourceConfig = {
      name: 'openai',
      baseUrl: 'https://openai.com',
      newsUrl: 'https://openai.com/news',
    };
    super(config);
  }

  async fetchArticles(timeoutMs: number): Promise<Article[]> {
    // 尝试使用 RSS Feed（新 URL）
    const rssUrls = [
      'https://openai.com/news/rss.xml',
      'https://openai.com/blog/rss.xml', // 旧 URL 作为备用
    ];

    const debugInfo: any[] = [];

    for (const rssUrl of rssUrls) {
      try {
        console.log(`[openai] Trying ${rssUrl}`);
        const response = await this.fetchWithTimeout(rssUrl, timeoutMs);
        console.log(`[openai] Response status: ${response.status}, ok: ${response.ok}`);

        debugInfo.push({ url: rssUrl, status: response.status, ok: response.ok });

        if (response.ok) {
          const xmlText = await response.text();
          console.log(`[openai] RSS content length: ${xmlText.length}`);
          const articles = this.parseRSSFeed(xmlText);
          console.log(`[openai] Parsed ${articles.length} articles`);
          return articles;
        }
      } catch (err) {
        console.error(`[openai] RSS ${rssUrl} error:`, err);
        debugInfo.push({ url: rssUrl, error: String(err) });
      }
    }

    // 所有 RSS 尝试失败，返回调试信息
    throw new AppError('SOURCE_HTTP_ERROR', new Error(JSON.stringify(debugInfo)));
  }

  private parseRSSFeed(xmlText: string): Article[] {
    const articles: Article[] = [];

    try {
      // 使用正则表达式解析 RSS XML（Cloudflare Workers 不支持 DOMParser）
      const itemRegex = /<item>[\s\S]*?<\/item>/g;
      const items = xmlText.matchAll(itemRegex);

      for (const itemMatch of items) {
        const itemContent = itemMatch[0];

        const title = this.extractTagContent(itemContent, 'title');
        const link = this.extractTagContent(itemContent, 'link');
        const pubDate = this.extractTagContent(itemContent, 'pubDate');
        const description = this.extractTagContent(itemContent, 'description');

        if (title && link && pubDate) {
          const publishedAt = this.parseDate(pubDate);
          if (!publishedAt) {
            continue;
          }
          const article: Article = {
            id: generateArticleId('openai', link, title),
            source: 'openai',
            title: this.cleanHtmlEntities(title),
            url: link,
            publishedAt: publishedAt.toISOString(),
            content: description ? this.cleanHtmlTags(description) : undefined,
          };
          articles.push(article);
        }
      }
    } catch (error) {
      throw new AppError('SOURCE_PARSE_FAILED', error instanceof Error ? error : undefined);
    }

    if (articles.length === 0) {
      throw new AppError('SOURCE_EMPTY_ARTICLES');
    }

    return articles;
  }

  private parseNewsPage(html: string): Article[] {
    const articles: Article[] = [];

    try {
      // 尝试多种文章卡片模式
      const patterns = [
        // OpenAI 博客文章卡片
        /<a[^>]*href="(\/news\/[^"]*)"[^>]*>[\s\S]*?<h[1-6][^>]*>([^<]+)<\/h[1-6]>/gi,
        // 备用模式
        /<article[^>]*>[\s\S]*?<a[^>]*href="(\/news\/[^"]*)"[^>]*>[\s\S]*?<h[1-6][^>]*>([^<]+)<\/h[1-6]>/gi,
      ];

      for (const pattern of patterns) {
        let match;
        while ((match = pattern.exec(html)) !== null) {
          const relativeUrl = match[1];
          const title = this.cleanHtmlEntities(match[2].trim());
          const url = `${this.config.baseUrl}${relativeUrl}`;
          const snippet = html.slice(Math.max(0, match.index - 300), Math.min(html.length, match.index + 700));

          // 优先从页面片段读取发布时间，失败再回退 URL
          const publishedAt = this.extractDateFromSnippet(snippet) || this.extractDateFromUrl(relativeUrl);
          if (!publishedAt) {
            continue;
          }

          const article: Article = {
            id: generateArticleId('openai', url, title),
            source: 'openai',
            title,
            url,
            publishedAt: publishedAt.toISOString(),
          };

          // 避免重复
          if (!articles.some(a => a.id === article.id)) {
            articles.push(article);
          }
        }
      }
    } catch (error) {
      throw new AppError('SOURCE_PARSE_FAILED', error instanceof Error ? error : undefined);
    }

    if (articles.length === 0) {
      throw new AppError('SOURCE_EMPTY_ARTICLES');
    }

    return articles;
  }

  private extractTagContent(xml: string, tagName: string): string | null {
    // 尝试匹配 CDATA 内容
    const cdataRegex = new RegExp(`<${tagName}[^>]*><!\\[CDATA\\[([\\s\\S]*?)\\]\\]><\\/${tagName}>`, 'i');
    const cdataMatch = xml.match(cdataRegex);
    if (cdataMatch) {
      return cdataMatch[1].trim();
    }

    // 回退到普通内容匹配
    const regex = new RegExp(`<${tagName}[^>]*>([^<]*)<\\/${tagName}>`, 'i');
    const match = xml.match(regex);
    return match ? match[1].trim() : null;
  }

  private parseDate(dateStr: string): Date | null {
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) {
      return null;
    }
    return date;
  }

  private extractDateFromUrl(url: string): Date | null {
    // OpenAI URL 格式: /news/announcing-gpt-4o
    // 有时 URL 中包含日期信息
    const dateMatch = url.match(/(\d{4})-(\d{2})-(\d{2})/);
    if (dateMatch) {
      const date = new Date(`${dateMatch[1]}-${dateMatch[2]}-${dateMatch[3]}`);
      if (!isNaN(date.getTime())) {
        return date;
      }
    }
    return null;
  }

  private extractDateFromSnippet(snippet: string): Date | null {
    const datetimeAttr = snippet.match(/datetime="([^"]+)"/i)?.[1];
    if (datetimeAttr) {
      const parsed = new Date(datetimeAttr);
      if (!isNaN(parsed.getTime())) {
        return parsed;
      }
    }

    const dateText =
      snippet.match(/\b\d{4}-\d{2}-\d{2}\b/)?.[0] ||
      snippet.match(/\b[A-Z][a-z]{2,8}\s+\d{1,2},\s+\d{4}\b/)?.[0];
    if (dateText) {
      const parsed = new Date(dateText);
      if (!isNaN(parsed.getTime())) {
        return parsed;
      }
    }

    return null;
  }

  private cleanHtmlEntities(text: string): string {
    return text
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/&nbsp;/g, ' ');
  }

  private cleanHtmlTags(html: string): string {
    return html
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  async fetchArticleContent(url: string, timeoutMs: number): Promise<string> {
    const response = await this.fetchWithTimeout(url, timeoutMs);

    if (!response.ok) {
      throw new AppError('SOURCE_CONTENT_FETCH_FAILED');
    }

    const html = await response.text();

    // 尝试提取文章正文
    const contentMatch = html.match(/<main[^>]*>([\s\S]*?)<\/main>/i) ||
                        html.match(/<article[^>]*>([\s\S]*?)<\/article>/i);

    if (contentMatch) {
      return this.cleanHtmlTags(contentMatch[1]);
    }

    // 备选方案：提取所有段落
    const paragraphs: string[] = [];
    const pRegex = /<p[^>]*>([\s\S]*?)<\/p>/gi;
    let match;
    while ((match = pRegex.exec(html)) !== null) {
      const text = this.cleanHtmlTags(match[1]);
      if (text.length > 50) {
        paragraphs.push(text);
      }
    }

    return paragraphs.join('\n\n');
  }
}
