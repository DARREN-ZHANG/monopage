import { AppError } from '../utils/errors.js';
import { generateArticleId } from '../utils/id.js';
import { cleanHtmlTags } from '../utils/html-parser.js';
import { BaseSourceParser } from './base.js';
import type { Article, SourceConfig } from '../types.js';

/**
 * GitHub Release 数据结构
 */
interface GitHubRelease {
  tag_name: string;
  name: string;
  published_at: string;
  html_url: string;
  body: string;
}

/**
 * OpenCode Changelog 解析器
 * 使用 GitHub Releases API 获取 changelog 数据
 */
export class OpenCodeSourceParser extends BaseSourceParser {
  private readonly githubRepo = 'anomalyco/opencode';
  private readonly githubApiUrl = `https://api.github.com/repos/${this.githubRepo}/releases`;

  constructor() {
    const config: SourceConfig = {
      name: 'opencode',
      baseUrl: 'https://opencode.ai',
      newsUrl: 'https://opencode.ai/changelog',
    };
    super(config);
  }

  async fetchArticles(timeoutMs: number): Promise<Article[]> {
    // 使用 GitHub Releases API 获取数据
    const response = await this.fetchWithTimeout(this.githubApiUrl, timeoutMs);

    if (!response.ok) {
      throw new AppError('SOURCE_HTTP_ERROR');
    }

    const releases: GitHubRelease[] = await response.json();
    return this.parseReleases(releases);
  }

  private parseReleases(releases: GitHubRelease[]): Article[] {
    const articles: Article[] = [];

    try {
      for (const release of releases) {
        if (!release.tag_name || !release.published_at || !release.html_url) {
          continue;
        }

        const date = new Date(release.published_at);
        if (isNaN(date.getTime())) {
          continue;
        }

        // 生成文章 ID
        const id = generateArticleId('opencode', release.html_url, release.tag_name);

        // 解析 release body 中的更新内容
        const content = this.parseReleaseBody(release.body || '');

        // 确定组件类型
        const components = this.detectComponents(release.body || '');

        // 为每个组件创建单独的文章
        if (components.length > 0) {
          for (const component of components) {
            const componentContent = this.extractComponentContent(release.body || '', component);
            const article: Article = {
              id: generateArticleId('opencode', release.html_url, `${release.tag_name}-${component}`),
              source: 'opencode',
              title: `[${component}] OpenCode ${release.tag_name}`,
              url: release.html_url,
              publishedAt: date.toISOString(),
              content: componentContent || content,
            };

            if (!articles.some(a => a.id === article.id)) {
              articles.push(article);
            }
          }
        } else {
          // 没有组件分类，创建通用文章
          const article: Article = {
            id,
            source: 'opencode',
            title: `OpenCode ${release.tag_name}`,
            url: release.html_url,
            publishedAt: date.toISOString(),
            content,
          };

          if (!articles.some(a => a.id === article.id)) {
            articles.push(article);
          }
        }
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

  private parseReleaseBody(body: string): string {
    // 清理 Markdown 格式，保留纯文本
    let text = body
      .replace(/```[\s\S]*?```/g, '[code]')
      .replace(/`[^`]+`/g, '[code]')
      .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
      .replace(/#{1,6}\s*/g, '')
      .replace(/[*_~]/g, '')
      .replace(/\n+/g, ' ')
      .trim();

    if (text.length > 500) {
      text = text.slice(0, 497) + '...';
    }

    return text;
  }

  private detectComponents(body: string): string[] {
    const components: string[] = [];
    const componentPatterns = [
      { name: 'Core', pattern: /(?:^|\n)#{1,3}\s*Core\s*\n/i },
      { name: 'Desktop', pattern: /(?:^|\n)#{1,3}\s*Desktop\s*\n/i },
      { name: 'TUI', pattern: /(?:^|\n)#{1,3}\s*TUI\s*\n/i },
      { name: 'SDK', pattern: /(?:^|\n)#{1,3}\s*SDK\s*\n/i },
    ];

    for (const { name, pattern } of componentPatterns) {
      if (pattern.test(body)) {
        components.push(name);
      }
    }

    return components;
  }

  private extractComponentContent(body: string, component: string): string {
    // 提取特定组件的内容
    const regex = new RegExp(
      `(?:^|\\n)#{1,3}\\s*${component}\\s*\\n([\\s\\S]*?)(?=(?:^|\\n)#{1,3}\\s*(?:Core|Desktop|TUI|SDK)\\s*\\n|$)`,
      'i'
    );

    const match = body.match(regex);
    if (match) {
      return this.parseReleaseBody(match[1]);
    }

    return '';
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
