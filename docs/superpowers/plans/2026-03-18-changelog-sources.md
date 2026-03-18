# Coding Agent Changelog 数据源实现计划

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 为 Monopage 添加三个 coding agent 工具的 changelog 追踪功能

**Architecture:** 创建三个新的 SourceParser（Codex、OpenCode），修改现有的 Anthropic 解析器以抓取 Claude Code changelog。所有解析器继承 BaseSourceParser，使用正则表达式解析 HTML（Cloudflare Workers 不支持 DOM）。

**Tech Stack:** TypeScript, Cloudflare Workers, 正则表达式解析

---

## 文件变更概览

| 文件 | 操作 | 说明 |
|-----|------|-----|
| `packages/api/src/types.ts` | 修改 | 扩展 SourceType |
| `packages/api/src/utils/html-parser.ts` | 创建 | 通用 HTML 解析工具 |
| `packages/api/src/sources/anthropic.ts` | 修改 | 改为抓取 Claude Code changelog |
| `packages/api/src/sources/codex.ts` | 创建 | Codex changelog 解析器 |
| `packages/api/src/sources/opencode.ts` | 创建 | OpenCode changelog 解析器 |
| `packages/api/src/services/scraper.ts` | 修改 | 注册新解析器 |

---

## Task 1: 扩展 SourceType 类型

**Files:**
- Modify: `packages/api/src/types.ts:26`

- [ ] **Step 1: 修改 SourceType 类型定义**

```typescript
// 将
export type SourceType = 'openai' | 'anthropic';

// 改为
export type SourceType = 'openai' | 'anthropic' | 'codex' | 'opencode';
```

- [ ] **Step 2: 验证类型变更**

运行: `cd packages/api && pnpm exec tsc --noEmit`
预期: 无类型错误（可能有未使用警告，忽略）

- [ ] **Step 3: 提交类型变更**

```bash
git add packages/api/src/types.ts
git commit -m "feat(api): extend SourceType with codex and opencode"
```

---

## Task 2: 创建通用 HTML 解析工具

**Files:**
- Create: `packages/api/src/utils/html-parser.ts`

- [ ] **Step 1: 创建 html-parser.ts 文件**

```typescript
/**
 * 通用 HTML 解析工具
 * 用于从 HTML 内容中提取文本和日期信息
 */

/**
 * 清理 HTML 标签，保留纯文本
 */
export function cleanHtmlTags(html: string): string {
  return html
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * 解析 HTML 实体
 */
export function cleanHtmlEntities(text: string): string {
  return text
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ');
}

/**
 * 灵活解析多种日期格式
 * 支持: ISO (2024-03-15), RFC 2822 (March 15, 2024), 中文日期 (2024年3月15日)
 */
export function parseDateFlexible(dateStr: string): Date | null {
  const trimmed = dateStr.trim();

  // 尝试 ISO 格式: 2024-03-15 或 2024-03-15T10:30:00
  const isoMatch = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (isoMatch) {
    const date = new Date(trimmed);
    if (!isNaN(date.getTime())) {
      return date;
    }
  }

  // 尝试中文日期格式: 2024年3月15日
  const chineseMatch = trimmed.match(/(\d{4})年(\d{1,2})月(\d{1,2})日/);
  if (chineseMatch) {
    const year = parseInt(chineseMatch[1], 10);
    const month = parseInt(chineseMatch[2], 10) - 1;
    const day = parseInt(chineseMatch[3], 10);
    const date = new Date(year, month, day);
    if (!isNaN(date.getTime())) {
      return date;
    }
  }

  // 尝试英文月份格式: March 15, 2024 或 March 15 2024
  const englishMatch = trimmed.match(/^([A-Za-z]+)\s+(\d{1,2}),?\s+(\d{4})$/);
  if (englishMatch) {
    const date = new Date(trimmed);
    if (!isNaN(date.getTime())) {
      return date;
    }
  }

  // 尝试反向英文格式: 15 March 2024
  const reverseMatch = trimmed.match(/^(\d{1,2})\s+([A-Za-z]+)\s+(\d{4})$/);
  if (reverseMatch) {
    const date = new Date(trimmed);
    if (!isNaN(date.getTime())) {
      return date;
    }
  }

  // 最后尝试直接解析
  const date = new Date(trimmed);
  if (!isNaN(date.getTime())) {
    return date;
  }

  return null;
}

/**
 * 从 HTML 片段提取属性值
 */
export function extractAttribute(html: string, attr: string): string | null {
  const regex = new RegExp(`${attr}="([^"]*)"`, 'i');
  const match = html.match(regex);
  return match ? match[1] : null;
}

/**
 * 从 HTML 片段提取 datetime 属性
 */
export function extractDatetime(html: string): Date | null {
  const datetimeAttr = extractAttribute(html, 'datetime');
  if (datetimeAttr) {
    return parseDateFlexible(datetimeAttr);
  }
  return null;
}
```

- [ ] **Step 2: 验证工具模块**

运行: `cd packages/api && pnpm exec tsc --noEmit`
预期: 无错误

- [ ] **Step 3: 提交工具模块**

```bash
git add packages/api/src/utils/html-parser.ts
git commit -m "feat(api): add HTML parser utilities for changelog parsing"
```

---

## Task 3: 修改 Anthropic 解析器（Claude Code Changelog）

**Files:**
- Modify: `packages/api/src/sources/anthropic.ts`

- [ ] **Step 1: 重写 AnthropicSourceParser 以抓取 Claude Code changelog**

完整替换文件内容为：

```typescript
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
```

- [ ] **Step 2: 验证解析器**

运行: `cd packages/api && pnpm exec tsc --noEmit`
预期: 无错误

- [ ] **Step 3: 提交修改**

```bash
git add packages/api/src/sources/anthropic.ts
git commit -m "feat(api): update AnthropicSourceParser for Claude Code changelog"
```

---

## Task 4: 创建 Codex 解析器

**Files:**
- Create: `packages/api/src/sources/codex.ts`

- [ ] **Step 1: 创建 codex.ts 文件**

```typescript
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
```

- [ ] **Step 2: 验证解析器**

运行: `cd packages/api && pnpm exec tsc --noEmit`
预期: 无错误

- [ ] **Step 3: 提交**

```bash
git add packages/api/src/sources/codex.ts
git commit -m "feat(api): add CodexSourceParser for Codex changelog"
```

---

## Task 5: 创建 OpenCode 解析器

**Files:**
- Create: `packages/api/src/sources/opencode.ts`

- [ ] **Step 1: 创建 opencode.ts 文件**

```typescript
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
```

- [ ] **Step 2: 验证解析器**

运行: `cd packages/api && pnpm exec tsc --noEmit`
预期: 无错误

- [ ] **Step 3: 提交**

```bash
git add packages/api/src/sources/opencode.ts
git commit -m "feat(api): add OpenCodeSourceParser for OpenCode changelog"
```

---

## Task 6: 更新 ScraperService 注册新解析器

**Files:**
- Modify: `packages/api/src/services/scraper.ts`

- [ ] **Step 1: 添加新解析器导入和注册**

修改 `scraper.ts`:

1. 添加导入（第2-3行之后）:
```typescript
import { CodexSourceParser } from '../sources/codex.js';
import { OpenCodeSourceParser } from '../sources/opencode.js';
```

2. 修改 `scrapeAll` 方法中的源列表（第70行）:
```typescript
// 将
const sources: SourceType[] = ['openai', 'anthropic'];

// 改为
const sources: SourceType[] = ['openai', 'anthropic', 'codex', 'opencode'];
```

3. 修改 `createParser` 方法，添加新 case（第82-91行）:
```typescript
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
```

- [ ] **Step 2: 验证完整构建**

运行: `cd packages/api && pnpm exec tsc --noEmit`
预期: 无错误

- [ ] **Step 3: 提交修改**

```bash
git add packages/api/src/services/scraper.ts
git commit -m "feat(api): register Codex and OpenCode parsers in ScraperService"
```

---

## Task 7: 集成测试

**Files:**
- 无新文件（手动测试）

- [ ] **Step 1: 启动本地开发服务器**

运行: `pnpm dev`
预期: 服务器启动成功

- [ ] **Step 2: 测试 refresh 端点**

运行: `curl -X POST http://localhost:8787/api/refresh`
预期: 返回成功响应，包含新数据源的抓取结果

- [ ] **Step 3: 测试 articles 端点**

运行: `curl "http://localhost:8787/api/articles?days=7"`
预期: 返回包含 openai, anthropic, codex, opencode 的文章

- [ ] **Step 4: 检查日志输出**

查看控制台日志，确认各解析器正常工作
预期: 无错误日志，各源成功抓取文章

---

## Task 8: 最终提交

- [ ] **Step 1: 确保所有更改已提交**

运行: `git status`
预期: 工作目录干净

- [ ] **Step 2: 创建汇总提交（如有遗漏）**

```bash
git add -A
git commit -m "feat(api): add changelog sources for Claude Code, Codex, and OpenCode"
```

---

## 验收标准

- [ ] `SourceType` 包含 `codex` 和 `opencode`
- [ ] 三个新解析器正确实现 `BaseSourceParser` 接口
- [ ] `ScraperService` 正确注册所有解析器
- [ ] 本地测试通过，能够抓取到三个数据源的文章
- [ ] 7天过滤逻辑正常工作
- [ ] 前端能够正确显示新增数据源的文章
