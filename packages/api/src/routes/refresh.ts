import { AppError } from '../utils/errors.js';
import { refreshResponse, errorResponse } from '../utils/response.js';
import { StorageService } from '../services/storage.js';
import { ScraperService } from '../services/scraper.js';
import { SummarizerService } from '../services/summarizer.js';
import type { RefreshRequest, RefreshResponse, Env, SourceType } from '../types.js';

const VALID_SOURCES: SourceType[] = ['openai', 'anthropic'];

/**
 * 处理 POST /refresh 请求
 */
export async function handleRefresh(request: Request, env: Env): Promise<Response> {
  try {
    // 解析请求体
    const body = await parseRequestBody(request);

    // 确定要刷新的数据源
    const sourcesToRefresh = body.source
      ? [body.source]
      : VALID_SOURCES;

    const storage = new StorageService(env);
    const scraper = new ScraperService(env);
    const summarizer = new SummarizerService(env);

    const refreshedSources: SourceType[] = [];
    let totalFound = 0;
    let totalSummarized = 0;
    let totalSkippedDuplicate = 0;
    let totalSkippedIncomplete = 0;
    const allErrors: string[] = [];

    // 依次处理每个数据源
    for (const source of sourcesToRefresh) {
      try {
        // 1. 抓取文章
        const scrapeResult = await scraper.scrapeSource(source, 24);

        if (scrapeResult.errors.length > 0) {
          allErrors.push(...scrapeResult.errors.map(e => `[${source}] ${e.code}: ${e.message}`));
        }

        if (scrapeResult.articles.length === 0) {
          continue;
        }

        totalFound += scrapeResult.articles.length;
        refreshedSources.push(source);

        // 2. 检查重复
        const existingIds = new Set<string>();
        for (const article of scrapeResult.articles) {
          const date = article.publishedAt.slice(0, 10);
          const exists = await storage.hasSummary(source, date, article.id);
          if (exists) {
            existingIds.add(article.id);
          }
        }

        // 3. 生成摘要
        const { results, stats } = await summarizer.summarizeBatch(
          scrapeResult.articles,
          existingIds
        );

        // 4. 保存到 KV
        for (const summary of results) {
          const date = summary.publishedAt.slice(0, 10);
          await storage.saveSummary(summary);
          await storage.addToIndex(date, source, summary.id);
        }

        totalSummarized += stats.summarized;
        totalSkippedDuplicate += stats.skippedDuplicate;
        totalSkippedIncomplete += stats.skippedIncomplete;
        allErrors.push(...stats.errors);
      } catch (error) {
        const errorMsg = error instanceof AppError
          ? `${error.code}: ${error.message}`
          : String(error);
        allErrors.push(`[${source}] ${errorMsg}`);
      }
    }

    // 5. 更新最后刷新时间
    await storage.setLastRefreshed(new Date().toISOString());

    // 6. 清理过期数据
    try {
      const cleanupResult = await storage.cleanupOldData();
      if (cleanupResult.errors.length > 0) {
        console.warn('Cleanup errors:', cleanupResult.errors);
      }
    } catch (error) {
      console.error('Cleanup failed:', error);
    }

    const response: RefreshResponse = {
      success: true,
      data: {
        refreshedSources,
        articlesFound: totalFound,
        articlesSummarized: totalSummarized,
        articlesSkipped: {
          duplicate: totalSkippedDuplicate,
          incompleteMetadata: totalSkippedIncomplete,
        },
        errors: allErrors,
      },
    };

    return refreshResponse(response);
  } catch (error) {
    if (error instanceof AppError) {
      return errorResponse(error);
    }
    return errorResponse(new AppError('INTERNAL_ERROR', error instanceof Error ? error : undefined));
  }
}

async function parseRequestBody(request: Request): Promise<RefreshRequest> {
  try {
    const body = await request.json() as RefreshRequest;

    // 验证 source 参数
    if (body.source && !VALID_SOURCES.includes(body.source)) {
      throw new AppError('VALIDATION_INVALID_SOURCE');
    }

    return body;
  } catch (error) {
    if (error instanceof AppError) {
      throw error;
    }
    // 空请求体或解析错误，返回空对象（刷新所有源）
    return {};
  }
}
