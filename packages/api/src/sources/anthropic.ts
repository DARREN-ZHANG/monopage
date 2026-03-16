import { AppError } from '../utils/errors.js';
import { generateArticleId } from '../utils/id.js';
import { BaseSourceParser } from './base.js';
import type { Article, SourceConfig } from '../types.js';

export class AnthropicSourceParser extends BaseSourceParser {
  constructor() {
    const config: SourceConfig = {
      name: 'anthropic',
      baseUrl: 'https://www.anthropic.com',
      newsUrl: 'https://www.anthropic.com/news',
    };
    super(config);
  }

  async fetchArticles(timeoutMs: number): Promise<Article[]> {
    const response = await this.fetchWithTimeout(this.newsUrl, timeoutMs);

    if (!response.ok) {
      throw new AppError('SOURCE_HTTP_ERROR');
    }

    const html = await response.text();
    return this.parseNewsPage(html);
  }

  private parseNewsPage(html: string): Article[] {
    const articles: Article[] = [];

    try {
      // Anthropic 新闻页面结构分析
      const patterns = [
        // 文章卡片包含链接和标题
        /<a[^>]*href="(\/news\/[^"]*)"[^>]*>\s*<[^>]*>\s*<h[1-6][^>]*>([^<]+)<\/h[1-6]>/gi,
        // article 标签内的链接
        /<article[^>]*>[\s\S]*?<a[^>]*href="(\/news\/[^"]*)"[^>]*>[\s\S]*?<h[1-6][^>]*>([^<]+)<\/h[1-6]>/gi,
      ];

      for (const pattern of patterns) {
        let match;
        while ((match = pattern.exec(html)) !== null) {
          const relativeUrl = match[1];
          const title = this.cleanHtmlEntities(match[2].trim());
          const url = `${this.config.baseUrl}${relativeUrl}`;

          // 尝试从 URL 或附近元素提取日期
          const publishedAt = this.extractDateFromUrl(relativeUrl) || new Date();

          const article: Article = {
            id: generateArticleId('anthropic', url, title),
            source: 'anthropic',
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

      // 如果上述模式没有匹配，尝试更宽松的匹配
      if (articles.length === 0) {
        const linkPattern = /href="(\/news\/[^"]*)"[^>]*>/gi;
        let linkMatch;
        const seenUrls = new Set<string>();

        while ((linkMatch = linkPattern.exec(html)) !== null) {
          const url = linkMatch[1];
          if (seenUrls.has(url) || url.includes('/news?page=')) {
            continue;
          }
          seenUrls.add(url);

          // 查找对应的标题
          const fullUrl = `${this.config.baseUrl}${url}`;
          const titlePattern = new RegExp(`href="${url.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}"[^>]*>[\\s\\S]{0,200}?>([^<]{10,200})<`, 'i');
          const titleMatch = html.match(titlePattern);

          if (titleMatch) {
            const title = this.cleanHtmlEntities(titleMatch[1].trim());
            const publishedAt = this.extractDateFromUrl(url) || new Date();

            articles.push({
              id: generateArticleId('anthropic', fullUrl, title),
              source: 'anthropic',
              title,
              url: fullUrl,
              publishedAt: publishedAt.toISOString(),
            });
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

  private extractDateFromUrl(url: string): Date | null {
    // Anthropic URL 格式: /news/announcing-claude-3-5-sonnet
    const dateMatch = url.match(/(\d{4})-(\d{2})-(\d{2})/);
    if (dateMatch) {
      const date = new Date(`${dateMatch[1]}-${dateMatch[2]}-${dateMatch[3]}`);
      if (!isNaN(date.getTime())) {
        return date;
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
                        html.match(/<article[^>]*>([\s\S]*?)<\/article>/i) ||
                        html.match(/class="[^"]*post-content[^"]*"[^>]*>([\s\S]*?)<\/div>/i);

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
